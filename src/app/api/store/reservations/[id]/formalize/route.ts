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
  return t.length ? t : null;
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
  if (!issue) return "Datos invÃ¡lidos";
  const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
  return `Datos invÃ¡lidos (${path}${issue.message})`;
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
      contracts: { select: { id: true, unitIndex: true, status: true, createdAt: true } }, // requiere relation Reservation.contracts
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
        data: { unitIndex: 1 },
      });
    }
  }

  const existingRows = await tx.reservationContract.findMany({
    where: { reservationId },
    select: { unitIndex: true },
  });
  const existing = new Set<number>(existingRows.map((c) => Number(c.unitIndex)));

  const toCreate: Array<{ reservationId: string; unitIndex: number }> = [];
  for (let i = 1; i <= requiredUnits; i++) {
    if (!existing.has(i)) toCreate.push({ reservationId, unitIndex: i });
  }

  if (toCreate.length) {
    await tx.reservationContract.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  const all = await tx.reservationContract.findMany({
    where: { reservationId },
    orderBy: { unitIndex: "asc" },
    select: { unitIndex: true, status: true },
  });

  const readyCount = all.filter(
    (c) =>
      Number(c.unitIndex) >= 1 &&
      Number(c.unitIndex) <= requiredUnits &&
      (c.status === "READY" || c.status === "SIGNED")
  ).length;

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
              service: { select: { category: true } },
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

      // histÃ³ricos
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

      const customerName = (b.customerName ?? current.customerName ?? "").trim();
      const customerPhone = normalizeOptionalString(
        b.customerPhone !== undefined ? b.customerPhone : current.customerPhone
      );
      const customerEmail = normalizeOptionalString(
        b.customerEmail !== undefined ? b.customerEmail : current.customerEmail
      );
      const customerCountry = normalizeOptionalString(
        b.customerCountry !== undefined ? b.customerCountry : current.customerCountry
      );
      const customerAddress = normalizeOptionalString(
        b.customerAddress !== undefined ? b.customerAddress : current.customerAddress
      );
      const customerPostalCode = normalizeOptionalString(
        b.customerPostalCode !== undefined ? b.customerPostalCode : current.customerPostalCode
      );
      const customerBirthDate =
        b.customerBirthDate !== undefined ? (b.customerBirthDate ? new Date(b.customerBirthDate) : null) : current.customerBirthDate;
      const customerDocType = normalizeOptionalString(
        b.customerDocType !== undefined ? b.customerDocType : current.customerDocType
      );
      const customerDocNumber = normalizeOptionalString(
        b.customerDocNumber !== undefined ? b.customerDocNumber : current.customerDocNumber
      );
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

      const requiredUnitsForValidation = computeRequiredContractUnits({
        quantity,
        isLicense: Boolean(isLicense),
        serviceCategory,
        items: (current.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
      });
      const requiresFullCustomerData = requiredUnitsForValidation > 0;

      if (!customerName) throw new Error("Nombre requerido.");
      if (!customerPhone) throw new Error("Telefono requerido para formalizar.");
      if (requiresFullCustomerData) {
        if (!customerEmail || !z.string().email().safeParse(customerEmail).success) {
          throw new Error("Email invalido para formalizar.");
        }
        if (!customerCountry || customerCountry.trim().length < 2) {
          throw new Error("Pais requerido para formalizar.");
        }
        if (!customerAddress) throw new Error("Direccion requerida para formalizar.");
        if (!customerDocType) throw new Error("Tipo de documento requerido para formalizar.");
        if (!customerDocNumber) throw new Error("Numero de documento requerido para formalizar.");
      }
      if (!serviceId || !optionId) throw new Error("Servicio y duracion requeridos.");
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) throw new Error("Cantidad invalida.");
      if (!Number.isFinite(pax) || pax < 1 || pax > 20) throw new Error("PAX invalido.");
      if (!Number.isFinite(companionsCount) || companionsCount < 0 || companionsCount > 20) {
        throw new Error("Acompanantes invalido.");
      }

      if (isLicense && (!licenseSchool || !licenseType || !licenseNumber)) {
        throw new Error("Faltan datos de licencia (escuela, tipo y numero).");
      }

      const data: Prisma.ReservationUncheckedUpdateInput = {
        customerName,
        customerPhone: customerPhone ?? null,
        customerEmail: customerEmail ?? null,
        customerCountry: customerCountry ? customerCountry.toUpperCase() : "ES",
        customerAddress: customerAddress ?? null,
        customerPostalCode: customerPostalCode ?? null,
        customerBirthDate,
        customerDocType: customerDocType ?? null,
        customerDocNumber: customerDocNumber ?? null,
        marketing: marketing ?? null,
        licenseSchool: isLicense ? licenseSchool : null,
        licenseType: isLicense ? licenseType : null,
        licenseNumber: isLicense ? licenseNumber : null,
        serviceId,
        optionId,
        channelId: b.channelId !== undefined ? b.channelId ?? null : current.channelId ?? null,
        quantity,
        pax,
        isLicense,
        companionsCount,

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


