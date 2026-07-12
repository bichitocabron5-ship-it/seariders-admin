import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type AppSession } from "@/lib/session";
import {
  createReservationCheckinToken,
  DEFAULT_RESERVATION_CHECKIN_LINK_TTL_MINUTES,
} from "@/lib/reservations/public-checkin-link";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";
import { syncReservationContractsTx } from "@/lib/reservation-contract-sync";

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
          serviceId: true,
          optionId: true,
          pax: true,
          totalPriceCents: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              totalPriceCents: true,
              isExtra: true,
              service: { select: { name: true, category: true, code: true } },
              option: { select: { durationMinutes: true } },
            },
          },
          contracts: {
            select: {
              id: true,
              reservationItemId: true,
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

      const contractRequirements = buildReservationContractRequirements({
        quantity: current.quantity ?? 0,
        isLicense: Boolean(current.isLicense),
        serviceCategory: current.service?.category ?? null,
        serviceId: current.serviceId,
        optionId: current.optionId,
        serviceName: current.service?.name ?? null,
        durationMinutes: current.option?.durationMinutes ?? null,
        pax: current.pax,
        totalPriceCents: current.totalPriceCents,
        items: current.items ?? [],
      });
      const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
      const requiredUnits = contractRequirements.length;

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

        await syncReservationContractsTx(tx, {
          reservationId: current.id,
          requiredUnits,
          targets: syncTargets,
        });
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
