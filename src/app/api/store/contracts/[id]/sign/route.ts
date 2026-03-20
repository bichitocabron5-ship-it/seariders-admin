// src/app/api/store/contracts/[id]/sign/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ContractStatus } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function PATCH(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contractId = id;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.reservationContract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          status: true,
          renderedHtml: true,
        },
      });

      if (!current) {
        throw new Error("Contrato no encontrado");
      }

      if (current.status === ContractStatus.VOID) {
        throw new Error("No se puede firmar un contrato VOID");
      }

      if (!current.renderedHtml?.trim()) {
        throw new Error("Genera antes la vista previa del contrato");
      }

      return await tx.reservationContract.update({
        where: { id: contractId },
        data: {
          status: ContractStatus.SIGNED,
          signedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          signedAt: true,
        },
      });
    });

    return NextResponse.json({ ok: true, contract: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}