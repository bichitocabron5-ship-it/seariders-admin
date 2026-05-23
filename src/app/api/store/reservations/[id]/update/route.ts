// src/app/api/store/reservations/[id]/update/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { JetskiLicenseMode, PricingTier, ReservationStatus } from "@prisma/client";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import type { Prisma } from "@prisma/client";
import { getBoothUnitDiscountCents, getScaledBoothDiscountCents } from "@/lib/booth-discount";
import { resolveJetskiLicenseMode, resolvePricingTierForJetskiMode } from "@/lib/jetski-license";
import { findActiveServicePrice } from "@/lib/service-pricing";
import {
  getAppliedCommercialSnapshotTx,
  resolveCustomerDiscountSnapshot,
  resolveDiscountPolicy,
} from "@/lib/commission";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";
import {
  countReadyVisibleContracts,
  listMissingLogicalUnits,
  pickVisibleContractsByLogicalUnit,
} from "@/lib/contracts/active-contracts";
import { syncReservationContractsTx } from "@/lib/reservation-contract-sync";
import { syncReservationPlatformUnitsTx } from "@/lib/reservation-platform";
import { assertSlotCapacityOrThrow } from "@/lib/slot-capacity";
import { assertServiceChannelCompatibilityTx } from "@/lib/service-channel-availability";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

function accumulateLineQuantity(
  map: Map<string, number>,
  args: { serviceId: string; optionId: string; quantity: number }
) {
  const key = `${args.serviceId}::${args.optionId}`;
  map.set(key, (map.get(key) ?? 0) + Math.max(0, Number(args.quantity ?? 0)));
}

function normalizeComparableOptionalString(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined) {
  const at = a?.getTime() ?? null;
  const bt = b?.getTime() ?? null;
  return at === bt;
}

function buildComparableComposition(
  items: Array<{ serviceId: string; optionId: string; quantity: number; pax: number }>
) {
  return items
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId,
      quantity: Number(item.quantity ?? 0),
      pax: Number(item.pax ?? 0),
    }))
    .sort((a, b) =>
      a.serviceId.localeCompare(b.serviceId) ||
      a.optionId.localeCompare(b.optionId) ||
      a.quantity - b.quantity ||
      a.pax - b.pax
    );
}

async function ensureContractsTx(tx: Prisma.TransactionClient, reservationId: string) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      quantity: true,
      isLicense: true,
      service: { select: { category: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true } },
        },
      },
      contracts: {
        select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
      },
    },
  });

  if (!reservation) throw new Error("Reserva no existe");

  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: reservation.items ?? [],
  });

  if (requiredUnits <= 0) return { requiredUnits: 0, readyCount: 0 };

  const missingSlots = listMissingLogicalUnits(reservation.contracts ?? [], requiredUnits);
  const maxUnitIndex = Math.max(
    0,
    ...(reservation.contracts ?? []).map((contract) => Number(contract.unitIndex ?? 0))
  );
  const toCreate: Array<{ reservationId: string; unitIndex: number; logicalUnitIndex: number }> = missingSlots.map(
    (slot, idx) => ({
      reservationId,
      unitIndex: maxUnitIndex + idx + 1,
      logicalUnitIndex: slot,
    })
  );

  if (toCreate.length > 0) {
    await tx.reservationContract.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  const contracts = await tx.reservationContract.findMany({
    where: { reservationId },
    select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
  });

  const readyCount = countReadyVisibleContracts(contracts, requiredUnits);

  return { requiredUnits, readyCount };
}

// mismo contrato que formalize
const NullableStr = z.string().optional().nullable();

const ItemBody = z.object({
  serviceId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  pax: z.number().int().min(1).max(50),
  promoCode: z.preprocess(
    (v) => {
      if (v == null) return null;
      const t = String(v).trim().toUpperCase();
      return t.length ? t : null;
    },
    z.string().min(1).max(50).nullable().optional()
  ),
});

const Body = z.object({
  pax: z.number().int().min(1).max(50),
  isLicense: z.boolean(),
  jetskiLicenseMode: z.nativeEnum(JetskiLicenseMode).optional(),
  pricingTier: z.nativeEnum(PricingTier).optional(),
  channelId: z.string().nullable().optional(),
  activityDate: z.string().min(10).max(10),
  time: z.string().min(5).max(5).nullable().optional(),
  

  // opcionales cliente/licencia (tu semántica undefined/no tocar)
  customerPhone: NullableStr,
  customerEmail: NullableStr,
  customerCountry: NullableStr,
  customerAddress: NullableStr,
  customerPostalCode: NullableStr,
  customerBirthDate: z.string().datetime().optional().nullable(),
  customerDocType: NullableStr,
  customerDocNumber: NullableStr,
  marketing: NullableStr,
  licenseSchool: NullableStr,
  licenseType: NullableStr,
  licenseNumber: NullableStr,

  // NUEVO PRO
  items: z.array(ItemBody).optional(),
  companionsCount: z.number().int().min(0).max(20).optional(),

  // compat legacy (si no mandas items)
  serviceId: z.string().min(1).optional(),
  optionId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99).optional(),

  // (opcional) si quieres permitir actualizar descuento manual aquí
  manualDiscountCents: z.number().int().min(0).max(1_000_000).optional(),
  manualDiscountReason: z.string().max(200).nullable().optional(),
  confirmSignedContractReduction: z.boolean().optional(),
});

// igual que formalize
function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null;          // borrar
  const t = String(v).trim();
  return t.length ? t : undefined;
}

