//src/app/api/operations/reservations/[id]/actions/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { z, type ZodIssue } from "zod";
import {
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";

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

const Body = z
  .object({
    action: z.enum(["mark_ready", "mark_in_sea", "force_ready"]),
    reason: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "force_ready" && !value.reason?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "El motivo es obligatorio para forzar READY.",
      });
    }
  });

function validationMessage(issues: ZodIssue[]) {
  const first = issues[0];
  return first?.message || "Body inválido";
}

async function ensureUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: {
    id: string;
    quantity: number | null;
    isPackParent: boolean | null;
    parentReservationId: string | null;
    isLicense: boolean;
    serviceCategory?: string | null;
    items: Array<{ quantity: number | null; isExtra: boolean; service: { category: string | null } | null }>;
  },
  readyAt?: Date
) {
  if (reservation.isPackParent && !reservation.parentReservationId) return;

  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.serviceCategory ?? null,
    items: reservation.items ?? [],
  });
  if (requiredUnits <= 0) return;

  const existing = await tx.reservationUnit.findMany({
    where: { reservationId: reservation.id },
    select: { unitIndex: true },
  });
  const set = new Set(existing.map((u) => Number(u.unitIndex)));

  const toCreate: Array<{ reservationId: string; unitIndex: number; readyForPlatformAt?: Date }> = [];
  for (let i = 1; i <= requiredUnits; i++) {
    if (!set.has(i)) {
      toCreate.push({
        reservationId: reservation.id,
        unitIndex: i,
        ...(readyAt ? { readyForPlatformAt: readyAt } : {}),
      });
    }
  }

  if (toCreate.length > 0) {
    await tx.reservationUnit.createMany({ data: toCreate, skipDuplicates: true });
  }
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

  const { action, reason } = parsed.data;

  try {
    const row = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          formalizedAt: true,
          paymentCompletedAt: true,
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

      if (!reservation) {
        throw new Error("Reserva no existe");
      }

      if (action === "mark_ready" || action === "force_ready") {
        const isOverride = action === "force_ready";

        if (!reservation.formalizedAt && !isOverride) {
          throw new Error("La reserva debe estar formalizada antes de pasar a READY_FOR_PLATFORM.");
        }

        if (reservation.status === "IN_SEA") {
          throw new Error("La reserva ya está en IN_SEA.");
        }

        if (reservation.status === "READY_FOR_PLATFORM") {
          return reservation;
        }

        if (!["WAITING", "SCHEDULED"].includes(reservation.status)) {
          throw new Error(`No se puede pasar a READY desde estado ${reservation.status}.`);
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

        await ensureUnitsTx(
          tx,
          {
            id: reservation.id,
            quantity: reservation.quantity,
            isPackParent: reservation.isPackParent,
            parentReservationId: reservation.parentReservationId,
            isLicense: Boolean(reservation.isLicense),
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

        if (isOverride && reason) {
          const audit = tx as typeof prisma;
          await audit.operationalOverrideLog.create({
            data: {
              targetType: "RESERVATION",
              action: "FORCE_READY",
              targetId: reservation.id,
              reason,
              createdByUserId: session.userId,
              payloadJson: {
                previousStatus: reservation.status,
                nextStatus: ReservationStatus.READY_FOR_PLATFORM,
                formalizedAt: reservation.formalizedAt?.toISOString?.() ?? null,
              },
            },
            select: { id: true },
          });
        }

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
