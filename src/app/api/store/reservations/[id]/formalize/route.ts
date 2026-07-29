import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { JetskiLicenseMode, PricingTier, ReservationStatus, type Prisma } from "@prisma/client";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { validateReusableAssetsAvailability } from "@/lib/store-rental-assets";
import { computeDepositFromResolvedItems } from "@/lib/reservation-deposits";
import {
  resolveReservationLicenseDetails,
  type ReservationLicenseContractLike,
} from "@/lib/reservation-formalization";
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
  resolveManualDiscountCentsForQuantityChange,
  sumMainReservationQuantity,
} from "@/lib/manual-discount-proration";
import {
  ReservationContractSyncBlockedError,
  syncReservationContractsTx,
} from "@/lib/reservation-contract-sync";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";
import {
  deleteRemovedReservationMainItemsTx,
  replaceReservationMainItemsTx,
} from "@/lib/reservations/replaceReservationMainItems";
import { buildReservationContractProgressForTargets } from "@/lib/contracts/reservation-contract-progress";
import { syncReservationPlatformUnitsTx } from "@/lib/reservation-platform";
import { assertSlotCapacityOrThrow } from "@/lib/slot-capacity";
import { assertServiceChannelCompatibilityTx } from "@/lib/service-channel-availability";
import { getRequestOperationalContext, writeOperationalLog } from "@/lib/operational-log";
import { syncChannelCommissionLineFromReservationTx } from "@/lib/channel-commission-lines";
import {
  commercialPricingStateChanged,
  hasExplicitPromoCodeChange,
  isReservationCoveredByPrepaidVoucher,
  netPaidServiceCents,
  resolvePrepaidVoucherCommercialChange,
  shouldPreserveFormalizeCommercialSnapshot,
} from "@/lib/reservation-commercial-snapshot";
import {
  SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE,
  resolveSignedContractMaterialChangePolicy,
} from "@/lib/signed-contract-formalization";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

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
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().optional().nullable(),
  customerCountry: z.string().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  customerPostalCode: z.string().optional().nullable(),
  customerBirthDate: z.string().datetime().optional().nullable(),
  customerDocType: z.string().optional().nullable(),
  customerDocNumber: z.string().optional().nullable(),
  marketing: z.string().optional().nullable(),
  serviceId: z.string().min(1).optional(),
  optionId: z.string().min(1).optional(),
  channelId: z.string().optional().nullable(),
  quantity: z.number().int().min(1).max(20).optional(),
  pax: z.number().int().min(1).max(20).optional(),
  isLicense: z.boolean().optional(),
  jetskiLicenseMode: z.nativeEnum(JetskiLicenseMode).optional(),
  pricingTier: z.nativeEnum(PricingTier).optional(),
  licenseSchool: z.string().optional().nullable(),
  licenseType: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  companionsCount: z.number().int().min(0).max(20).optional(),
  items: z.array(ItemBody).optional(),
  confirmSignedContractReduction: z.boolean().optional(),
  recalculatePricing: z.boolean().optional(),
});

function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  if (t === "-") return null;
  return t.length ? t : null;
}

function normalizeComparableOptionalString(value: string | null | undefined) {
  return normalizeOptionalString(value) ?? null;
}

function dateKey(value: Date | null | undefined) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function sameStringOrFallback(
  next: string | null | undefined,
  current: string | null | undefined,
  fallback?: string | null
) {
  const normalizedNext = normalizeComparableOptionalString(next);
  const normalizedFallback = normalizeComparableOptionalString(fallback);
  return (
    normalizedNext === normalizeComparableOptionalString(current) ||
    (normalizedFallback !== null && normalizedNext === normalizedFallback)
  );
}

function sameCountryOrFallback(
  next: string | null | undefined,
  current: string | null | undefined,
  fallback?: string | null
) {
  const normalizeCountry = (value: string | null | undefined) =>
    normalizeComparableOptionalString(value)?.toUpperCase() ?? null;
  const normalizedNext = normalizeCountry(next);
  const normalizedFallback = normalizeCountry(fallback);
  return (
    normalizedNext === normalizeCountry(current) ||
    (normalizedFallback !== null && normalizedNext === normalizedFallback)
  );
}

function sameDateOrFallback(
  next: Date | null | undefined,
  current: Date | null | undefined,
  fallback?: Date | null
) {
  const normalizedNext = dateKey(next);
  const normalizedFallback = dateKey(fallback);
  return (
    normalizedNext === dateKey(current) ||
    (normalizedFallback !== null && normalizedNext === normalizedFallback)
  );
}

function sameInstant(a: Date | null | undefined, b: Date | null | undefined) {
  const at = a?.getTime() ?? null;
  const bt = b?.getTime() ?? null;
  return at === bt;
}

function sameCents(a: number | null | undefined, b: number | null | undefined) {
  return Number(a ?? 0) === Number(b ?? 0);
}

function fallbackOptionalString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) return normalized;
  }
  return null;
}

