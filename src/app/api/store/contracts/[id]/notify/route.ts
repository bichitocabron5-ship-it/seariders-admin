import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendContractSignerWhatsapp } from "@/lib/contracts/notifications";

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
  const contract = await prisma.reservationContract.findUnique({
    where: { id },
    select: {
      id: true,
      unitIndex: true,
      logicalUnitIndex: true,
      driverName: true,
      driverPhone: true,
      driverCountry: true,
      reservation: {
        select: {
          customerName: true,
          customerPhone: true,
          customerCountry: true,
        },
      },
    },
  });

  if (!contract) return new NextResponse("Contrato no encontrado", { status: 404 });

  const recipientName =
    contract.driverName?.trim() ||
    contract.reservation.customerName?.trim() ||
    "cliente";
  const phone =
    contract.driverPhone?.trim() ||
    contract.reservation.customerPhone?.trim() ||
    null;
  const country =
    contract.driverCountry?.trim() ||
    contract.reservation.customerCountry?.trim() ||
    "ES";

  const notification = await sendContractSignerWhatsapp({
    contractId: contract.id,
    unitLabel: `Unidad #${contract.logicalUnitIndex ?? contract.unitIndex}`,
    recipientName,
    phone,
    country,
    expiresInMinutes: 45,
  }).catch((error: unknown) => ({
    ok: false as const,
    status: "FAILED",
    error: error instanceof Error ? error.message : "Error enviando WhatsApp de contrato",
  }));

  return NextResponse.json({ ok: true, notification });
}
