// src/app/api/store/reservations/[id]/formalize/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { validateReusableAssetsAvailability } from "@/lib/store-rental-assets";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";
import { countReadyVisibleContracts, listMissingLogicalUnits } from "@/lib/contracts/active-contracts";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

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
  licenseSchool: z.string().optional().nullable(),
  licenseType: z.string().optional().nullable(),
  licenseNumber: z.string().optional().nullable(),
  activityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  companionsCount: z.number().int().min(0).max(20).optional(),
});

function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null; // borrar
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
      contracts: { select: { id: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true } }, // requiere relation Reservation.contracts
    },
  });
  if (!res) throw new Error("Reserva no existe");

  const requiredUnits = computeRequiredContractUnits({
    quantity: res.quantity ?? 0,
    isLicense: Boolean(res.isLicense),
    serviceCategory: res.service?.category ?? null,
    items: res.items ?? [],
  });

  if (requiredUnits <= 0) {
    return { requiredUnits: 0, readyCount: 0 };
  }

  const existingContracts = res.contracts ?? [];
  const hasUnitOne = existingContracts.some((c) => Number(c.unitIndex) === 1);

  // Compat legacy: reutiliza el contrato principal antiguo (#0) como contrato #1.
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
  const toCreate: Array<{ reservationId: string; unitIndex: number; logicalUnitIndex: number }> = missingSlots.map((slot, idx) => ({
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

// ===== ROUTE =====

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
          passVoucherId: true,
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
          depositCents: true,
          companionsCount: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          activityDate: true,
          scheduledTime: true,
          items: {
            select: {
              quantity: true,
              isExtra: true,
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

      // Si viene de gift draft, marca redeem (idempotente)
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

      // históricos
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

      const isLicense = b.isLicense ?? Boolean(current.isLicense);
      const licenseSchool = normalizeOptionalString(
        b.licenseSchool !== undefined ? b.licenseSchool : current.licenseSchool
      );
      const licenseType = normalizeOptionalString(
        b.licenseType !== undefined ? b.licenseType : current.licenseType
      );
      const licenseNumber = normalizeOptionalString(
        b.licenseNumber !== undefined ? b.licenseNumber : current.licenseNumber
      );

      const serviceId = b.serviceId ?? current.serviceId;
      const optionId = b.optionId ?? current.optionId;
      const quantity = Number(b.quantity ?? current.quantity ?? 1);
      const pax = Number(b.pax ?? current.pax ?? 1);
      const companionsCount = Number(b.companionsCount ?? current.companionsCount ?? 0);
      let serviceCategory = String(current.service?.category ?? "").toUpperCase();
      if (b.serviceId && b.serviceId !== current.serviceId) {
        const svc = await tx.service.findUnique({
          where: { id: b.serviceId },
          select: { category: true },
        });
        serviceCategory = String(svc?.category ?? "").toUpperCase();
      }

      // ===== VALIDACIÓN INVENTARIO REAL (GOPRO / NEOPRENO) =====

      const finalServiceId = b.serviceId ?? current.serviceId;
      const finalQuantity = Number(b.quantity ?? current.quantity ?? 1);

      let itemsToValidate: Array<{
        quantity: number;
        service: { name?: string | null; code?: string | null; category?: string | null } | null;
      }> = [];

      if (current.items && current.items.length > 0) {
        itemsToValidate = current.items.map((it) => ({
          quantity: Number(it.quantity ?? 0),
          service: {
            category: it.service?.category ?? null,
            name: it.service?.name ?? null,
            code: it.service?.code ?? null,
          },
        }));
      } else if (finalServiceId) {
        const svc = await tx.service.findUnique({
          where: { id: finalServiceId },
          select: { name: true, code: true, category: true },
        });

        itemsToValidate = [
          {
            quantity: finalQuantity,
            service: svc,
          },
        ];
      }

      await validateReusableAssetsAvailability({
        tx,
        items: itemsToValidate,
      });

      if (!customerName) throw new Error("Nombre requerido.");
      if (!customerCountry || customerCountry.trim().length < 2) {
        throw new Error("Pais requerido para formalizar.");
      }
      if (customerEmail && !z.string().email().safeParse(customerEmail).success) {
        throw new Error("Email invalido para formalizar.");
      }
      if (!serviceId || !optionId) throw new Error("Servicio y duracion requeridos.");
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) throw new Error("Cantidad invalida.");
      if (!Number.isFinite(pax) || pax < 1 || pax > 20) throw new Error("PAX invalido.");
      if (!Number.isFinite(companionsCount) || companionsCount < 0 || companionsCount > 20) {
        throw new Error("Acompanantes invalido.");
      }
      const depositCents = computeReservationDepositCents({
        storedDepositCents: current.depositCents,
        quantity,
        isLicense: Boolean(isLicense),
        serviceCategory,
        items: current.items ?? [],
      });

      const data: Prisma.ReservationUncheckedUpdateInput = {
        customerName,
        customerPhone: customerPhone ?? null,
        customerEmail: customerEmail ?? null,
        customerCountry: customerCountry ? customerCountry.toUpperCase() : "ES",
        customerAddress: customerAddress ?? null,
        customerPostalCode: customerPostalCode ?? null,
        customerBirthDate: customerBirthDate ?? null,
        customerDocType: customerDocType ?? null,
        customerDocNumber: customerDocNumber ?? null,
        marketing: marketing ?? null,
        serviceId,
        optionId,
        channelId: b.channelId !== undefined ? b.channelId ?? null : current.channelId ?? null,
        quantity,
        pax,
        companionsCount,
        depositCents,
        isLicense,
        licenseSchool: isLicense ? licenseSchool ?? null : null,
        licenseType: isLicense ? licenseType ?? null : null,
        licenseNumber: isLicense ? licenseNumber ?? null : null,

        activityDate,
        scheduledTime,

        formalizedAt: new Date(),
        formalizedByUserId: session.userId,
      };
      const updated = await tx.reservation.update({
        where: { id },
        data,
        select: { id: true },
      });

      // Paso 3: Ensure contracts aquí­ (idempotente)
      const contracts = await ensureContractsTx(tx, updated.id);

      if (contracts.requiredUnits > 0 && contracts.readyCount < contracts.requiredUnits) {
        throw new Error(
          `Faltan contratos por completar: ${contracts.readyCount}/${contracts.requiredUnits} listos.`
        );
      }

      return { ok: true as const, id: updated.id, ...contracts };
    });

    if (!result.ok && result.isHistorical) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}


