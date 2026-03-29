// src/app/api/store/reservations/[id]/units/ensure/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationUnitStatus, type ReservationUnit } from "@prisma/client";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";

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
          status: true,
          readyForPlatformAt: true,
          parentReservationId: true,
          isPackParent: true,
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

      if (!r) throw new Error("Reserva no existe");

      // Regla PRO:
      // - si es pack padre => la operativa vive en hijas => no generamos units aquí
      if (r.isPackParent && !r.parentReservationId) {
        return { reservationId: id, requiredUnits: 0, readyCount: 0, units: [] as ReservationUnit[], hint: "Pack padre: generar units en hijas" };
      }

      const requiredUnits = computeRequiredContractUnits({
        quantity: r.quantity,
        isLicense: Boolean(r.isLicense),
        serviceCategory: r.service?.category ?? null,
        items: (r.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
      });

      if (requiredUnits <= 0) {
        return { reservationId: id, requiredUnits: 0, readyCount: 0, units: [] as ReservationUnit[] };
      }

      const existing = await tx.reservationUnit.findMany({
        where: { reservationId: id },
        select: { unitIndex: true },
      });
      const set = new Set(existing.map((x) => Number(x.unitIndex)));

      const toCreate: Array<{ reservationId: string; unitIndex: number; readyForPlatformAt?: Date }> = [];
      for (let i = 1; i <= requiredUnits; i++) {
        if (!set.has(i)) {
          toCreate.push({
            reservationId: id,
            unitIndex: i,
            ...(r.status === "READY_FOR_PLATFORM"
              ? { readyForPlatformAt: r.readyForPlatformAt ?? new Date() }
              : {}),
          });
        }
      }

      if (toCreate.length) {
        await tx.reservationUnit.createMany({ data: toCreate, skipDuplicates: true });
      }

      const units = await tx.reservationUnit.findMany({
        where: { reservationId: id },
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          status: true,
          jetskiId: true,
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