function toYmdInTz(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${day}`;
}

function toHmInTz(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

function firstIssueMessage(err: z.ZodError) {
  const issue = err.issues[0];
  if (!issue) return "Datos inválidos";
  const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
  return `Datos inválidos (${path}${issue.message})`;
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
  if (error instanceof ReservationContractSyncBlockedError) {
    return NextResponse.json(
      { error: error.code, message: error.message, blockers: error.blockers },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "Error";
  if (message.startsWith("CONFIGURATION_REQUIRED:")) {
    return NextResponse.json(
      { error: "CONFIGURATION_REQUIRED", message: message.replace(/^CONFIGURATION_REQUIRED:\s*/, "") },
      { status: 409 }
    );
  }
  if (
    message.includes("Slot completo") ||
    message.includes("No caben") ||
    message.includes("Hora fuera de horario")
  ) {
    return new NextResponse(message, { status: 409 });
  }
  if (message === SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE) {
    return new NextResponse(message, { status: 409 });
  }
  return new NextResponse(
    message.replace(/^CONFIRM_SIGNED_CONTRACT_REDUCTION:\s*/, ""),
    { status: message.startsWith("CONFIRM_SIGNED_CONTRACT_REDUCTION:") ? 409 : 400 }
  );
}

type ReservationContractSnapshot = {
  id: string;
  reservationItemId?: string | null;
  unitIndex: number | null;
  logicalUnitIndex: number | null;
  status: string | null;
  supersededAt: Date | null;
  createdAt: Date;
  driverName: string | null;
  driverPhone: string | null;
  driverEmail: string | null;
  driverCountry: string | null;
  driverAddress: string | null;
  driverPostalCode: string | null;
  driverBirthDate: Date | null;
  driverDocType: string | null;
  driverDocNumber: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
};

function computeContractProgress(args: {
  quantity: number | null | undefined;
  isLicense: boolean;
  serviceId?: string | null;
  optionId?: string | null;
  serviceName?: string | null;
  durationMinutes?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  serviceCategory?: string | null;
  items: Array<{
    id?: string | null;
    serviceId?: string | null;
    optionId?: string | null;
    quantity: number | null | undefined;
    pax?: number | null;
    totalPriceCents?: number | null;
    isExtra?: boolean | null;
    service?: { name?: string | null; category?: string | null } | null;
    option?: { durationMinutes?: number | null } | null;
  }>;
  contracts: ReservationContractSnapshot[];
}) {
  const contractRequirements = buildReservationContractRequirements({
    quantity: args.quantity ?? 0,
    isLicense: args.isLicense,
    serviceCategory: args.serviceCategory ?? null,
    serviceId: args.serviceId ?? null,
    optionId: args.optionId ?? null,
    serviceName: args.serviceName ?? null,
    durationMinutes: args.durationMinutes ?? null,
    pax: args.pax ?? null,
    totalPriceCents: args.totalPriceCents ?? null,
    items: args.items,
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const progress = buildReservationContractProgressForTargets(args.contracts, syncTargets);
  return {
    requiredUnits: progress.requiredUnits,
    readyCount: progress.readyCount,
    visibleContracts: progress.contracts,
  };
}

function buildCommercialShape(
  items: Array<{
    serviceId: string;
    optionId: string | null;
    quantity: number | null | undefined;
  }>
) {
  return items
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId ?? "",
      quantity: Number(item.quantity ?? 0),
    }))
    .sort((a, b) =>
      a.serviceId.localeCompare(b.serviceId) ||
      a.optionId.localeCompare(b.optionId) ||
      a.quantity - b.quantity
    );
}

function sameCommercialShape(
  left: ReturnType<typeof buildCommercialShape>,
  right: ReturnType<typeof buildCommercialShape>
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildContractContentShape(
  items: Array<{
    serviceId: string;
    optionId: string | null;
    quantity: number | null | undefined;
    pax: number | null | undefined;
  }>
) {
  return items
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId ?? "",
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

function sameContractContentShape(
  left: ReturnType<typeof buildContractContentShape>,
  right: ReturnType<typeof buildContractContentShape>
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function ensureContractsTx(tx: Prisma.TransactionClient, reservationId: string) {
  const res = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      quantity: true,
      isLicense: true,
      serviceId: true,
      optionId: true,
      pax: true,
      totalPriceCents: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          totalPriceCents: true,
          isExtra: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
        },
      },
      contracts: {
        select: {
          id: true,
          reservationItemId: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!res) throw new Error("Reserva no existe");

  const contractRequirements = buildReservationContractRequirements({
    quantity: res.quantity ?? 0,
    isLicense: Boolean(res.isLicense),
    serviceCategory: res.service?.category ?? null,
    serviceId: res.serviceId,
    optionId: res.optionId,
    serviceName: res.service?.name ?? null,
    durationMinutes: res.option?.durationMinutes ?? null,
    pax: res.pax,
    totalPriceCents: res.totalPriceCents,
    items: res.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const requiredUnits = contractRequirements.length;

  if (requiredUnits <= 0) return { requiredUnits: 0, readyCount: 0 };

  const existingContracts = res.contracts ?? [];
  const hasUnitOne = existingContracts.some((c) => Number(c.unitIndex) === 1);

  if (!hasUnitOne) {
    const legacyPrimary = existingContracts
      .filter((c) => Number(c.unitIndex) <= 0)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    if (legacyPrimary) {
      await tx.reservationContract.update({
        where: { id: legacyPrimary.id },
        data: { unitIndex: 1, logicalUnitIndex: 1 },
      });
    }
  }

  await syncReservationContractsTx(tx, {
    reservationId,
    requiredUnits,
    targets: syncTargets,
  });

  const all = await tx.reservationContract.findMany({
    where: { reservationId },
    orderBy: { unitIndex: "asc" },
    select: {
      id: true,
      reservationItemId: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
    },
  });

  const readyCount = buildReservationContractProgressForTargets(all, syncTargets).readyCount;

  return { requiredUnits, readyCount };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const requestContext = getRequestOperationalContext(req);
  const auditSource = session.role === "ADMIN" ? "ADMIN" : "STORE";

  const { id } = await Promise.resolve(ctx.params);

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse(firstIssueMessage(parsed.error), { status: 400 });

  const b = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          status: true,
          formalizedAt: true,
          giftVoucherId: true,
          passVoucherId: true,
          passConsumeId: true,
          isPackParent: true,
          parentReservationId: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          customerCountry: true,
          customerAddress: true,
          customerPostalCode: true,
          customerBirthDate: true,
          customerDocType: true,
          customerDocNumber: true,
          marketing: true,
          serviceId: true,
          optionId: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
          channelId: true,
          quantity: true,
          pax: true,
          isLicense: true,
          jetskiLicenseMode: true,
          pricingTier: true,
          basePriceCents: true,
          totalPriceCents: true,
          depositCents: true,
          commissionBaseCents: true,
          appliedCommissionPct: true,
          appliedCommissionMode: true,
          appliedCommissionValue: true,
          appliedCommissionCents: true,
          customerDiscountMode: true,
          customerDiscountValue: true,
          customerDiscountCents: true,
          autoDiscountCents: true,
          companionsCount: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          manualDiscountCents: true,
          promoCode: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
          promoterDiscountCents: true,
          companyDiscountCents: true,
          activityDate: true,
          scheduledTime: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              serviceId: true,
              optionId: true,
              servicePriceId: true,
              quantity: true,
              pax: true,
              isExtra: true,
              unitPriceCents: true,
              totalPriceCents: true,
              service: {
                select: {
                  category: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          contracts: {
            orderBy: { unitIndex: "asc" },
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
          payments: {
            select: {
              amountCents: true,
              isDeposit: true,
              direction: true,
            },
          },
        },
      });

      if (!current) throw new Error("Reserva no existe");

      if (current.status === ReservationStatus.COMPLETED || current.status === ReservationStatus.CANCELED) {
        return { ok: false as const, id, isHistorical: true };
      }

      const compatibilityOrigin = current.source === "BOOTH" ? "BOOTH" : "STORE";

      const currentContractProgress = computeContractProgress({
        quantity: current.quantity,
        isLicense: Boolean(current.isLicense),
        serviceCategory: current.service?.category ?? null,
        serviceId: current.serviceId,
        optionId: current.optionId,
        serviceName: current.service?.name ?? null,
        durationMinutes: current.option?.durationMinutes ?? null,
        pax: current.pax,
        totalPriceCents: current.totalPriceCents,
        items: current.items ?? [],
        contracts: current.contracts,
      });

      if (current.formalizedAt) {
        return {
          ok: true as const,
          id,
          requiredUnits: currentContractProgress.requiredUnits,
          readyCount: currentContractProgress.readyCount,
          alreadyFormalized: true as const,
        };
      }

      const explicitRecalculatePricing = Boolean(b.recalculatePricing);
      if (explicitRecalculatePricing && session.role !== "ADMIN") {
        throw new Error("Solo un administrador puede recalcular el precio al formalizar.");
      }
      const paidServiceCents = netPaidServiceCents(current.payments);
      const isPrepaidVoucherReservation = isReservationCoveredByPrepaidVoucher(current);
      const hasCommercialLineSnapshots =
        (current.items ?? []).length > 0 || isPrepaidVoucherReservation;
      const preserveCommercialSnapshot =
        shouldPreserveFormalizeCommercialSnapshot({
          snapshot: current,
          payments: current.payments,
          explicitRecalculate: explicitRecalculatePricing,
        }) && (hasCommercialLineSnapshots || paidServiceCents > 0);

      const tz = BUSINESS_TZ;
      const activityDateYmd = b.activityDate ?? toYmdInTz(current.activityDate, tz);
      const timeHm =
        b.time !== undefined
          ? (b.time ?? null)
          : (current.scheduledTime ? toHmInTz(current.scheduledTime, tz) : null);

      const activityDate = utcDateFromYmdInTz(tz, activityDateYmd);
      const scheduledTime = utcDateTimeFromYmdHmInTz(tz, activityDateYmd, timeHm ?? null);
      const pricingWhen = scheduledTime ?? activityDate;

      const customerName =
        normalizeOptionalString(b.customerName) ??
        normalizeOptionalString(current.customerName) ??
        "";
      const primaryContract =
        currentContractProgress.visibleContracts[0] ??
        current.contracts[0] ??
        null;
      const signedContractsCount = currentContractProgress.visibleContracts.filter(
        (contract) => contract.status === "SIGNED"
      ).length;
      const completeLicenseContractFallback =
        currentContractProgress.visibleContracts.find(
          (contract) =>
            Boolean(String(contract.licenseSchool ?? "").trim()) &&
            Boolean(String(contract.licenseType ?? "").trim()) &&
            Boolean(String(contract.licenseNumber ?? "").trim())
        ) ?? null;
      const contractCompatibilityFallback = !current.formalizedAt ? primaryContract : null;
      const customerPhone =
        b.customerPhone !== undefined
          ? normalizeOptionalString(b.customerPhone)
          : fallbackOptionalString(current.customerPhone, contractCompatibilityFallback?.driverPhone);
      const customerEmail =
        b.customerEmail !== undefined
          ? normalizeOptionalString(b.customerEmail)
          : fallbackOptionalString(current.customerEmail, contractCompatibilityFallback?.driverEmail);
      const customerCountry =
        b.customerCountry !== undefined
          ? normalizeOptionalString(b.customerCountry)
          : fallbackOptionalString(current.customerCountry, contractCompatibilityFallback?.driverCountry);
      const customerAddress =
        b.customerAddress !== undefined
          ? normalizeOptionalString(b.customerAddress)
          : fallbackOptionalString(current.customerAddress, contractCompatibilityFallback?.driverAddress);
      const customerPostalCode =
        b.customerPostalCode !== undefined
          ? normalizeOptionalString(b.customerPostalCode)
          : fallbackOptionalString(current.customerPostalCode, contractCompatibilityFallback?.driverPostalCode);
      const customerBirthDate =
        b.customerBirthDate !== undefined
          ? (b.customerBirthDate ? new Date(b.customerBirthDate) : null)
          : current.customerBirthDate ?? contractCompatibilityFallback?.driverBirthDate ?? null;
      const customerDocType =
        b.customerDocType !== undefined
          ? normalizeOptionalString(b.customerDocType)
          : fallbackOptionalString(current.customerDocType, contractCompatibilityFallback?.driverDocType);
      const customerDocNumber =
        b.customerDocNumber !== undefined
          ? normalizeOptionalString(b.customerDocNumber)
          : fallbackOptionalString(current.customerDocNumber, contractCompatibilityFallback?.driverDocNumber);
      const marketing = normalizeOptionalString(
        b.marketing !== undefined ? b.marketing : current.marketing
      );

      const companionsCount = Number(b.companionsCount ?? current.companionsCount ?? 0);

      const candidateItems =
        Array.isArray(b.items) && b.items.length > 0
          ? b.items
          : (current.items ?? []).filter((item) => !item.isExtra).map((item) => ({
              serviceId: item.serviceId,
              optionId: item.optionId ?? current.optionId,
              quantity: Number(item.quantity ?? 1),
              pax: Number(item.pax ?? current.pax ?? 1),
              promoCode: null,
            }));

      if (!candidateItems.length) {
        candidateItems.push({
          serviceId: b.serviceId ?? current.serviceId,
          optionId: b.optionId ?? current.optionId,
          quantity: Number(b.quantity ?? current.quantity ?? 1),
          pax: Number(b.pax ?? current.pax ?? 1),
          promoCode: null,
        });
      }

      const currentCommercialShapeSource = (current.items ?? [])
        .filter((item) => !item.isExtra)
        .map((item) => ({
          serviceId: item.serviceId,
          optionId: item.optionId ?? current.optionId,
          quantity: item.quantity,
        }));
      const currentContractShapeSource = (current.items ?? [])
        .filter((item) => !item.isExtra)
        .map((item) => ({
          serviceId: item.serviceId,
          optionId: item.optionId ?? current.optionId,
          quantity: item.quantity,
          pax: item.pax ?? current.pax,
        }));
      const currentCommercialShape = buildCommercialShape(
        currentCommercialShapeSource.length > 0
          ? currentCommercialShapeSource
          : [{ serviceId: current.serviceId, optionId: current.optionId, quantity: current.quantity }]
      );
      const currentContractShape = buildContractContentShape(
        currentContractShapeSource.length > 0
          ? currentContractShapeSource
          : [{
              serviceId: current.serviceId,
              optionId: current.optionId,
              quantity: current.quantity,
              pax: current.pax,
            }]
      );
      const requestedCommercialShape = buildCommercialShape(
        candidateItems.map((item) => ({
          serviceId: item.serviceId,
          optionId: item.optionId,
          quantity: item.quantity,
        }))
      );
      const requestedContractShape = buildContractContentShape(
        candidateItems.map((item) => ({
          serviceId: item.serviceId,
          optionId: item.optionId,
          quantity: item.quantity,
          pax: item.pax,
        }))
      );
      const commercialShapeChanged = !sameCommercialShape(currentCommercialShape, requestedCommercialShape);
      const contractCompositionChanged = !sameContractContentShape(currentContractShape, requestedContractShape);
      const rawRequestedChannelId =
        b.channelId !== undefined ? b.channelId ?? null : current.channelId ?? null;
      const rawLicensePricingChanged = commercialPricingStateChanged({
        current: {
          serviceCategory: current.service?.category ?? null,
          isLicense: current.isLicense,
          jetskiLicenseMode: current.jetskiLicenseMode,
          pricingTier: current.pricingTier,
        },
        requested: {
          serviceCategory: current.service?.category ?? null,
          isLicense: b.isLicense ?? current.isLicense,
          jetskiLicenseMode: b.jetskiLicenseMode ?? current.jetskiLicenseMode,
          pricingTier: b.pricingTier ?? current.pricingTier,
        },
      });
      const commercialChange = resolvePrepaidVoucherCommercialChange({
        isPrepaidVoucherReservation,
        currentChannelId: current.channelId,
        requestedChannelId: rawRequestedChannelId,
        commercialPricingChanged: rawLicensePricingChanged,
      });
      const effectiveRequestedChannelId = commercialChange.effectiveRequestedChannelId;
      const channelChanged = commercialChange.channelChanged;
      const licensePricingChanged = commercialChange.commercialPricingChanged;
      const promoCodeChanged =
        current.source === "BOOTH"
          ? false
          : hasExplicitPromoCodeChange({
              currentPromoCode: current.promoCode,
              requestedPromoCodes: candidateItems.map((item) => item.promoCode),
            });
      const requestedCommercialState = {
        jetskiLicenseMode: isPrepaidVoucherReservation
          ? current.jetskiLicenseMode
          : b.jetskiLicenseMode ?? current.jetskiLicenseMode,
        isLicense: isPrepaidVoucherReservation
          ? current.isLicense
          : b.isLicense ?? current.isLicense,
        pricingTier: isPrepaidVoucherReservation
          ? current.pricingTier
          : b.pricingTier ?? current.pricingTier,
      };
      const customerLegalFieldsChanged =
        !sameStringOrFallback(customerName, current.customerName, primaryContract?.driverName) ||
        !sameStringOrFallback(customerPhone, current.customerPhone, primaryContract?.driverPhone) ||
        !sameStringOrFallback(customerEmail, current.customerEmail, primaryContract?.driverEmail) ||
        !sameCountryOrFallback(customerCountry, current.customerCountry, primaryContract?.driverCountry) ||
        !sameStringOrFallback(customerAddress, current.customerAddress, primaryContract?.driverAddress) ||
        !sameStringOrFallback(customerPostalCode, current.customerPostalCode, primaryContract?.driverPostalCode) ||
        !sameDateOrFallback(customerBirthDate, current.customerBirthDate, primaryContract?.driverBirthDate) ||
        !sameStringOrFallback(customerDocType, current.customerDocType, primaryContract?.driverDocType) ||
        !sameStringOrFallback(customerDocNumber, current.customerDocNumber, primaryContract?.driverDocNumber) ||
        normalizeComparableOptionalString(marketing) !== normalizeComparableOptionalString(current.marketing);
      const requestedLicenseSchool =
        b.licenseSchool !== undefined ? normalizeOptionalString(b.licenseSchool) : current.licenseSchool;
      const requestedLicenseType =
        b.licenseType !== undefined ? normalizeOptionalString(b.licenseType) : current.licenseType;
      const requestedLicenseNumber =
        b.licenseNumber !== undefined ? normalizeOptionalString(b.licenseNumber) : current.licenseNumber;
      const licenseFieldsChanged =
        !sameStringOrFallback(requestedLicenseSchool, current.licenseSchool, completeLicenseContractFallback?.licenseSchool) ||
        !sameStringOrFallback(requestedLicenseType, current.licenseType, completeLicenseContractFallback?.licenseType) ||
        !sameStringOrFallback(requestedLicenseNumber, current.licenseNumber, completeLicenseContractFallback?.licenseNumber);
      const companionsChanged =
        Number(current.companionsCount ?? 0) !== Number(companionsCount ?? 0);
      const protectedNonScheduleFieldsChanged =
        channelChanged ||
        licensePricingChanged ||
        promoCodeChanged ||
        companionsChanged ||
        customerLegalFieldsChanged ||
        licenseFieldsChanged;
      const scheduleChanged =
        !sameInstant(current.activityDate, activityDate) ||
        !sameInstant(current.scheduledTime, scheduledTime);
      const signedContractMaterialPolicy = resolveSignedContractMaterialChangePolicy({
        hasSignedContracts: signedContractsCount > 0,
        scheduleChanged,
        compositionChanged: contractCompositionChanged,
        protectedNonScheduleFieldsChanged,
      });

      if (signedContractMaterialPolicy.signedContractBlockingChange) {
        throw new Error(SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE);
      }

      if (preserveCommercialSnapshot && (commercialShapeChanged || channelChanged || licensePricingChanged || promoCodeChanged)) {
        throw new Error(
          "La reserva tiene snapshot comercial o pagos asociados. Formalizar conserva precio, promoción y comisión; usa una acción explícita de recálculo para cambiar actividad, cantidad, canal o tarifa."
        );
      }

      if (!customerName) throw new Error("Nombre requerido.");
      if (!customerCountry || customerCountry.trim().length < 2) throw new Error("Pais requerido para formalizar.");
      if (customerEmail && !z.string().email().safeParse(customerEmail).success) {
        throw new Error("Email invalido para formalizar.");
      }
      if (!Number.isFinite(companionsCount) || companionsCount < 0 || companionsCount > 20) {
        throw new Error("Acompanantes invalido.");
      }

      const serviceIds = Array.from(new Set(candidateItems.map((item) => item.serviceId)));
      const optionIds = Array.from(new Set(candidateItems.map((item) => item.optionId)));
      const [services, options] = await Promise.all([
        tx.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, name: true, code: true, category: true },
        }),
        tx.serviceOption.findMany({
          where: { id: { in: optionIds } },
          select: { id: true, serviceId: true, durationMinutes: true },
        }),
      ]);

      const svcById = new Map(services.map((service) => [service.id, service]));
      const optById = new Map(options.map((option) => [option.id, option]));

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
        serviceName: string | null;
        serviceCode: string | null;
      }> = [];

      const currentMainItemSnapshots = new Map(
        (current.items ?? [])
          .filter((item) => !item.isExtra)
          .map((item) => [`${item.serviceId}::${item.optionId ?? ""}`, item])
      );

      for (const item of candidateItems) {
        const qty = Number(item.quantity ?? 0);
        const pax = Number(item.pax ?? 0);
        const linePromoCode =
          current.source === "BOOTH"
            ? null
            : (String(item.promoCode ?? current.promoCode ?? "").trim().toUpperCase() || null);
        if (!Number.isFinite(qty) || qty < 1 || qty > 99) throw new Error("Cantidad invalida.");
        if (!Number.isFinite(pax) || pax < 1 || pax > 50) throw new Error("PAX invalido.");

        const service = svcById.get(item.serviceId);
        if (!service) throw new Error("Servicio no existe.");

        const option = optById.get(item.optionId);
        if (!option) throw new Error("Opción no existe.");
        if (option.serviceId !== service.id) throw new Error("La opción no pertenece al servicio.");

        const lineState = deriveCommercialReservationState({
          serviceCategory: service.category ?? null,
          jetskiLicenseMode: requestedCommercialState.jetskiLicenseMode,
          isLicense: requestedCommercialState.isLicense,
          pricingTier: requestedCommercialState.pricingTier,
        });
        const isVoucherIncludedBaseLine =
          isPrepaidVoucherReservation &&
          item.serviceId === current.serviceId &&
          item.optionId === current.optionId;
        if (isVoucherIncludedBaseLine) {
          lineCreates.push({
            serviceId: service.id,
            optionId: option.id,
            durationMinutes: Number(option.durationMinutes ?? 30),
            quantity: qty,
            pax,
            promoCode: linePromoCode,
            servicePriceId: null,
            unitPriceCents: 0,
            totalPriceCents: 0,
            category: String(service.category ?? "").toUpperCase(),
            serviceName: service.name ?? null,
            serviceCode: service.code ?? null,
          });
          continue;
        }

        if (preserveCommercialSnapshot) {
          const frozenItem = currentMainItemSnapshots.get(`${service.id}::${option.id}`) ?? null;
          lineCreates.push({
            serviceId: service.id,
            optionId: option.id,
            durationMinutes: Number(option.durationMinutes ?? 30),
            quantity: qty,
            pax,
            promoCode: linePromoCode,
            servicePriceId: frozenItem?.servicePriceId ?? null,
            unitPriceCents: Number(frozenItem?.unitPriceCents ?? 0),
            totalPriceCents: Number(frozenItem?.totalPriceCents ?? 0),
            category: String(service.category ?? "").toUpperCase(),
            serviceName: service.name ?? null,
            serviceCode: service.code ?? null,
          });
          continue;
        }

        const price = await findActiveServicePrice(tx, {
          serviceId: service.id,
          optionId: option.id,
          durationMinutes: Number(option.durationMinutes ?? 30),
          now: pricingWhen,
          pricingTier:
            String(service.category ?? "").toUpperCase() === "JETSKI"
              ? lineState.pricingTier
              : PricingTier.STANDARD,
        });

        if (!price) throw new Error("Este servicio/opción no tiene precio vigente (Admin > Precios).");

        const unitPriceCents = Number(price.basePriceCents) || 0;
        lineCreates.push({
          serviceId: service.id,
          optionId: option.id,
          durationMinutes: Number(option.durationMinutes ?? 30),
          quantity: qty,
          pax,
          promoCode: linePromoCode,
          servicePriceId: price.id ?? null,
          unitPriceCents,
          totalPriceCents: unitPriceCents * qty,
          category: String(service.category ?? "").toUpperCase(),
          serviceName: service.name ?? null,
          serviceCode: service.code ?? null,
        });
      }

      const nextServiceIds = Array.from(new Set(lineCreates.map((line) => line.serviceId))).sort();
      const currentMainServiceIdsSource = (current.items ?? [])
        .filter((item) => !item.isExtra)
        .map((item) => item.serviceId);
      const currentServiceIds = Array.from(
        new Set(currentMainServiceIdsSource.length > 0 ? currentMainServiceIdsSource : [current.serviceId])
      ).sort();
      const shouldValidateCompatibility =
        JSON.stringify(nextServiceIds) !== JSON.stringify(currentServiceIds) ||
        (effectiveRequestedChannelId ?? null) !== (current.channelId ?? null);

      if (shouldValidateCompatibility) {
        await assertServiceChannelCompatibilityTx(tx, {
          origin: compatibilityOrigin,
          serviceIds: nextServiceIds,
          channelId: effectiveRequestedChannelId,
        });
      }

      await validateReusableAssetsAvailability({
        tx,
        items: lineCreates.map((line) => ({
          quantity: line.quantity,
          service: {
            name: line.serviceName,
            code: line.serviceCode,
            category: line.category,
          },
        })),
      });

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
            excludeReservationId: current.id,
          });
        }
      }

      const serviceSubtotal = lineCreates.reduce((sum, line) => sum + line.totalPriceCents, 0);
      const extrasTotal = (current.items ?? [])
        .filter((item) => item.isExtra)
        .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);
      const totalBeforeDiscounts = serviceSubtotal + extrasTotal;

      const effectiveChannelId = effectiveRequestedChannelId;
      const totalMainQuantity = lineCreates.reduce(
        (sum, line) => sum + Number(line.quantity ?? 0),
        0
      );
      const currentMainQuantity = sumMainReservationQuantity(current.items ?? [], current.quantity);

      let customerDiscountSnapshot = {
        customerDiscountMode: current.customerDiscountMode,
        customerDiscountValue: Number(current.customerDiscountValue ?? 0),
        customerDiscountCents: Number(current.customerDiscountCents ?? 0),
      };
      let commercial = {
        finalTotalCents: Number(current.totalPriceCents ?? 0),
        commissionBaseCents: Number(current.commissionBaseCents ?? 0),
        autoDiscountCents: Number(current.autoDiscountCents ?? 0),
        manualDiscountCents: Number(current.manualDiscountCents ?? 0),
        discountResponsibility: current.discountResponsibility,
        promoterDiscountShareBps: Number(current.promoterDiscountShareBps ?? 0),
        promoterDiscountCents: Number(current.promoterDiscountCents ?? 0),
        companyDiscountCents: Number(current.companyDiscountCents ?? 0),
        promoCode: current.promoCode ?? null,
      };

      if (!preserveCommercialSnapshot) {
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
        const promotionsEnabled = current.source === "BOOTH" ? false : (channel ? Boolean(channel.allowsPromotions) : true);
        const discountPolicy = resolveDiscountPolicy({
          responsibility: current.discountResponsibility,
          promoterDiscountShareBps: current.promoterDiscountShareBps,
          channel,
        });

        const boothUnitDiscountCents = getBoothUnitDiscountCents({
          source: current.source,
          matchingQuantity: current.quantity,
          manualDiscountCents: current.manualDiscountCents,
        });
        const originalLineKey = `${current.serviceId}::${current.optionId}`;
        const matchingBoothLineQty = lineCreates.reduce(
          (sum, line) =>
            `${line.serviceId}::${line.optionId}` === originalLineKey
              ? sum + Number(line.quantity ?? 0)
              : sum,
          0
        );
        const incomingManualDiscountCents =
          current.source === "BOOTH"
            ? getScaledBoothDiscountCents({
                boothUnitDiscountCents,
                nextMatchingQuantity: matchingBoothLineQty,
              })
            : resolveManualDiscountCentsForQuantityChange({
                currentManualDiscountCents: current.manualDiscountCents,
                oldQuantity: currentMainQuantity,
                newQuantity: totalMainQuantity,
                newSubtotalCents: totalBeforeDiscounts,
              });
        customerDiscountSnapshot = resolveCustomerDiscountSnapshot({
          channel,
          quantity: totalMainQuantity,
          baseCents: totalBeforeDiscounts,
        });

        commercial = await computeReservationCommercialBreakdown({
          when: pricingWhen,
          discountLines: lineCreates.map((line) => ({
            serviceId: line.serviceId,
            optionId: line.optionId,
            category: line.category,
            quantity: line.quantity,
            lineBaseCents: line.totalPriceCents,
            promoCode: promotionsEnabled ? line.promoCode : null,
          })),
          customerCountry: customerCountry.toUpperCase(),
          promotionsEnabled,
          totalBeforeDiscountsCents: totalBeforeDiscounts,
          customerDiscountCents: customerDiscountSnapshot.customerDiscountCents,
          manualDiscountCents: incomingManualDiscountCents,
          discountResponsibility: discountPolicy.discountResponsibility,
          promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
        });
      }

      const commercialContractContentChanged =
        !preserveCommercialSnapshot &&
        (!sameCents(current.basePriceCents, serviceSubtotal) ||
          !sameCents(current.commissionBaseCents, commercial.commissionBaseCents) ||
          !sameCents(current.totalPriceCents, commercial.finalTotalCents) ||
          !sameCents(current.autoDiscountCents, commercial.autoDiscountCents) ||
          !sameCents(current.manualDiscountCents, commercial.manualDiscountCents) ||
          !sameCents(current.customerDiscountCents, customerDiscountSnapshot.customerDiscountCents) ||
          !sameCents(current.promoterDiscountCents, commercial.promoterDiscountCents) ||
          !sameCents(current.companyDiscountCents, commercial.companyDiscountCents) ||
          normalizeComparableOptionalString(current.promoCode) !==
            normalizeComparableOptionalString(commercial.promoCode));
      const commercialSignedContractMaterialPolicy = resolveSignedContractMaterialChangePolicy({
        hasSignedContracts: signedContractsCount > 0,
        scheduleChanged,
        compositionChanged: contractCompositionChanged,
        protectedNonScheduleFieldsChanged,
        commercialContentChanged: commercialContractContentChanged,
      });
      if (commercialSignedContractMaterialPolicy.signedContractBlockingChange) {
        throw new Error(SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE);
      }

      const mainLine = lineCreates[0];
      if (!mainLine) throw new Error("Servicio y duracion requeridos.");

      const reservationState = deriveCommercialReservationState({
        serviceCategory: mainLine.category,
        jetskiLicenseMode: requestedCommercialState.jetskiLicenseMode,
        isLicense: requestedCommercialState.isLicense,
        pricingTier: requestedCommercialState.pricingTier,
      });
      const currentContractRequirements = buildReservationContractRequirements({
        quantity: totalMainQuantity,
        isLicense: reservationState.isLicense,
        serviceCategory: mainLine.category,
        serviceId: current.serviceId,
        optionId: current.optionId,
        serviceName: current.service?.name ?? null,
        durationMinutes: current.option?.durationMinutes ?? null,
        pax: current.pax,
        totalPriceCents: current.totalPriceCents,
        items: lineCreates.map((line) => ({
          id:
            current.items.find(
              (item) =>
                !item.isExtra &&
                item.serviceId === line.serviceId &&
                item.optionId === line.optionId
            )?.id ?? null,
          serviceId: line.serviceId,
          optionId: line.optionId,
          quantity: line.quantity,
          isExtra: false,
          pax: line.pax,
          totalPriceCents: line.totalPriceCents,
          service: { name: line.serviceName, category: line.category },
          option: { durationMinutes: line.durationMinutes },
        })),
      });
      const currentSyncTargets = reservationContractRequirementsToSyncTargets(currentContractRequirements);
      const visibleContracts = buildReservationContractProgressForTargets(
        current.contracts,
        currentSyncTargets
      ).contracts;
      const resolvedLicense = resolveReservationLicenseDetails({
        isLicense: reservationState.isLicense,
        body: {
          licenseSchool: b.licenseSchool,
          licenseType: b.licenseType,
          licenseNumber: b.licenseNumber,
        },
        current: {
          licenseSchool: current.licenseSchool,
          licenseType: current.licenseType,
          licenseNumber: current.licenseNumber,
        },
        visibleContracts: visibleContracts as ReservationLicenseContractLike[],
        primaryContract: primaryContract as ReservationLicenseContractLike | null,
      });
      const finalLicenseSchool = resolvedLicense.licenseSchool;
      const finalLicenseType = resolvedLicense.licenseType;
      const finalLicenseNumber = resolvedLicense.licenseNumber;
      if (reservationState.isLicense) {
        if (resolvedLicense.missingContractMessage) {
          throw new Error(resolvedLicense.missingContractMessage);
        }
        if (!finalLicenseSchool || !finalLicenseType || !finalLicenseNumber) {
          throw new Error("Faltan datos de licencia en la reserva. Completa escuela, tipo y numero.");
        }
      }

      const claimFormalization = await tx.reservation.updateMany({
        where: {
          id,
          formalizedAt: null,
        },
        data: {
          formalizedAt: new Date(),
          formalizedByUserId: session.userId,
        },
      });

      if (claimFormalization.count === 0) {
        const latest = await tx.reservation.findUnique({
          where: { id },
          select: {
            id: true,
            quantity: true,
            isLicense: true,
            serviceId: true,
            optionId: true,
            pax: true,
            totalPriceCents: true,
            service: { select: { name: true, category: true } },
            option: { select: { durationMinutes: true } },
            items: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                serviceId: true,
                optionId: true,
                quantity: true,
                pax: true,
                totalPriceCents: true,
                isExtra: true,
                service: { select: { name: true, category: true } },
                option: { select: { durationMinutes: true } },
              },
            },
            contracts: {
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
          },
        });
        if (!latest) throw new Error("Reserva no existe");

        const latestProgress = computeContractProgress({
          quantity: latest.quantity,
          isLicense: Boolean(latest.isLicense),
          serviceCategory: latest.service?.category ?? null,
          serviceId: latest.serviceId,
          optionId: latest.optionId,
          serviceName: latest.service?.name ?? null,
          durationMinutes: latest.option?.durationMinutes ?? null,
          pax: latest.pax,
          totalPriceCents: latest.totalPriceCents,
          items: latest.items ?? [],
          contracts: latest.contracts,
        });

        return {
          ok: true as const,
          id,
          requiredUnits: latestProgress.requiredUnits,
          readyCount: latestProgress.readyCount,
          alreadyFormalized: true as const,
        };
      }

      if (current.giftVoucherId) {
        await tx.giftVoucher.updateMany({
          where: { id: current.giftVoucherId, redeemedAt: null },
          data: {
            redeemedAt: new Date(),
            redeemedByUserId: session.userId,
            redeemedReservationId: current.id,
          },
        });
      }

      const depositCents = isPrepaidVoucherReservation
        ? Number(current.depositCents ?? 0)
        : computeDepositFromResolvedItems({
            isLicense: reservationState.isLicense,
            resolvedItems: lineCreates.map((line) => ({
              category: line.category,
              quantity: line.quantity,
            })),
          });
      const commercialSnapshot = preserveCommercialSnapshot
        ? {
            appliedCommissionPct: current.appliedCommissionPct,
            appliedCommissionMode: current.appliedCommissionMode,
            appliedCommissionValue: Number(current.appliedCommissionValue ?? 0),
            appliedCommissionCents: Number(current.appliedCommissionCents ?? 0),
            customerDiscountMode: current.customerDiscountMode,
            customerDiscountValue: Number(current.customerDiscountValue ?? 0),
            customerDiscountCents: Number(current.customerDiscountCents ?? 0),
          }
        : await getAppliedCommercialSnapshotTx(tx, {
            channelId: effectiveChannelId,
            serviceId: mainLine.serviceId,
            commissionBaseCents: commercial.commissionBaseCents,
            finalTotalCents: commercial.finalTotalCents,
            customerDiscountBaseCents: totalBeforeDiscounts,
            quantity: totalMainQuantity,
          });

      const reservationUpdateData: Prisma.ReservationUncheckedUpdateInput = {
        customerName,
        customerPhone: customerPhone ?? null,
        customerEmail: customerEmail ?? null,
        customerCountry: customerCountry.toUpperCase(),
        customerAddress: customerAddress ?? null,
        customerPostalCode: customerPostalCode ?? null,
        customerBirthDate: customerBirthDate ?? null,
        customerDocType: customerDocType ?? null,
        customerDocNumber: customerDocNumber ?? null,
        marketing: marketing ?? null,
        serviceId: preserveCommercialSnapshot ? current.serviceId : mainLine.serviceId,
        optionId: preserveCommercialSnapshot ? current.optionId : mainLine.optionId,
        channelId: preserveCommercialSnapshot ? current.channelId : effectiveChannelId,
        quantity: preserveCommercialSnapshot ? current.quantity : totalMainQuantity,
        pax: Number(b.pax ?? current.pax ?? mainLine.pax),
        companionsCount,
        depositCents,
        isLicense: reservationState.isLicense,
        jetskiLicenseMode: reservationState.jetskiLicenseMode,
        pricingTier: reservationState.pricingTier,
        licenseSchool: reservationState.isLicense ? finalLicenseSchool ?? null : null,
        licenseType: reservationState.isLicense ? finalLicenseType ?? null : null,
        licenseNumber: reservationState.isLicense ? finalLicenseNumber ?? null : null,
        activityDate,
        scheduledTime,
      };

      if (!preserveCommercialSnapshot) {
        Object.assign(reservationUpdateData, {
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
        });
      }

      await tx.reservation.update({
        where: { id },
        data: reservationUpdateData,
        select: { id: true },
      });

      const itemReplacement = !preserveCommercialSnapshot
        ? await replaceReservationMainItemsTx(tx, {
            reservationId: id,
            existingItems: current.items ?? [],
            nextItems: lineCreates.map((line) => ({
              serviceId: line.serviceId,
              optionId: line.optionId,
              servicePriceId: line.servicePriceId,
              quantity: line.quantity,
              pax: line.pax,
              unitPriceCents: line.unitPriceCents,
              totalPriceCents: line.totalPriceCents,
            })),
          })
        : {
            nextReservationItemIds: (current.items ?? [])
              .filter((item) => !item.isExtra)
              .map((item) => item.id),
            changedReservationItemIds: new Set<string>(),
            removedReservationItemIds: [],
          };
      const itemMaterialChanged = itemReplacement.changedReservationItemIds.size > 0;
      const finalSignedContractMaterialPolicy = resolveSignedContractMaterialChangePolicy({
        hasSignedContracts: signedContractsCount > 0,
        scheduleChanged,
        compositionChanged: contractCompositionChanged,
        protectedNonScheduleFieldsChanged,
        itemMaterialChanged,
        commercialContentChanged: commercialContractContentChanged,
      });
      if (finalSignedContractMaterialPolicy.signedContractBlockingChange) {
        throw new Error(SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE);
      }

      const nextContractItems = lineCreates.map((line, index) => ({
        id: itemReplacement.nextReservationItemIds[index] ?? null,
        serviceId: line.serviceId,
        optionId: line.optionId,
        quantity: line.quantity,
        pax: line.pax,
        totalPriceCents: line.totalPriceCents,
        isExtra: false,
        service: { name: line.serviceName, category: line.category },
        option: { durationMinutes: line.durationMinutes },
      }));
      const contractRequirements = buildReservationContractRequirements({
        quantity: totalMainQuantity,
        isLicense: reservationState.isLicense,
        serviceCategory: mainLine.category,
        serviceId: mainLine.serviceId,
        optionId: mainLine.optionId,
        serviceName: mainLine.serviceName,
        durationMinutes: mainLine.durationMinutes,
        pax: Number(b.pax ?? current.pax ?? mainLine.pax),
        totalPriceCents: preserveCommercialSnapshot ? current.totalPriceCents : commercial.finalTotalCents,
        items: nextContractItems,
      });
      await syncReservationContractsTx(tx, {
        reservationId: id,
        requiredUnits: contractRequirements.length,
        targets: reservationContractRequirementsToSyncTargets(contractRequirements, {
          changedReservationItemIds: itemReplacement.changedReservationItemIds,
          materialChange: finalSignedContractMaterialPolicy.syncMaterialChange,
        }),
        confirmSignedReduction: Boolean(b.confirmSignedContractReduction),
        blockSignedOnMaterialChange:
          finalSignedContractMaterialPolicy.blockSignedOnSyncMaterialChange,
      });
      if (!preserveCommercialSnapshot) {
        await deleteRemovedReservationMainItemsTx(tx, itemReplacement.removedReservationItemIds);
      }
      await syncReservationPlatformUnitsTx(tx, {
        id,
        quantity: totalMainQuantity,
        isPackParent: current.isPackParent,
        parentReservationId: current.parentReservationId,
        serviceCategory: mainLine.category,
        items: lineCreates.map((line) => ({
          quantity: line.quantity,
          isExtra: false,
          service: { category: line.category },
        })),
      });
      const contracts = await ensureContractsTx(tx, id);

      if (contracts.requiredUnits > 0 && contracts.readyCount < contracts.requiredUnits) {
        throw new Error(
          `Faltan contratos por completar: ${contracts.readyCount}/${contracts.requiredUnits} listos.`
        );
      }

      await syncChannelCommissionLineFromReservationTx(tx, id);

      await writeOperationalLog(
        {
          action: "RESERVATION_FORMALIZE",
          entityType: "RESERVATION",
          entityId: id,
          source: auditSource,
          actor: { userId: session.userId },
          request: requestContext,
          metadata: {
            reservationSource: current.source,
            serviceId: mainLine.serviceId,
            optionId: mainLine.optionId,
            channelId: effectiveChannelId,
            quantity: totalMainQuantity,
            pax: Number(b.pax ?? current.pax ?? mainLine.pax),
            totalPriceCents: commercial.finalTotalCents,
            depositCents,
            commercialSnapshotPreserved: preserveCommercialSnapshot,
            paidServiceCents,
            explicitRecalculatePricing,
            requiredUnits: contracts.requiredUnits,
            readyCount: contracts.readyCount,
            isLicense: reservationState.isLicense,
            activityDate: activityDate.toISOString(),
            scheduledTime: scheduledTime?.toISOString() ?? null,
          },
        },
        tx
      );

      return { ok: true as const, id, ...contracts };
    });

    if (!result.ok && result.isHistorical) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    return toRouteErrorResponse(e);
  }
}
