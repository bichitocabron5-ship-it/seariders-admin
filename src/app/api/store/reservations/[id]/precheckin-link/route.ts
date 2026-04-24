import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { listMissingLogicalUnits } from "@/lib/contracts/active-contracts";
import {
  createReservationCheckinToken,
  DEFAULT_RESERVATION_CHECKIN_LINK_TTL_MINUTES,
} from "@/lib/reservations/public-checkin-link";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          quantity: true,
          isLicense: true,
          service: { select: { category: true } },
          items: {
            select: {
              quantity: true,
              isExtra: true,
              service: { select: { category: true, code: true } },
            },
          },
          contracts: {
            select: {
              id: true,
              unitIndex: true,
              logicalUnitIndex: true,
              status: true,
              supersededAt: true,
              createdAt: true,
            },
          },
          customerName: true,
          customerPhone: true,
          customerCountry: true,
        },
      });

      if (!current) throw new Error("Reserva no existe");

      const requiredUnits = computeRequiredContractUnits({
        quantity: current.quantity ?? 0,
        isLicense: Boolean(current.isLicense),
        serviceCategory: current.service?.category ?? null,
        items: (current.items ?? []).map((item) => ({
          quantity: item.quantity ?? 0,
          isExtra: Boolean(item.isExtra),
          service: item.service ? { category: item.service.category ?? null, code: item.service.code ?? null } : null,
        })),
      });

      if (requiredUnits > 0) {
        const existing = current.contracts ?? [];
        const hasUnitOne = existing.some((contract) => Number(contract.unitIndex) === 1);

        if (!hasUnitOne) {
          const legacyPrimary = existing
            .filter((contract) => Number(contract.unitIndex) <= 0)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

          if (legacyPrimary) {
            await tx.reservationContract.update({
              where: { id: legacyPrimary.id },
              data: { unitIndex: 1, logicalUnitIndex: 1 },
            });
          }
        }

        const refreshedContracts = await tx.reservationContract.findMany({
          where: { reservationId: current.id },
          select: {
            unitIndex: true,
            logicalUnitIndex: true,
            status: true,
            supersededAt: true,
            createdAt: true,
          },
        });
        const missingSlots = listMissingLogicalUnits(refreshedContracts, requiredUnits);
        const maxUnitIndex = Math.max(0, ...refreshedContracts.map((contract) => Number(contract.unitIndex ?? 0)));

        if (missingSlots.length > 0) {
          await tx.reservationContract.createMany({
            data: missingSlots.map((slot, idx) => ({
              reservationId: current.id,
              unitIndex: maxUnitIndex + idx + 1,
              logicalUnitIndex: slot,
            })),
            skipDuplicates: true,
          });
        }
      }

      return {
        id: current.id,
        customerName: current.customerName,
        customerPhone: current.customerPhone,
        customerCountry: current.customerCountry,
        requiredUnits,
      };
    });

    if (reservation.requiredUnits <= 0) {
      return NextResponse.json({ error: "Esta reserva no requiere contratos." }, { status: 400 });
    }

    const expiresInMinutes = DEFAULT_RESERVATION_CHECKIN_LINK_TTL_MINUTES;
    const token = createReservationCheckinToken({
      reservationId: reservation.id,
      expiresInMinutes,
    });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

    return NextResponse.json({
      ok: true,
      url: `${appUrl}/checkin/${token}`,
      expiresInMinutes,
      reservation: {
        id: reservation.id,
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone,
        customerCountry: reservation.customerCountry,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
