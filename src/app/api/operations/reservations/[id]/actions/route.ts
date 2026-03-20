//src/app/api/operations/reservations/[id]/actions/route.ts
import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

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
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
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

        if (!["WAITING", "SCHEDULED"].includes(reservation.status)) {
          throw new Error(`No se puede pasar a READY desde estado ${reservation.status}.`);
        }

        return await tx.reservation.update({
          where: { id },
          data: {
            status: "READY_FOR_PLATFORM",
          },
          select: {
            id: true,
            status: true,
            formalizedAt: true,
          },
        });
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