// src/app/api/store/reservations/[reservationId]/apply-platform-extras/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

// Si tu enum se llama distinto, ajusta aquí:
import { ExtraTimeStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

// Por si luego quieres modo "dryRun" o forzar re-aplicar, lo dejamos preparado.
const Body = z.object({
  dryRun: z.boolean().optional().default(false),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: reservationId } = await ctx.params;

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const { dryRun } = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      // 0) Validar reserva existe (y opcionalmente estado)
      const res = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: { id: true, status: true, pax: true },
      });
      if (!res) throw new Error("Reserva no existe");

      // 1) Cargar eventos PENDING
      const events = await tx.extraTimeEvent.findMany({
        where: {
          reservationId,
          status: ExtraTimeStatus.PENDING,
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          serviceCode: true,
          extraMinutes: true,
          status: true,
        },
      });

      if (!events.length) {
        return {
          ok: true,
          reservationId,
          applied: 0,
          createdItems: [],
          message: "No hay extras pendientes de plataforma.",
        };
      }

      // 2) Agrupar por serviceCode (qty = n.º de eventos por code)
      const grouped = new Map<string, { qty: number; minutesTotal: number; eventIds: string[] }>();
      for (const e of events) {
        const key = String(e.serviceCode);
        const cur = grouped.get(key) ?? { qty: 0, minutesTotal: 0, eventIds: [] };
        cur.qty += 1;
        cur.minutesTotal += Number(e.extraMinutes ?? 0);
        cur.eventIds.push(e.id);
        grouped.set(key, cur);
      }

      // 3) Resolver services por code
      const serviceCodes = Array.from(grouped.keys());
      const services = await tx.service.findMany({
        where: { code: { in: serviceCodes } },
        select: { id: true, code: true, name: true },
      });

      const byCode = new Map<string, { id: string; code: string; name: string }>();
      for (const s of services) byCode.set(String(s.code), s);

      // Si falta alguno, fallamos para no dejar eventos colgados
      const missing = serviceCodes.filter((c) => !byCode.has(c));
      if (missing.length) {
        throw new Error(`Servicios extra no encontrados (por code): ${missing.join(", ")}`);
      }

      // 4) Crear ReservationItems (isExtra=true) por grupo
      const createdItems: Array<{
        serviceCode: string;
        serviceId: string;
        quantity: number;
        minutesTotal: number;
        serviceName: string;
      }> = [];

      if (!dryRun) {
        for (const [code, info] of grouped.entries()) {
          const svc = byCode.get(code)!;
          const now = new Date();
          const price = await tx.servicePrice.findFirst({
            where: {
              serviceId: svc.id,
              optionId: null,
              isActive: true,
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gt: now } }],
            },
            orderBy: { validFrom: "desc" },
            select: { id: true, basePriceCents: true },
          });
          if (!price) throw new Error(`No hay precio vigente para extra ${svc.code}`);
          const unitPriceCents = Number(price.basePriceCents ?? 0);
          const totalPriceCents = unitPriceCents * info.qty;

          await tx.reservationItem.create({
            data: {
              reservationId,
              serviceId: svc.id,
              servicePriceId: price.id,
              quantity: info.qty,
              pax: Math.max(1, Number(res.pax ?? 1)),
              unitPriceCents,
              totalPriceCents,
              isExtra: true,
            },
            select: { id: true },
          });

          createdItems.push({
            serviceCode: code,
            serviceId: svc.id,
            quantity: info.qty,
            minutesTotal: info.minutesTotal,
            serviceName: svc.name,
          });
        }

        // 5) Marcar eventos como CHARGED
        // OJO: CHARGED significa "ya aplicado a reserva para cobro", no "pagado".
        await tx.extraTimeEvent.updateMany({
          where: {
            id: { in: events.map((e) => e.id) },
            status: ExtraTimeStatus.PENDING,
          },
          data: {
            status: ExtraTimeStatus.CHARGED,
          },
        });
      } else {
        // Dry run: solo devolvemos lo que haríamos
        for (const [code, info] of grouped.entries()) {
          const svc = byCode.get(code)!;
          createdItems.push({
            serviceCode: code,
            serviceId: svc.id,
            quantity: info.qty,
            minutesTotal: info.minutesTotal,
            serviceName: svc.name,
          });
        }
      }

      return {
        ok: true,
        reservationId,
        applied: events.length,
        dryRun,
        createdItems,
      };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

