import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireBarOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "BAR") return session;
  return null;
}

export async function GET() {
  const session = await requireBarOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await prisma.fulfillmentTask.findMany({
    where: {
      area: "BAR",
      type: "EXTRA_DELIVERY",
      status: "DELIVERED",
    },
    orderBy: [{ deliveredAt: "asc" }, { scheduledFor: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      customerNameSnap: true,
      paid: true,
      paidAmountCents: true,
      scheduledFor: true,
      reservation: {
        select: {
          id: true,
        },
      },
      items: {
        select: {
          id: true,
          kind: true,
          nameSnap: true,
          quantity: true,
          barProductId: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      id: r.id,
      kind: "EXTRA",
      reservationLabel: r.reservation ? `Reserva #${r.reservation.id.slice(-6)}` : r.title,
      customerName: r.customerNameSnap ?? "Sin cliente",
      time: r.scheduledFor,
      paid: r.paid,
      paidAmountCents: r.paidAmountCents ?? 0,
      items: r.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        name: it.nameSnap,
        quantity: Number(it.quantity ?? 0),
        barProductId: it.barProductId,
      })),
    })),
  });
}
