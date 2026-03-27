/// src/app/api/store/reservations/set-status/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";

export const runtime = "nodejs";

const Body = z.object({
  id: z.string().min(1),
  status: z.enum(["SCHEDULED", "WAITING", "READY_FOR_PLATFORM", "IN_SEA", "COMPLETED", "CANCELED"]),
});

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

type ItemForUnits = { quantity: number | null; isExtra: boolean; service: { category: string | null } | null };
type UnitIndex = { unitIndex: number };

async function ensureUnitsTx(tx: Prisma.TransactionClient, reservationId: string) {
  const r = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      quantity: true,
      isPackParent: true,
      parentReservationId: true,
      isLicense: true,
      service: { select: { category: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true } },
        },
      },
    },
  });
  if (!r) return;
  if (r.isPackParent && !r.parentReservationId) return;

  const requiredUnits = computeRequiredContractUnits({
    quantity: r.quantity,
    isLicense: Boolean(r.isLicense),
    serviceCategory: r.service?.category ?? null,
    items: (r.items ?? []).map((it): ItemForUnits => ({
      quantity: it.quantity ?? 0,
      isExtra: Boolean(it.isExtra),
      service: it.service ? { category: it.service.category ?? null } : null,
    })),
  });
  if (requiredUnits <= 0) return;

  const existing = await tx.reservationUnit.findMany({
    where: { reservationId: r.id },
    select: { unitIndex: true },
  });
  const set = new Set(existing.map((u: UnitIndex) => Number(u.unitIndex)));

  const toCreate: Array<{ reservationId: string; unitIndex: number }> = [];
  for (let i = 1; i <= requiredUnits; i++) if (!set.has(i)) toCreate.push({ reservationId: r.id, unitIndex: i });
  if (toCreate.length > 0) await tx.reservationUnit.createMany({ data: toCreate, skipDuplicates: true });
}

export async function POST(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      select: { id: true },
    });

    if (parsed.data.status === "READY_FOR_PLATFORM") {
      await ensureUnitsTx(tx, parsed.data.id);
    }

    await syncStoreFulfillmentTasksForReservation(tx, parsed.data.id);
  });

  return NextResponse.json({ ok: true });
}