function deriveCommercialReservationState(args: {
  serviceCategory?: string | null;
  jetskiLicenseMode?: JetskiLicenseMode | null;
  isLicense?: boolean | null;
  pricingTier?: PricingTier | null;
}) {
  const serviceCategory = String(args.serviceCategory ?? "").trim().toUpperCase();
  const jetskiLicenseMode = resolveJetskiLicenseMode({
    category: serviceCategory,
    jetskiLicenseMode: args.jetskiLicenseMode,
    isLicense: args.isLicense,
  });
  const isLicense =
    serviceCategory === "JETSKI"
      ? jetskiLicenseMode !== JetskiLicenseMode.NONE
      : Boolean(args.isLicense);
  const pricingTier =
    serviceCategory === "JETSKI"
      ? resolvePricingTierForJetskiMode(jetskiLicenseMode)
      : (args.pricingTier ?? PricingTier.STANDARD);

  return { jetskiLicenseMode, isLicense, pricingTier };
}

function toRouteErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Error";
  return new NextResponse(
    message.replace(/^CONFIRM_SIGNED_CONTRACT_REDUCTION:\s*/, ""),
    { status: message.startsWith("CONFIRM_SIGNED_CONTRACT_REDUCTION:") ? 409 : 400 }
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const json = await req.json().catch(() => null);

  // seguridad: no permitir editar nombre
  if (json && typeof json === "object" && "customerName" in json) {
    return new NextResponse("No se permite editar el nombre", { status: 400 });
  }
  
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const b = parsed.data;

  const existing = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      serviceId: true,
      optionId: true,
      pax: true,
      quantity: true,
      isLicense: true,
      jetskiLicenseMode: true,
      pricingTier: true,
      service: { select: { category: true } },
      channelId: true,
      activityDate: true,
      scheduledTime: true,
      readyForPlatformAt: true,
      paymentCompletedAt: true,
      customerCountry: true,

      // para merge correcto
      customerPhone: true,
      customerEmail: true,
      customerAddress: true,
      customerPostalCode: true,
      customerBirthDate: true,
      customerDocType: true,
      customerDocNumber: true,
      marketing: true,
      companionsCount: true,

      // licencia actual
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,

      manualDiscountCents: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
      commissionBaseCents: true,
      promoterDiscountCents: true,
      companyDiscountCents: true,
      isPackParent: true,
      parentReservationId: true,
      source: true,
      giftVoucherId: true,
      passVoucherId: true,
      items: {
        select: {
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          isExtra: true,
          service: { select: { category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
      contracts: {
        select: {
          id: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!existing) return new NextResponse("Reserva no existe", { status: 404 });
  if (
    existing.status === ReservationStatus.CANCELED ||
    existing.status === ReservationStatus.COMPLETED ||
    existing.status === ReservationStatus.IN_SEA
  ) {
    return new NextResponse("La reserva cancelada, en curso o completada no se puede editar.", { status: 409 });
  }
  const existingRequiredUnits = computeRequiredContractUnits({
    quantity: existing.quantity ?? 0,
    isLicense: Boolean(existing.isLicense),
    serviceCategory: existing.service?.category ?? null,
    items: existing.items ?? [],
  });
  const visibleContracts = pickVisibleContractsByLogicalUnit(existing.contracts ?? [], existingRequiredUnits);
  const lockedContractsCount = visibleContracts.filter(
    (contract) => contract.status === "READY" || contract.status === "SIGNED"
  ).length;
  const signedContractsCount = visibleContracts.filter(
    (contract) => contract.status === "SIGNED"
  ).length;
  const desiredReadyAt =
    existing.status === ReservationStatus.READY_FOR_PLATFORM
      ? existing.readyForPlatformAt ?? existing.paymentCompletedAt ?? new Date()
      : undefined;
const hasProItems = Array.isArray(b.items) && b.items.length > 0;
const isBoothReservation = existing.source === "BOOTH";
const compatibilityOrigin = isBoothReservation ? "BOOTH" : "STORE";
const boothUnitDiscountCents = getBoothUnitDiscountCents({
  source: existing.source,
  matchingQuantity: existing.quantity,
  manualDiscountCents: existing.manualDiscountCents,
});
const tz = BUSINESS_TZ;
const activityDate = utcDateFromYmdInTz(tz, b.activityDate);
const scheduledTime = utcDateTimeFromYmdHmInTz(tz, b.activityDate, b.time ?? null);
const pricingWhen = scheduledTime ?? activityDate;
const requestedServiceId = hasProItems
  ? (b.items?.[0]?.serviceId ?? existing.serviceId)
  : (b.serviceId ?? existing.serviceId);
const requestedServiceCategory =
  requestedServiceId === existing.serviceId
    ? existing.service?.category ?? null
    : (
        await prisma.service.findUnique({
          where: { id: requestedServiceId },
          select: { category: true },
        })
      )?.category ?? null;
const requestedReservationState = deriveCommercialReservationState({
  serviceCategory: requestedServiceCategory,
  jetskiLicenseMode: b.jetskiLicenseMode ?? existing.jetskiLicenseMode,
  isLicense: b.isLicense,
  pricingTier: b.pricingTier ?? existing.pricingTier,
});
const priceSensitiveChanged =
  existing.serviceId !== b.serviceId ||
  existing.optionId !== b.optionId ||
  Number(existing.quantity) !== Number(b.quantity) ||
  Boolean(existing.isLicense) !== Boolean(requestedReservationState.isLicense) ||
  existing.pricingTier !== requestedReservationState.pricingTier;
const mainCount = await prisma.reservationItem.count({
  where: { reservationId: id, isExtra: false },
});
const isMultiOrPack = mainCount > 1 || Boolean(existing.isPackParent);
const customerPhone = normalizeOptionalString(b.customerPhone);
const customerEmail = normalizeOptionalString(b.customerEmail);
const customerCountry = normalizeOptionalString(b.customerCountry);
const customerAddress = normalizeOptionalString(b.customerAddress);
const customerPostalCode = normalizeOptionalString(b.customerPostalCode);
const customerBirthDate = b.customerBirthDate !== undefined ? (b.customerBirthDate ? new Date(b.customerBirthDate) : null) : undefined;
const customerDocType = normalizeOptionalString(b.customerDocType);
const customerDocNumber = normalizeOptionalString(b.customerDocNumber);
const marketing = normalizeOptionalString(b.marketing);
const licenseSchool = normalizeOptionalString(b.licenseSchool);
const licenseType = normalizeOptionalString(b.licenseType);
const licenseNumber = normalizeOptionalString(b.licenseNumber);
const finalLicenseSchool = licenseSchool === undefined ? existing.licenseSchool : licenseSchool;
const finalLicenseType = licenseType === undefined ? existing.licenseType : licenseType;
const finalLicenseNumber = licenseNumber === undefined ? existing.licenseNumber : licenseNumber;
const existingComposition = buildComparableComposition(
  (existing.items ?? [])
    .filter((item) => !item.isExtra && item.optionId)
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId!,
      quantity: Number(item.quantity ?? 0),
      pax: Number(item.pax ?? existing.pax ?? 0),
    }))
);
const nextComposition = buildComparableComposition(
  (b.items?.length
    ? b.items
    : [{
        serviceId: b.serviceId ?? existing.serviceId,
        optionId: b.optionId ?? existing.optionId,
        quantity: Number(b.quantity ?? existing.quantity ?? 0),
        pax: Number(b.pax ?? existing.pax ?? 0),
      }]).map((item) => ({
    serviceId: item.serviceId,
    optionId: item.optionId,
    quantity: Number(item.quantity ?? 0),
    pax: Number(item.pax ?? 0),
  }))
);
const scheduleChanged =
  !sameInstant(existing.activityDate, activityDate) || !sameInstant(existing.scheduledTime, scheduledTime);
const compositionChanged = JSON.stringify(existingComposition) !== JSON.stringify(nextComposition);
const resolvedCustomerPhone = customerPhone === undefined ? normalizeComparableOptionalString(existing.customerPhone) : customerPhone;
const resolvedCustomerEmail = customerEmail === undefined ? normalizeComparableOptionalString(existing.customerEmail) : customerEmail;
const resolvedCustomerCountry =
  customerCountry === undefined
    ? normalizeComparableOptionalString(existing.customerCountry)?.toUpperCase() ?? null
    : normalizeComparableOptionalString(customerCountry)?.toUpperCase() ?? null;
const resolvedCustomerAddress =
  customerAddress === undefined ? normalizeComparableOptionalString(existing.customerAddress) : customerAddress;
const resolvedCustomerPostalCode =
  customerPostalCode === undefined ? normalizeComparableOptionalString(existing.customerPostalCode) : customerPostalCode;
const resolvedCustomerBirthDate = customerBirthDate === undefined ? existing.customerBirthDate : customerBirthDate;
const resolvedCustomerDocType =
  customerDocType === undefined ? normalizeComparableOptionalString(existing.customerDocType) : customerDocType;
const resolvedCustomerDocNumber =
  customerDocNumber === undefined ? normalizeComparableOptionalString(existing.customerDocNumber) : customerDocNumber;
const resolvedMarketing = marketing === undefined ? normalizeComparableOptionalString(existing.marketing) : marketing;
const protectedNonScheduleFieldsChanged =
  Number(existing.pax ?? 0) !== Number(b.pax ?? 0) ||
  Number(existing.companionsCount ?? 0) !== Number(b.companionsCount ?? 0) ||
  (existing.channelId ?? null) !== (b.channelId ?? null) ||
  Boolean(existing.isLicense) !== Boolean(requestedReservationState.isLicense) ||
  existing.jetskiLicenseMode !== requestedReservationState.jetskiLicenseMode ||
  existing.pricingTier !== requestedReservationState.pricingTier ||
  normalizeComparableOptionalString(existing.customerPhone) !== resolvedCustomerPhone ||
  normalizeComparableOptionalString(existing.customerEmail) !== resolvedCustomerEmail ||
  (normalizeComparableOptionalString(existing.customerCountry)?.toUpperCase() ?? null) !== resolvedCustomerCountry ||
  normalizeComparableOptionalString(existing.customerAddress) !== resolvedCustomerAddress ||
  normalizeComparableOptionalString(existing.customerPostalCode) !== resolvedCustomerPostalCode ||
  !sameInstant(existing.customerBirthDate, resolvedCustomerBirthDate) ||
  normalizeComparableOptionalString(existing.customerDocType) !== resolvedCustomerDocType ||
  normalizeComparableOptionalString(existing.customerDocNumber) !== resolvedCustomerDocNumber ||
  normalizeComparableOptionalString(existing.marketing) !== resolvedMarketing ||
  normalizeComparableOptionalString(existing.licenseSchool) !== normalizeComparableOptionalString(finalLicenseSchool) ||
  normalizeComparableOptionalString(existing.licenseType) !== normalizeComparableOptionalString(finalLicenseType) ||
  normalizeComparableOptionalString(existing.licenseNumber) !== normalizeComparableOptionalString(finalLicenseNumber);
const isScheduleOnlyChange = scheduleChanged && !compositionChanged && !protectedNonScheduleFieldsChanged;

if (hasProItems) {
  // Si es pack padre, no debería permitir editar items aquí.
  const existingPack = await prisma.reservation.findUnique({
    where: { id },
    select: { isPackParent: true, packId: true, manualDiscountCents: true, customerCountry: true, source: true },
  });
  if (!existingPack) return new NextResponse("Reserva no existe", { status: 404 });
  if (existingPack.isPackParent && existingPack.packId) {
    return new NextResponse("Los packs se editan como pack (no se puede cambiar composición aquí).", { status: 400 });
  }

  // Resolver services/options en batch
  const serviceIds = Array.from(new Set(b.items!.map(x => x.serviceId)));
  const optionIds = Array.from(new Set(b.items!.map(x => x.optionId)));

  const [svcs, opts] = await Promise.all([
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, category: true },
    }),
    prisma.serviceOption.findMany({
      where: { id: { in: optionIds } },
      select: { id: true, serviceId: true, durationMinutes: true },
    }),
  ]);

  const svcById = new Map(svcs.map(s => [s.id, s]));
  const optById = new Map(opts.map(o => [o.id, o]));

  // Validaciones fuertes
  for (const it of b.items!) {
    const svc = svcById.get(it.serviceId);
    if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

    const opt = optById.get(it.optionId);
    if (!opt) return new NextResponse("Opción no existe", { status: 400 });

    if (opt.serviceId !== svc.id) {
      return new NextResponse("La opción no pertenece al servicio", { status: 400 });
    }
  }

  if (lockedContractsCount > 0) {
    if (!isScheduleOnlyChange && protectedNonScheduleFieldsChanged) {
      return new NextResponse(
        "La reserva tiene contratos preparados o firmados. Solo puedes reagendar fecha y hora sin tocar pax, datos legales ni composición de la reserva.",
        { status: 409 }
      );
    }

    const existingLineQty = new Map<string, number>();
    const nextLineQty = new Map<string, number>();
    const existingServiceQty = new Map<string, number>();
    const nextServiceQty = new Map<string, number>();

    for (const item of existing.items ?? []) {
      if (item.isExtra) continue;
      const optionId = item.optionId ?? existing.optionId;
      if (!optionId) continue;
      const qty = Number(item.quantity ?? 0);
      accumulateLineQuantity(existingLineQty, {
        serviceId: item.serviceId,
        optionId,
        quantity: qty,
      });
      existingServiceQty.set(item.serviceId, (existingServiceQty.get(item.serviceId) ?? 0) + qty);
    }

    for (const item of b.items!) {
      const qty = Number(item.quantity ?? 0);
      accumulateLineQuantity(nextLineQty, {
        serviceId: item.serviceId,
        optionId: item.optionId,
        quantity: qty,
      });
      nextServiceQty.set(item.serviceId, (nextServiceQty.get(item.serviceId) ?? 0) + qty);
    }

    const isReplacingLockedActivity = Array.from(existingLineQty.keys()).some(
      (key) => !nextLineQty.has(key)
    );
    const isReplacingLockedService = Array.from(existingServiceQty.keys()).some(
      (serviceId) => !nextServiceQty.has(serviceId)
    );
    if (signedContractsCount > 0 && (isReplacingLockedActivity || isReplacingLockedService)) {
      return new NextResponse(
        "La reserva tiene contratos firmados. Puedes ampliar o reducir unidades, pero no sustituir actividades ya firmadas desde esta pantalla.",
        { status: 409 }
      );
    }
  }

  // Recalcular totales, descuentos, fianza
  // (precio por línea por servicePrice vigente)
  let result: { id: string; requiredUnits: number; readyCount: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      // recalcular dentro de la tx
      const lineCreates: Array<{
      serviceId: string;
      optionId: string;
      durationMinutes: number;
      quantity: number;
      pax: number;
      promoCode: string | null;
      servicePriceId: string | null;
      unitPriceCents: number;
      totalPriceCents: number;
      category: string;
    }> = [];

    for (const it of b.items!) {
      const svc = svcById.get(it.serviceId)!;
      const opt = optById.get(it.optionId)!;

      const reservationState = deriveCommercialReservationState({
        serviceCategory: svc.category ?? null,
        jetskiLicenseMode: b.jetskiLicenseMode ?? existing.jetskiLicenseMode,
        isLicense: b.isLicense,
        pricingTier: b.pricingTier ?? existing.pricingTier,
      });
      const isVoucherIncludedBaseLine =
        Boolean(existing.giftVoucherId || existing.passVoucherId) &&
        it.serviceId === existing.serviceId &&
        it.optionId === existing.optionId;
      if (isVoucherIncludedBaseLine) {
        const qty = Math.max(1, Number(it.quantity || 1));
        lineCreates.push({
          serviceId: it.serviceId,
          optionId: it.optionId,
          durationMinutes: Number(opt.durationMinutes ?? 30),
          quantity: qty,
          pax: Math.max(1, Number(it.pax || b.pax)),
          promoCode: existingPack.source === "BOOTH" ? null : (String(it.promoCode ?? "").trim().toUpperCase() || null),
          servicePriceId: null,
          unitPriceCents: 0,
          totalPriceCents: 0,
          category: String(svc.category ?? "UNKNOWN").toUpperCase(),
        });
        continue;
      }

      const price = await findActiveServicePrice(tx, {
        serviceId: it.serviceId,
        optionId: it.optionId,
        durationMinutes: Number(opt.durationMinutes ?? 30),
        now: pricingWhen,
        pricingTier: String(svc.category ?? "").toUpperCase() === "JETSKI" ? reservationState.pricingTier : PricingTier.STANDARD,
      });

      if (!price) throw new Error("Este servicio/opción no tiene precio vigente (Admin > Precios).");

      const unitPriceCents = Number(price.basePriceCents) || 0;
      const qty = Math.max(1, Number(it.quantity || 1));
      const lineTotal = unitPriceCents * qty;

      lineCreates.push({
        serviceId: it.serviceId,
        optionId: it.optionId,
        durationMinutes: Number(opt.durationMinutes ?? 30),
        quantity: qty,
        pax: Math.max(1, Number(it.pax || b.pax)),
        promoCode: existingPack.source === "BOOTH" ? null : (String(it.promoCode ?? "").trim().toUpperCase() || null),
        servicePriceId: price.id ?? null,
        unitPriceCents,
        totalPriceCents: lineTotal,
        category: String(svc.category ?? "UNKNOWN").toUpperCase(),
      });
    }

    if (scheduledTime) {
      const dayEndExclusiveUtc = new Date(activityDate.getTime() + 24 * 60 * 60 * 1000);
      for (const line of lineCreates) {
        await assertSlotCapacityOrThrow({
          tx,
          dateStartUtc: activityDate,
          dateEndExclusiveUtc: dayEndExclusiveUtc,
          scheduledStartUtc: scheduledTime,
          category: line.category,
          durationMinutes: line.durationMinutes,
          units: line.quantity,
          excludeReservationId: id,
        });
      }
    }

    // Borrar items reales antiguos
    await tx.reservationItem.deleteMany({ where: { reservationId: id, isExtra: false } });

    // Crear items reales nuevos
    await tx.reservationItem.createMany({
      data: lineCreates.map(l => ({
        reservationId: id,
        serviceId: l.serviceId,
        optionId: l.optionId,
        servicePriceId: l.servicePriceId,
        quantity: l.quantity,
        pax: l.pax,
        unitPriceCents: l.unitPriceCents,
        totalPriceCents: l.totalPriceCents,
        isExtra: false,
      })),
    });

    if (compositionChanged || (b.channelId !== undefined && (b.channelId ?? null) !== (existing.channelId ?? null))) {
      await assertServiceChannelCompatibilityTx(tx, {
        origin: compatibilityOrigin,
        serviceIds: Array.from(new Set(lineCreates.map((line) => line.serviceId))),
        channelId: b.channelId ?? existing.channelId ?? null,
      });
    }

    // Totales
    const serviceSubtotal = lineCreates.reduce((s, l) => s + l.totalPriceCents, 0);

    // Los extras no se tocan, pero sí cuentan en el total vendible
    const extrasSum = await tx.reservationItem.aggregate({
      where: { reservationId: id, isExtra: true },
      _sum: { totalPriceCents: true },
    });
    const extrasTotal = Number(extrasSum._sum.totalPriceCents ?? 0);

    const totalBeforeDiscounts = serviceSubtotal + extrasTotal;

    const effectiveChannelId = b.channelId !== undefined ? b.channelId : existing.channelId;
    const channel = effectiveChannelId
      ? await prisma.channel.findUnique({
          where: { id: effectiveChannelId },
          select: {
            allowsPromotions: true,
            customerDiscountMode: true,
            customerDiscountValue: true,
            customerDiscountCents: true,
            discountResponsibility: true,
            promoterDiscountShareBps: true,
          },
        })
      : null;
    const promotionsEnabled =
      existingPack.source === "BOOTH" ? false : (channel ? Boolean(channel.allowsPromotions) : true);
    const country = normalizeOptionalString(b.customerCountry) ?? existingPack.customerCountry ?? "ES";
    const discountPolicy = resolveDiscountPolicy({
      responsibility: existing.discountResponsibility,
      promoterDiscountShareBps: existing.promoterDiscountShareBps,
      channel,
    });

    // Manual discount (cap 50% del totalBeforeDiscounts)
    const originalLineKey = `${existing.serviceId}::${existing.optionId}`;
    const matchingBoothLineQty = lineCreates.reduce(
      (sum, line) =>
        `${line.serviceId}::${line.optionId}` === originalLineKey
          ? sum + Number(line.quantity ?? 0)
          : sum,
      0
    );
    const incomingManual =
      existingPack.source === "BOOTH"
        ? getScaledBoothDiscountCents({
            boothUnitDiscountCents,
            nextMatchingQuantity: matchingBoothLineQty,
          })
        : (b.manualDiscountCents !== undefined ? Number(b.manualDiscountCents) : Number(existingPack.manualDiscountCents ?? 0));
    const totalMainQuantity = lineCreates.reduce(
      (sum, line) => sum + Number(line.quantity ?? 0),
      0
    );
    const customerDiscountSnapshot = resolveCustomerDiscountSnapshot({
      channel,
      quantity: totalMainQuantity,
      baseCents: totalBeforeDiscounts,
    });
    const commercial = await computeReservationCommercialBreakdown({
      when: pricingWhen,
      discountLines: lineCreates.map((line) => ({
        serviceId: line.serviceId,
        optionId: line.optionId,
        category: line.category,
        quantity: line.quantity,
        lineBaseCents: line.totalPriceCents,
        promoCode: line.promoCode ?? null,
      })),
      customerCountry: country,
      promotionsEnabled,
      totalBeforeDiscountsCents: totalBeforeDiscounts,
      customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
      manualDiscountCents: incomingManual,
      discountResponsibility: discountPolicy.discountResponsibility,
      promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
    });

    // Fianza (jetski units)
    const jetskiUnits = lineCreates.filter(l => l.category === "JETSKI").reduce((s, l) => s + l.quantity, 0);
    const main = lineCreates[0];
    const reservationState = deriveCommercialReservationState({
      serviceCategory: main.category,
      jetskiLicenseMode: b.jetskiLicenseMode ?? existing.jetskiLicenseMode,
      isLicense: b.isLicense,
      pricingTier: b.pricingTier ?? existing.pricingTier,
    });
    const depositPerUnit = reservationState.isLicense ? 50000 : 10000;
    const depositCents = depositPerUnit * jetskiUnits;
    const nextRequiredContractUnits = computeRequiredContractUnits({
      quantity: totalMainQuantity,
      isLicense: reservationState.isLicense,
      serviceCategory: main.category,
      items: lineCreates.map((line) => ({
        quantity: line.quantity,
        isExtra: false,
        service: { category: line.category },
      })),
    });

    // Compat main: primer item
    const commercialSnapshot = await getAppliedCommercialSnapshotTx(tx, {
      channelId: b.channelId ?? null,
      serviceId: main.serviceId,
      commissionBaseCents: commercial.commissionBaseCents,
      customerDiscountBaseCents: totalBeforeDiscounts,
      quantity: totalMainQuantity,
    });

    const data: Prisma.ReservationUncheckedUpdateInput = {
      pax: b.pax,
      quantity: totalMainQuantity,
      isLicense: reservationState.isLicense,
      jetskiLicenseMode: reservationState.jetskiLicenseMode,
      pricingTier: reservationState.pricingTier,
      channelId: b.channelId ?? null,
      activityDate,
      scheduledTime,
      companionsCount: Number(b.companionsCount ?? 0),
      depositCents,

      serviceId: main.serviceId,
      optionId: main.optionId,

      basePriceCents: serviceSubtotal,
      commissionBaseCents: commercial.commissionBaseCents,
      appliedCommissionPct: commercialSnapshot.appliedCommissionPct,
      appliedCommissionMode: commercialSnapshot.appliedCommissionMode,
      appliedCommissionValue: commercialSnapshot.appliedCommissionValue,
      appliedCommissionCents: commercialSnapshot.appliedCommissionCents,
      customerDiscountMode: customerDiscountSnapshot.customerDiscountMode,
      customerDiscountValue: customerDiscountSnapshot.customerDiscountValue,
      customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
      autoDiscountCents: commercial.autoDiscountCents,
      manualDiscountCents: commercial.manualDiscountCents,
      discountResponsibility: commercial.discountResponsibility,
      promoterDiscountShareBps: commercial.promoterDiscountShareBps,
      promoterDiscountCents: commercial.promoterDiscountCents,
      companyDiscountCents: commercial.companyDiscountCents,
      manualDiscountReason: b.manualDiscountReason ?? null,
      promoCode: commercial.promoCode,
      totalPriceCents: commercial.finalTotalCents,
    };

    Object.assign(data, buildOptionalData());

    if (!reservationState.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    await tx.reservation.update({ where: { id }, data, select: { id: true } });
    await syncReservationContractsTx(tx, {
      reservationId: id,
      requiredUnits: nextRequiredContractUnits,
      confirmSignedReduction: Boolean(b.confirmSignedContractReduction),
    });
    await syncReservationPlatformUnitsTx(
      tx,
      {
        id,
        quantity: totalMainQuantity,
        isPackParent: existing.isPackParent,
        parentReservationId: existing.parentReservationId,
        serviceCategory: main.category,
        items: lineCreates.map((line) => ({
          quantity: line.quantity,
          isExtra: false,
          service: { category: line.category },
        })),
      },
      desiredReadyAt
    );
    const contracts = await ensureContractsTx(tx, id);

      return { id, ...contracts };
    });
  } catch (error: unknown) {
    return toRouteErrorResponse(error);
  }

  return NextResponse.json({ ok: true, ...result });
}

  // regla de negocio recomendada:
  // - si isLicense=true => deben existir (después del merge)
  // - si isLicense=false => limpiamos (evita datos basura)
  if (requestedReservationState.isLicense) {
    if (!finalLicenseSchool || !finalLicenseType || !finalLicenseNumber) {
      return new NextResponse("Faltan datos de licencia (escuela, tipo y número).", { status: 400 });
    }
  }

  // helper: construir data sin pisar con undefined
  function buildOptionalData() {
    const data: Prisma.ReservationUncheckedUpdateInput = {};

    if (customerPhone !== undefined) data.customerPhone = customerPhone;
    if (customerEmail !== undefined) data.customerEmail = customerEmail;
    if (customerCountry !== undefined) {
      data.customerCountry = customerCountry ? String(customerCountry).toUpperCase() : existing!.customerCountry;
    }
    if (customerAddress !== undefined) data.customerAddress = customerAddress;
    if (customerPostalCode !== undefined) data.customerPostalCode = customerPostalCode;
    if (customerBirthDate !== undefined) data.customerBirthDate = customerBirthDate;
    if (customerDocType !== undefined) data.customerDocType = customerDocType;
    if (customerDocNumber !== undefined) data.customerDocNumber = customerDocNumber;
    if (marketing !== undefined) data.marketing = marketing;

    if (licenseSchool !== undefined) data.licenseSchool = licenseSchool;
    if (licenseType !== undefined) data.licenseType = licenseType;
    if (licenseNumber !== undefined) data.licenseNumber = licenseNumber;

    return data;
  }

  // Si no hay cambio de precio, solo update de campos
  if (!priceSensitiveChanged) {
    if (lockedContractsCount > 0 && !isScheduleOnlyChange && protectedNonScheduleFieldsChanged) {
      return new NextResponse(
        "La reserva tiene contratos preparados o firmados. Solo puedes reagendar fecha y hora sin tocar pax, datos legales ni composición de la reserva.",
        { status: 409 }
      );
    }

    const nextChannelId = b.channelId !== undefined ? b.channelId ?? null : existing.channelId ?? null;
    const currentChannelId = existing.channelId ?? null;
    if (nextChannelId !== currentChannelId) {
      await assertServiceChannelCompatibilityTx(prisma, {
        origin: compatibilityOrigin,
        serviceIds: Array.from(
          new Set(
            (existing.items ?? [])
              .filter((item) => !item.isExtra)
              .map((item) => item.serviceId)
          )
        ),
        channelId: nextChannelId,
      });
    }

    const data: Prisma.ReservationUncheckedUpdateInput = {
      pax: b.pax,
      channelId: b.channelId ?? null,
      activityDate,
      scheduledTime,

      // campos fijos
      isLicense: requestedReservationState.isLicense,
      jetskiLicenseMode: requestedReservationState.jetskiLicenseMode,
      pricingTier: requestedReservationState.pricingTier,
      quantity: b.quantity,
    };

    Object.assign(data, buildOptionalData());

    // Si se desmarca licencia, limpiamos siempre
    if (!requestedReservationState.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    let contracts: { requiredUnits: number; readyCount: number };
    try {
      contracts = await prisma.$transaction(async (tx) => {
        if (scheduledTime) {
        const dayEndExclusiveUtc = new Date(activityDate.getTime() + 24 * 60 * 60 * 1000);
        for (const item of (existing.items ?? []).filter((row) => !row.isExtra)) {
          await assertSlotCapacityOrThrow({
            tx,
            dateStartUtc: activityDate,
            dateEndExclusiveUtc: dayEndExclusiveUtc,
            scheduledStartUtc: scheduledTime,
            category: String(item.service?.category ?? "UNKNOWN").toUpperCase(),
            durationMinutes: Number(item.option?.durationMinutes ?? 30),
            units: Number(item.quantity ?? 0),
            excludeReservationId: id,
          });
        }
      }

        await tx.reservation.update({
          where: { id },
          data,
          select: { id: true },
        });
        return await ensureContractsTx(tx, id);
      });
    } catch (error: unknown) {
      return toRouteErrorResponse(error);
    }

    return NextResponse.json({ ok: true, id, ...contracts });
  }

  if (priceSensitiveChanged && isMultiOrPack) {
    // Evita convertir una multi-actividad en single
    return new NextResponse(
      "Esta reserva tiene varias actividades (o es un pack). No se puede cambiar servicio/duración/cantidad desde aquí.",
      { status: 400 }
    );
  }

  // --- Recalcular como create-quick ---
  const svc = await prisma.service.findUnique({
    where: { id: b.serviceId },
    select: { id: true, category: true },
  });
  if (!svc) return new NextResponse("Servicio no existe", { status: 400 });

  const opt = await prisma.serviceOption.findUnique({
    where: { id: b.optionId },
    select: { id: true, serviceId: true, durationMinutes: true },
  });
  if (!opt) return new NextResponse("Opción no existe", { status: 400 });
  if (opt.serviceId !== svc.id) return new NextResponse("La opción no pertenece al servicio", { status: 400 });

  const reservationState = deriveCommercialReservationState({
    serviceCategory: svc.category ?? null,
    jetskiLicenseMode: b.jetskiLicenseMode ?? existing.jetskiLicenseMode,
    isLicense: b.isLicense,
    pricingTier: b.pricingTier ?? existing.pricingTier,
  });

  if (
    (b.serviceId !== undefined && b.serviceId !== existing.serviceId) ||
    (b.channelId !== undefined && (b.channelId ?? null) !== (existing.channelId ?? null))
  ) {
    await assertServiceChannelCompatibilityTx(prisma, {
      origin: compatibilityOrigin,
      serviceIds: [svc.id],
      channelId: b.channelId ?? existing.channelId ?? null,
    });
  }

  const price = await findActiveServicePrice(prisma, {
    serviceId: svc.id,
    optionId: opt.id,
    durationMinutes: Number(opt.durationMinutes ?? 30),
    now: pricingWhen,
    pricingTier: String(svc.category ?? "").toUpperCase() === "JETSKI" ? reservationState.pricingTier : PricingTier.STANDARD,
  });

  if (!price) return new NextResponse("No hay precio vigente para este servicio/duración.", { status: 400 });

  if (lockedContractsCount > 0) {
    if (existing.serviceId !== b.serviceId || existing.optionId !== b.optionId) {
      if (signedContractsCount > 0) {
        return new NextResponse(
          "La reserva tiene contratos firmados. No puedes cambiar la actividad o duración ya firmada desde esta pantalla.",
          { status: 409 }
        );
      }
    }
  }

  const unitPriceCents = Number(price.basePriceCents) || 0;
  const principalCents = unitPriceCents * Number(b.quantity);

  const depositPerUnit = reservationState.isLicense ? 50000 : 10000;
  const depositCents = depositPerUnit * Number(b.quantity);
  const nextSingleRequiredContractUnits = computeRequiredContractUnits({
    quantity: Number(b.quantity ?? 0),
    isLicense: reservationState.isLicense,
    serviceCategory: svc.category ?? null,
    items: [
      {
        quantity: Number(b.quantity ?? 0),
        isExtra: false,
        service: { category: svc.category ?? null },
      },
    ],
  });

  let result: { id: string; requiredUnits: number; readyCount: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      const effectiveChannelId = b.channelId !== undefined ? b.channelId : existing.channelId;
    const channel = effectiveChannelId
      ? await tx.channel.findUnique({
          where: { id: effectiveChannelId },
          select: {
            allowsPromotions: true,
            customerDiscountMode: true,
            customerDiscountValue: true,
            customerDiscountCents: true,
            discountResponsibility: true,
            promoterDiscountShareBps: true,
          },
        })
      : null;
    const promotionsEnabled = isBoothReservation ? false : (channel ? Boolean(channel.allowsPromotions) : true);
    const discountPolicy = resolveDiscountPolicy({
      responsibility: existing.discountResponsibility,
      promoterDiscountShareBps: existing.promoterDiscountShareBps,
      channel,
    });
    const data: Prisma.ReservationUncheckedUpdateInput = {
      serviceId: svc.id,
      optionId: opt.id,
      channelId: b.channelId ?? null,
      quantity: b.quantity,
      pax: b.pax,
      isLicense: reservationState.isLicense,
      jetskiLicenseMode: reservationState.jetskiLicenseMode,
      pricingTier: reservationState.pricingTier,

      activityDate,
      scheduledTime,
      depositCents,
    };

    Object.assign(data, buildOptionalData());

    // Si se desmarca licencia, limpiamos siempre
    if (!reservationState.isLicense) {
      data.licenseSchool = null;
      data.licenseType = null;
      data.licenseNumber = null;
    }

    await tx.reservation.update({
      where: { id },
      data,
      select: { id: true },
    });

    await tx.reservationItem.deleteMany({
      where: { reservationId: id, isExtra: false },
    });

    await tx.reservationItem.create({
      data: {
        reservationId: id,
        serviceId: svc.id,
        optionId: opt.id,
        servicePriceId: price!.id ?? null,
        quantity: b.quantity,
        pax: b.pax,
        unitPriceCents,
        totalPriceCents: principalCents,
        isExtra: false,
      },
    });

    const mainSum = await tx.reservationItem.aggregate({
      where: { reservationId: id, isExtra: false },
      _sum: { totalPriceCents: true },
    });
    const allSum = await tx.reservationItem.aggregate({
      where: { reservationId: id },
      _sum: { totalPriceCents: true },
    });

    const serviceSubtotal = Number(mainSum._sum.totalPriceCents ?? 0);
    const totalBeforeDiscounts = Number(allSum._sum.totalPriceCents ?? 0);

    const incomingManualDiscountCents = isBoothReservation
      ? getScaledBoothDiscountCents({
          boothUnitDiscountCents,
          nextMatchingQuantity: existing.serviceId === b.serviceId && existing.optionId === b.optionId ? b.quantity : 0,
        })
      : Number(existing.manualDiscountCents ?? 0);
    const customerDiscountSnapshot = resolveCustomerDiscountSnapshot({
      channel,
      quantity: Number(b.quantity),
      baseCents: totalBeforeDiscounts,
    });
    const commercial = await computeReservationCommercialBreakdown({
      when: pricingWhen,
      discountLines: [
        {
          serviceId: svc.id,
          optionId: opt.id,
          category: svc.category ?? null,
          quantity: Number(b.quantity),
          lineBaseCents: serviceSubtotal,
          promoCode: null,
        },
      ],
      customerCountry: customerCountry === undefined ? existing.customerCountry : customerCountry,
      promotionsEnabled,
      totalBeforeDiscountsCents: totalBeforeDiscounts,
      customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
      manualDiscountCents: incomingManualDiscountCents,
      discountResponsibility: discountPolicy.discountResponsibility,
      promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
    });
    const commercialSnapshot = await getAppliedCommercialSnapshotTx(tx, {
      channelId: b.channelId ?? existing.channelId ?? null,
      serviceId: svc.id,
      commissionBaseCents: commercial.commissionBaseCents,
      customerDiscountBaseCents: totalBeforeDiscounts,
      quantity: Number(b.quantity),
    });

    await tx.reservation.update({
      where: { id },
      data: {
        basePriceCents: serviceSubtotal,
        commissionBaseCents: commercial.commissionBaseCents,
        appliedCommissionPct: commercialSnapshot.appliedCommissionPct,
        appliedCommissionMode: commercialSnapshot.appliedCommissionMode,
        appliedCommissionValue: commercialSnapshot.appliedCommissionValue,
        appliedCommissionCents: commercialSnapshot.appliedCommissionCents,
        customerDiscountMode: customerDiscountSnapshot.customerDiscountMode,
        customerDiscountValue: customerDiscountSnapshot.customerDiscountValue,
        customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
        autoDiscountCents: commercial.autoDiscountCents,
        manualDiscountCents: commercial.manualDiscountCents,
        discountResponsibility: commercial.discountResponsibility,
        promoterDiscountShareBps: commercial.promoterDiscountShareBps,
        promoterDiscountCents: commercial.promoterDiscountCents,
        companyDiscountCents: commercial.companyDiscountCents,
        promoCode: commercial.promoCode,
        totalPriceCents: commercial.finalTotalCents,
      },
      select: { id: true },
    });
    await syncReservationContractsTx(tx, {
      reservationId: id,
      requiredUnits: nextSingleRequiredContractUnits,
      confirmSignedReduction: Boolean(b.confirmSignedContractReduction),
    });
    await syncReservationPlatformUnitsTx(
      tx,
      {
        id,
        quantity: Number(b.quantity ?? 0),
        isPackParent: existing.isPackParent,
        parentReservationId: existing.parentReservationId,
        serviceCategory: svc.category ?? null,
        items: [
          {
            quantity: Number(b.quantity ?? 0),
            isExtra: false,
            service: { category: svc.category ?? null },
          },
        ],
      },
      desiredReadyAt
    );
    const contracts = await ensureContractsTx(tx, id);

      return { id, ...contracts };
    });
  } catch (error: unknown) {
    return toRouteErrorResponse(error);
  }

  return NextResponse.json({ ok: true, ...result });
}

