import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { JetskiLicenseMode, PricingTier, ReservationStatus, type Prisma } from "@prisma/client";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { validateReusableAssetsAvailability } from "@/lib/store-rental-assets";
import { computeDepositFromResolvedItems } from "@/lib/reservation-deposits";
import { countReadyVisibleContracts, listMissingLogicalUnits } from "@/lib/contracts/active-contracts";
import { getBoothUnitDiscountCents, getScaledBoothDiscountCents } from "@/lib/booth-discount";
import { resolveJetskiLicenseMode, resolvePricingTierForJetskiMode } from "@/lib/jetski-license";
import { findActiveServicePrice } from "@/lib/service-pricing";
import { resolveDiscountPolicy } from "@/lib/commission";
import { computeReservationCommercialBreakdown } from "@/lib/reservation-commercial";

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
});

function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  if (t === "-") return null;
  return t.length ? t : null;
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

async function ensureContractsTx(tx: Prisma.TransactionClient, reservationId: string) {
  const res = await tx.reservation.findUnique({
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
        select: { id: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
      },
    },
  });
  if (!res) throw new Error("Reserva no existe");

  const requiredUnits = computeRequiredContractUnits({
    quantity: res.quantity ?? 0,
    isLicense: Boolean(res.isLicense),
    serviceCategory: res.service?.category ?? null,
    items: res.items ?? [],
  });

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

  const existingRows = await tx.reservationContract.findMany({
    where: { reservationId },
    select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
  });
  const missingSlots = listMissingLogicalUnits(existingRows, requiredUnits);
  const maxUnitIndex = Math.max(0, ...existingRows.map((c) => Number(c.unitIndex ?? 0)));
  const toCreate = missingSlots.map((slot, idx) => ({
    reservationId,
    unitIndex: maxUnitIndex + idx + 1,
    logicalUnitIndex: slot,
  }));

  if (toCreate.length) {
    await tx.reservationContract.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  const all = await tx.reservationContract.findMany({
    where: { reservationId },
    orderBy: { unitIndex: "asc" },
    select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
  });

  const readyCount = countReadyVisibleContracts(all, requiredUnits);

  return { requiredUnits, readyCount };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
          service: { select: { category: true } },
          channelId: true,
          quantity: true,
          pax: true,
          isLicense: true,
          jetskiLicenseMode: true,
          pricingTier: true,
          depositCents: true,
          companionsCount: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          manualDiscountCents: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
          activityDate: true,
          scheduledTime: true,
          items: {
            select: {
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              isExtra: true,
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
              driverName: true,
              driverPhone: true,
              driverEmail: true,
              driverCountry: true,
              driverAddress: true,
              driverPostalCode: true,
              driverBirthDate: true,
              driverDocType: true,
              driverDocNumber: true,
            },
          },
        },
      });

      if (!current) throw new Error("Reserva no existe");

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

      if (current.status === ReservationStatus.COMPLETED || current.status === ReservationStatus.CANCELED) {
        return { ok: false as const, id, isHistorical: true };
      }

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
      const primaryContract = current.contracts[0] ?? null;
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
        quantity: number;
        pax: number;
        promoCode: string | null;
        servicePriceId: string;
        unitPriceCents: number;
        totalPriceCents: number;
        category: string;
        serviceName: string | null;
        serviceCode: string | null;
      }> = [];

      for (const item of candidateItems) {
        const qty = Number(item.quantity ?? 0);
        const pax = Number(item.pax ?? 0);
        if (!Number.isFinite(qty) || qty < 1 || qty > 99) throw new Error("Cantidad invalida.");
        if (!Number.isFinite(pax) || pax < 1 || pax > 50) throw new Error("PAX invalido.");

        const service = svcById.get(item.serviceId);
        if (!service) throw new Error("Servicio no existe.");

        const option = optById.get(item.optionId);
        if (!option) throw new Error("Opción no existe.");
        if (option.serviceId !== service.id) throw new Error("La opción no pertenece al servicio.");

        const lineState = deriveCommercialReservationState({
          serviceCategory: service.category ?? null,
          jetskiLicenseMode: b.jetskiLicenseMode ?? current.jetskiLicenseMode,
          isLicense: b.isLicense ?? current.isLicense,
          pricingTier: b.pricingTier ?? current.pricingTier,
        });

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
          quantity: qty,
          pax,
          promoCode: item.promoCode ?? null,
          servicePriceId: price.id,
          unitPriceCents,
          totalPriceCents: unitPriceCents * qty,
          category: String(service.category ?? "").toUpperCase(),
          serviceName: service.name ?? null,
          serviceCode: service.code ?? null,
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

      const serviceSubtotal = lineCreates.reduce((sum, line) => sum + line.totalPriceCents, 0);
      const extrasTotal = (current.items ?? [])
        .filter((item) => item.isExtra)
        .reduce((sum, item) => sum + Number(item.totalPriceCents ?? 0), 0);
      const totalBeforeDiscounts = serviceSubtotal + extrasTotal;

      const effectiveChannelId = b.channelId !== undefined ? b.channelId ?? null : current.channelId ?? null;
      const channel = effectiveChannelId
        ? await tx.channel.findUnique({
            where: { id: effectiveChannelId },
            select: {
              allowsPromotions: true,
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
          : Number(current.manualDiscountCents ?? 0);

      const commercial = await computeReservationCommercialBreakdown({
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
        manualDiscountCents: incomingManualDiscountCents,
        discountResponsibility: discountPolicy.discountResponsibility,
        promoterDiscountShareBps: discountPolicy.promoterDiscountShareBps,
      });

      const mainLine = lineCreates[0];
      if (!mainLine) throw new Error("Servicio y duracion requeridos.");

      const reservationState = deriveCommercialReservationState({
        serviceCategory: mainLine.category,
        jetskiLicenseMode: b.jetskiLicenseMode ?? current.jetskiLicenseMode,
        isLicense: b.isLicense ?? current.isLicense,
        pricingTier: b.pricingTier ?? current.pricingTier,
      });

      const finalLicenseSchool = normalizeOptionalString(
        b.licenseSchool !== undefined ? b.licenseSchool : current.licenseSchool
      );
      const finalLicenseType = normalizeOptionalString(
        b.licenseType !== undefined ? b.licenseType : current.licenseType
      );
      const finalLicenseNumber = normalizeOptionalString(
        b.licenseNumber !== undefined ? b.licenseNumber : current.licenseNumber
      );
      if (reservationState.isLicense && (!finalLicenseSchool || !finalLicenseType || !finalLicenseNumber)) {
        throw new Error("Faltan datos de licencia (escuela, tipo y número).");
      }

      const totalMainQuantity = lineCreates.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0);
      const depositCents = computeDepositFromResolvedItems({
        isLicense: reservationState.isLicense,
        resolvedItems: lineCreates.map((line) => ({
          category: line.category,
          quantity: line.quantity,
        })),
      });

      await tx.reservation.update({
        where: { id },
        data: {
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
          serviceId: mainLine.serviceId,
          optionId: mainLine.optionId,
          channelId: effectiveChannelId,
          quantity: totalMainQuantity,
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
          basePriceCents: serviceSubtotal,
          commissionBaseCents: commercial.commissionBaseCents,
          autoDiscountCents: commercial.autoDiscountCents,
          manualDiscountCents: commercial.manualDiscountCents,
          discountResponsibility: commercial.discountResponsibility,
          promoterDiscountShareBps: commercial.promoterDiscountShareBps,
          promoterDiscountCents: commercial.promoterDiscountCents,
          companyDiscountCents: commercial.companyDiscountCents,
          promoCode: commercial.promoCode,
          totalPriceCents: commercial.finalTotalCents,
          formalizedAt: new Date(),
          formalizedByUserId: session.userId,
        },
        select: { id: true },
      });

      await tx.reservationItem.deleteMany({
        where: { reservationId: id, isExtra: false },
      });

      await tx.reservationItem.createMany({
        data: lineCreates.map((line) => ({
          reservationId: id,
          serviceId: line.serviceId,
          optionId: line.optionId,
          servicePriceId: line.servicePriceId,
          quantity: line.quantity,
          pax: line.pax,
          unitPriceCents: line.unitPriceCents,
          totalPriceCents: line.totalPriceCents,
          isExtra: false,
        })),
      });

      const contracts = await ensureContractsTx(tx, id);

      if (contracts.requiredUnits > 0 && contracts.readyCount < contracts.requiredUnits) {
        throw new Error(
          `Faltan contratos por completar: ${contracts.readyCount}/${contracts.requiredUnits} listos.`
        );
      }

      return { ok: true as const, id, ...contracts };
    });

    if (!result.ok && result.isHistorical) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}
