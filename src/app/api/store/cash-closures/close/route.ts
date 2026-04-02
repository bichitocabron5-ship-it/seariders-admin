// src/app/api/store/cash-closures/close/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentOrigin, ShiftName, RoleName } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { originFromRoleName, shiftWindow, sumByMethod, diffTotals, emptyMethodMap, METHODS, parseBusinessDate, isOriginSplitByShift } from "@/lib/cashClosures";

export const runtime = "nodejs";

const MethodMapSchema = z.object({
  CASH: z.number().int(),
  CARD: z.number().int(),
  BIZUM: z.number().int(),
  TRANSFER: z.number().int(),
  VOUCHER: z.number().int(),
});

const TotalsSchema = z.object({
  service: MethodMapSchema,
  deposit: MethodMapSchema,
  total: MethodMapSchema,
  netService: z.number().int(),
  netDeposit: z.number().int(),
  netTotal: z.number().int(),
});

const Body = z.object({
  origin: z.nativeEnum(PaymentOrigin),
  shift: z.nativeEnum(ShiftName),
  date: z.string().min(10).max(10), // YYYY-MM-DD
  shiftSessionIds: z.array(z.string().min(1)).min(1).max(4),
  declared: TotalsSchema,
  note: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.userId; // <- ahora es string seguro

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const origin = parsed.data.origin;
  const shift = parsed.data.shift;
  const businessDate = parseBusinessDate(parsed.data.date);

  // Permisos: role->origin o ADMIN
  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== origin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { from, to } = shiftWindow(origin, businessDate, shift);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) evitar doble cierre “activo”
      const existing = await tx.cashClosure.findFirst({
        where: { origin, shift, businessDate, isVoided: false },
        select: { id: true },
      });
      if (existing) throw new Error("Ya existe un cierre para ese origin/turno/día (no anulado).");

      // 2) validar shift sessions (1–4)
      const ss = await tx.shiftSession.findMany({
        where: { id: { in: parsed.data.shiftSessionIds } },
        select: {
          id: true,
          userId: true,
          shift: true,
          startedAt: true,
          endedAt: true,
          role: { select: { name: true } },
          user: { select: { id: true, fullName: true, username: true } },
        },
      });

      if (ss.length !== parsed.data.shiftSessionIds.length) {
        throw new Error("Algún shiftSessionId no existe.");
      }

      // ✅ Dedup por userId (evita el unique constraint en CashClosureUser)
      const uniqByUserId = new Map<string, typeof ss[number]>();
      for (const s of ss) {
        if (!uniqByUserId.has(s.userId)) uniqByUserId.set(s.userId, s);
      }
      const ssUnique = Array.from(uniqByUserId.values());

      for (const s of ssUnique) {
        // shift debe coincidir
        if (String(s.shift) !== String(shift)) throw new Error("ShiftSession no coincide con shift del cierre.");

        // rol debe mapear a origin
        const o = originFromRoleName(s.role.name as RoleName);
        if (o !== origin) throw new Error("ShiftSession no corresponde al origin del cierre.");

        // startedAt debe caer en el día operativo (00:00..23:59)
        const d0 = new Date(businessDate);
        d0.setHours(0, 0, 0, 0);
        const d1 = new Date(businessDate);
        d1.setHours(23, 59, 59, 999);

        if (s.startedAt < d0 || s.startedAt > d1) {
          throw new Error("ShiftSession no pertenece al día operativo indicado.");
        }
      }

      // 3) pagos del sistema (turno por ShiftSession + compat por ventana)
      const payments = await tx.payment.findMany({
        where: isOriginSplitByShift(origin)
          ? {
              origin,
              OR: [
                // ✅ Turno por ShiftSession seleccionadas
                { shiftSessionId: { in: parsed.data.shiftSessionIds } },

                // ✅ Compat: pagos viejos sin shiftSessionId, caen en la ventana
                { shiftSessionId: null, createdAt: { gte: from, lt: to } },
              ],
            }
          : {
              origin,
              createdAt: { gte: from, lt: to },
            },
        select: {
          amountCents: true,
          direction: true,
          method: true,
          isDeposit: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const system = sumByMethod(payments);

      // 4) declared: recomputar totales/net por seguridad (si UI manda mal)
      const declared = parsed.data.declared;
      // Recalcula total y net a partir de service+deposit, por consistencia:
      const declaredTotal = emptyMethodMap();
      for (const m of METHODS) declaredTotal[m] = (declared.service[m] ?? 0) + (declared.deposit[m] ?? 0);

      const recomputedDeclared = {
        service: declared.service,
        deposit: declared.deposit,
        total: declaredTotal,
        netService: METHODS.reduce((s, m) => s + (declared.service[m] ?? 0), 0),
        netDeposit: METHODS.reduce((s, m) => s + (declared.deposit[m] ?? 0), 0),
        netTotal: METHODS.reduce((s, m) => s + (declaredTotal[m] ?? 0), 0),
      };

      const diff = diffTotals(recomputedDeclared, system);

      // 5) asegurar CashShift (create si no existe)
      const cashShift = await tx.cashShift.upsert({
        where: {
          origin_shift_date: {
            origin,
            shift,
            date: businessDate, // 👈 OJO: aquí es "date" (start-of-day)
          },
        },
        update: {
          // opcional: refrescar ventana si cambias turnos/horas en el futuro
          // (tu CashShift NO tiene windowFrom/windowTo, así que nada aquí)
        },
        create: {
          origin,
          shift,
          date: businessDate,
          openedByUserId: session.userId ?? null, // opcional
        },
        select: { id: true },
      });

      const computed = {
        system,
        declared: recomputedDeclared,
        diff,
        meta: {
          origin,
          shift,
          businessDate,
          windowFrom: from,
          windowTo: to,
          cashShiftId: cashShift.id,
        },
      };

      // 5) crear cierre
      const closure = await tx.cashClosure.create({
        data: {
          origin,
          shift,
          businessDate,
          cashShift: { connect: { id: cashShift.id } },
          windowFrom: from,
          windowTo: to,
          computedJson: computed as Prisma.InputJsonValue,
          declaredJson: recomputedDeclared as Prisma.InputJsonValue,
          systemJson: system as Prisma.InputJsonValue,
          diffJson: diff as Prisma.InputJsonValue,
          note: parsed.data.note ?? null,
          closedByUser: {
            connect: { id: userId }
          },

          users: {
            create: ssUnique.map((s) => ({
              userId: s.userId,
              roleNameAtClose: s.role.name,
            })),
          },
        },
        select: { id: true },
      });

      return { id: closure.id };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}


