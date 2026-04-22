//src/app/api/operations/reservations/[id]/actions/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { z, type ZodIssue } from "zod";
import { ReservationStatus } from "@prisma/client";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { evaluateReadyForPlatform } from "@/lib/ready-for-platform";
import { ensureReservationPlatformUnitsTx } from "@/lib/reservation-platform";

export const runtime = "nodejs";

async function requireOpsOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (["ADMIN", "STORE", "PLATFORM", "BOOTH"].includes(session.role as string)) {
    return session;
  }
  return null;
}

const Body = z.object({
  action: z.enum(["mark_ready", "mark_in_sea"]),
});

function validationMessage(issues: ZodIssue[]) {
  const first = issues[0];
  return first?.message || "Body inválido";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireOpsOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: validationMessage(parsed.error.issues) }, { status: 400 });
  }

  const { action } = parsed.data;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          formalizedAt: true,
          paymentCompletedAt: true,
          totalPriceCents: true,
          depositCents: true,
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
          contracts: {
            select: {
              unitIndex: true,
              logicalUnitIndex: true,
              status: true,
              supersededAt: true,
              createdAt: true,
            },
          },
          payments: {
            select: {
              amountCents: true,
              isDeposit: true,
              direction: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new Error("Reserva no existe");
      }

      if (action === "mark_ready") {
        if (!reservation.formalizedAt) {
          throw new Error("La reserva debe estar formalizada antes de pasar a READY_FOR_PLATFORM.");
        }

        if (reservation.status === "IN_SEA") {
          throw new Error("La reserva ya está en IN_SEA.");
        }

        if (reservation.status === "READY_FOR_PLATFORM") {
          return reservation;
        }

        const readyCheck = evaluateReadyForPlatform({
          status: reservation.status,
          formalizedAt: reservation.formalizedAt,
          totalPriceCents: reservation.totalPriceCents,
          depositCents: reservation.depositCents,
          quantity: reservation.quantity,
          isLicense: Boolean(reservation.isLicense),
          service: reservation.service,
          items: (reservation.items ?? []).map((item) => ({
            quantity: item.quantity ?? 0,
            isExtra: Boolean(item.isExtra),
            service: item.service ? { category: item.service.category ?? null } : null,
          })),
          contracts: (reservation.contracts ?? []).map((contract) => ({
            unitIndex: Number(contract.unitIndex ?? 0),
            logicalUnitIndex: contract.logicalUnitIndex ?? null,
            status: contract.status,
            supersededAt: contract.supersededAt ?? null,
            createdAt: contract.createdAt ?? null,
          })),
          payments: (reservation.payments ?? []).map((payment) => ({
            amountCents: Number(payment.amountCents ?? 0),
            isDeposit: Boolean(payment.isDeposit),
            direction: payment.direction,
          })),
        });
        if (!readyCheck.ok) {
          throw new Error(readyCheck.error);
        }

        const readyAt = new Date();
        const updated = await tx.reservation.update({
          where: { id },
          data: {
            status: ReservationStatus.READY_FOR_PLATFORM,
            paymentCompletedAt: reservation.paymentCompletedAt ?? readyAt,
            readyForPlatformAt: readyAt,
          },
          select: {
            id: true,
            status: true,
            formalizedAt: true,
          },
        });

        await ensureReservationPlatformUnitsTx(
          tx,
          {
            id: reservation.id,
            quantity: reservation.quantity,
            isPackParent: reservation.isPackParent,
            parentReservationId: reservation.parentReservationId,
            serviceCategory: reservation.service?.category ?? null,
            items: (reservation.items ?? []).map((item) => ({
              quantity: item.quantity ?? 0,
              isExtra: Boolean(item.isExtra),
              service: item.service ? { category: item.service.category ?? null } : null,
            })),
          },
          readyAt
        );

        await tx.reservationUnit.updateMany({
          where: { reservationId: id, status: "READY_FOR_PLATFORM" },
          data: { readyForPlatformAt: readyAt },
        });

        await syncStoreFulfillmentTasksForReservation(tx, id);

        return updated;
      }

      if (action === "mark_in_sea") {
        if (reservation.status === "IN_SEA") {
          return reservation;
        }

        if (reservation.status !== "READY_FOR_PLATFORM") {
          throw new Error("Solo se puede pasar a IN_SEA desde READY_FOR_PLATFORM.");
        }

        return await tx.reservation.update({
          where: { id },
          data: {
            status: "IN_SEA",
          },
          select: {
            id: true,
            status: true,
            formalizedAt: true,
          },
        });
      }

      throw new Error("Acción no soportada");
    });

    return NextResponse.json({ ok: true, row });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
