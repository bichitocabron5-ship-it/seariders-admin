// src/app/api/store/reservations/[id]/prefill/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { OperationalOverrideAction, OperationalOverrideTarget } from "@prisma/client";
import { sessionOptions, AppSession } from "@/lib/session";
import { getReservationWorkflowState } from "@/lib/reservation-workflow";
import { getReservationPaymentStatus } from "@/lib/reservation-payment-status";
import { buildReservationPrefillCartItems } from "@/lib/reservation-prefill";
import { countReadyVisibleContractsByTargets, pickVisibleContractsByTargets } from "@/lib/contracts/active-contracts";
import { resolveReadyContractCountWithManualAttachments } from "@/lib/manual-contract-attachments";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fallbackOptionalString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized && normalized !== "-") return normalized;
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const r = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      activityDate: true,
      scheduledTime: true,
      serviceId: true,
      optionId: true,
      channelId: true,
      quantity: true,
      pax: true,
      isLicense: true,
      jetskiLicenseMode: true,
      pricingTier: true,
      basePriceCents: true,
      commissionBaseCents: true,
      appliedCommissionMode: true,
      appliedCommissionValue: true,
      appliedCommissionPct: true,
      appliedCommissionCents: true,
      manualDiscountCents: true,
      autoDiscountCents: true,
      customerDiscountCents: true,
      promoCode: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
      promoterDiscountCents: true,
      companyDiscountCents: true,
      totalPriceCents: true,
      depositCents: true,
      source: true,
      customerName: true,
      boothNote: true,
      customerPhone: true,
      customerEmail: true,
      customerCountry: true,
      customerAddress: true,
      customerPostalCode: true,
      customerBirthDate: true,
      customerDocType: true,
      customerDocNumber: true,
      marketing: true,
      companionsCount: true,
      formalizedAt: true,
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,
      contracts: {
        orderBy: { unitIndex: "asc" },
        take: 20,
        select: {
          id: true,
          reservationItemId: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          createdAt: true,
          driverName: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          driverAddress: true,
          driverPostalCode: true,
          driverBirthDate: true,
          driverDocType: true,
          driverDocNumber: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
        },
      },
      giftVoucherId: true,
      passVoucherId: true,
      passConsumeId: true,
      items: {
        select: {
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          isExtra: true,
          servicePriceId: true,
          unitPriceCents: true,
          totalPriceCents: true,
          service: { select: { category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
      payments: {
        select: {
          amountCents: true,
          isDeposit: true,
          direction: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          isLicense: true,
        },
      },
      option: {
        select: {
          id: true,
          serviceId: true,
          code: true,
          durationMinutes: true,
          paxMax: true,
          contractedMinutes: true,
          basePriceCents: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
          commissionEnabled: true,
          commissionBps: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
        },
      },
    },
  });

  if (!r) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const contractRequirements = buildReservationContractRequirements({
    quantity: r.quantity ?? 0,
    isLicense: Boolean(r.isLicense),
    serviceCategory: r.service?.category ?? null,
    serviceId: r.serviceId,
    optionId: r.optionId,
    serviceName: r.service?.name ?? null,
    durationMinutes: r.option?.durationMinutes ?? null,
    pax: r.pax,
    totalPriceCents: r.totalPriceCents,
    items: r.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const requiredUnits = contractRequirements.length;
  const visibleContracts = pickVisibleContractsByTargets(r.contracts ?? [], syncTargets);
  const completeLicenseContract =
    visibleContracts.find(
      (contract) =>
        Boolean(String(contract.licenseSchool ?? "").trim()) &&
        Boolean(String(contract.licenseType ?? "").trim()) &&
        Boolean(String(contract.licenseNumber ?? "").trim())
    ) ?? null;
  const primaryContract = visibleContracts[0] ?? r.contracts[0] ?? null;
  const contractCompatibilityFallback = !r.formalizedAt ? primaryContract : null;
  const reservation = {
    ...r,
    items: buildReservationPrefillCartItems({
      promoCode: r.promoCode,
      fallbackOptionId: r.optionId,
      items: r.items ?? [],
    }),
    customerName: fallbackOptionalString(r.customerName, contractCompatibilityFallback?.driverName),
    customerPhone: fallbackOptionalString(r.customerPhone, contractCompatibilityFallback?.driverPhone),
    customerEmail: fallbackOptionalString(r.customerEmail, contractCompatibilityFallback?.driverEmail),
    customerCountry: fallbackOptionalString(r.customerCountry, contractCompatibilityFallback?.driverCountry),
    customerAddress: fallbackOptionalString(r.customerAddress, contractCompatibilityFallback?.driverAddress),
    customerPostalCode: fallbackOptionalString(r.customerPostalCode, contractCompatibilityFallback?.driverPostalCode),
    customerBirthDate: r.customerBirthDate ?? contractCompatibilityFallback?.driverBirthDate ?? null,
    customerDocType: fallbackOptionalString(r.customerDocType, contractCompatibilityFallback?.driverDocType),
    customerDocNumber: fallbackOptionalString(r.customerDocNumber, contractCompatibilityFallback?.driverDocNumber),
    licenseSchool: fallbackOptionalString(r.licenseSchool, completeLicenseContract?.licenseSchool),
    licenseType: fallbackOptionalString(r.licenseType, completeLicenseContract?.licenseType),
    licenseNumber: fallbackOptionalString(r.licenseNumber, completeLicenseContract?.licenseNumber),
  };

  const isPast = r.activityDate < startOfToday();
  const isHistorical = isPast && (r.status === "COMPLETED" || r.status === "CANCELED");
  const isCanceled = r.status === "CANCELED";
  const isCompleted = r.status === "COMPLETED";
  const isReadOnly = isHistorical || isCanceled;
  const paymentStatus = getReservationPaymentStatus({
    giftVoucherId: r.giftVoucherId,
    passVoucherId: r.passVoucherId,
    passConsumeId: r.passConsumeId,
    totalPriceCents: r.totalPriceCents,
    depositCents: r.depositCents,
    quantity: r.quantity,
    isLicense: Boolean(r.isLicense),
    serviceCategory: r.service?.category,
    items: r.items,
    payments: r.payments,
  });
  const totalServiceCents = paymentStatus.serviceDueCents;
  const paidServiceCents = paymentStatus.paidServiceCents;
  const pendingServiceCents = paymentStatus.pendingServiceCents;
  const pendingDepositCents = paymentStatus.pendingDepositCents;
  const manualAttachmentCount =
    requiredUnits > 0
      ? await prisma.operationalOverrideLog.count({
          where: {
            targetType: OperationalOverrideTarget.RESERVATION,
            action: OperationalOverrideAction.MANUAL_RESERVATION_CREATE,
            targetId: r.id,
            reason: "Adjunto contrato manual",
          },
        })
      : 0;
  const readyCount = resolveReadyContractCountWithManualAttachments({
    requiredUnits,
    readyContractsCount: countReadyVisibleContractsByTargets(r.contracts ?? [], syncTargets),
    manualAttachmentCount,
  });
  const signedCount = visibleContracts.filter((contract) => contract.status === "SIGNED").length;
  const workflow = getReservationWorkflowState({
    reservationId: r.id,
    status: r.status,
    formalizedAt: r.formalizedAt,
    customerName: reservation.customerName,
    customerPhone: reservation.customerPhone,
    isReadOnly,
    isCanceled,
    isCompleted,
    requiredUnits,
    readyCount,
    pendingServiceCents,
    pendingDepositCents,
    signedCount,
  });

  return NextResponse.json({
    reservation,
    financial: {
      totalServiceCents,
      paidServiceCents: Math.max(0, paidServiceCents),
      pendingServiceCents,
      pendingDepositCents,
    },
    flags: {
      isPast,
      isHistorical,
      isCanceled,
      isCompleted,
      isReadOnly,
      isGift: Boolean(r.giftVoucherId),
      isPass: Boolean(r.passVoucherId || r.passConsumeId),
    },
    workflow,
  });
}

