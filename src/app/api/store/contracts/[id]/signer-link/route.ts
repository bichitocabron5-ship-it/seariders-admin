import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendContractSignerWhatsapp } from "@/lib/contracts/notifications";
import { resolveContractNotificationRecipient } from "@/lib/reservation-parties";
import { DEFAULT_CONTRACT_SIGNATURE_LINK_TTL_MINUTES } from "@/lib/contracts/signature-link";

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

  const expiresInMinutes = DEFAULT_CONTRACT_SIGNATURE_LINK_TTL_MINUTES;
  const recipient = resolveContractNotificationRecipient({
    contract,
    reservation: contract.reservation,
  });

  const notification = await sendContractSignerWhatsapp({
    contractId: contract.id,
    unitLabel: `Unidad #${contract.logicalUnitIndex ?? contract.unitIndex}`,
    recipientName: recipient.recipientName,
    phone: recipient.phone,
    country: recipient.country,
    expiresInMinutes,
  }).catch((error: unknown) => ({
    ok: false as const,
    status: "FAILED",
    error: error instanceof Error ? error.message : "Error enviando WhatsApp de contrato",
  }));

  return NextResponse.json({
    ok: true,
    url: "url" in notification ? notification.url : null,
    localizedUrl: "localizedUrl" in notification ? notification.localizedUrl : null,
    manualMessage: "message" in notification ? notification.message : null,
    expiresInMinutes,
    notification,
  });
}
