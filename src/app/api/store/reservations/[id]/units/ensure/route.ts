import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationUnitStatus, type ReservationUnit } from "@prisma/client";
import { buildOperationalUnitSnapshots } from "@/lib/reservation-operational-units";
import { syncReservationPlatformUnitsTx } from "@/lib/reservation-platform";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          quantity: true,
          pax: true,
          status: true,
          readyForPlatformAt: true,
          parentReservationId: true,
          isPackParent: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true } },
          items: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              quantity: true,
              pax: true,
              isExtra: true,
              service: { select: { id: true, name: true, category: true } },
              option: { select: { id: true, durationMinutes: true } },
            },
          },
        },
      });

      if (!r) throw new Error("Reserva no existe");

      if (r.isPackParent && !r.parentReservationId) {
        return {
          reservationId: id,
          requiredUnits: 0,
          readyCount: 0,
          units: [] as ReservationUnit[],
          hint: "Pack padre: generar units en hijas",
        };
      }

      const requiredUnits = buildOperationalUnitSnapshots({
        items: r.items ?? [],
        fallback: {
          quantity: r.quantity,
          pax: r.pax,
          service: r.service,
          option: r.option,
        },
      }).length;

      if (requiredUnits <= 0) {
        return { reservationId: id, requiredUnits: 0, readyCount: 0, units: [] as ReservationUnit[] };
      }

      await syncReservationPlatformUnitsTx(
        tx,
        { id },
        r.status === "READY_FOR_PLATFORM" ? (r.readyForPlatformAt ?? new Date()) : undefined
      );

      const units = await tx.reservationUnit.findMany({
        where: { reservationId: id },
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          status: true,
          jetskiId: true,
          serviceCategory: true,
          serviceName: true,
          quantitySnapshot: true,
        },
      });

      const readyCount = units.filter(
        (u) =>
          u.unitIndex <= requiredUnits &&
          u.status === ReservationUnitStatus.READY_FOR_PLATFORM
      ).length;

      return { reservationId: id, requiredUnits, readyCount, units };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
