import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendContractSignerWhatsapp } from "@/lib/contracts/notifications";
import { evaluatePublicContractAccess } from "@/lib/contracts/public-contract-access";
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
      reservationId: true,
      reservationItemId: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
      driverName: true,
      driverPhone: true,
      driverCountry: true,
      reservationItem: { select: { id: true, reservationId: true } },
      reservation: {
        select: {
          id: true,
          quantity: true,
          isLicense: true,
          serviceId: true,
          optionId: true,
          pax: true,
          totalPriceCents: true,
          customerName: true,
          customerPhone: true,
          customerCountry: true,
          service: { select: { name: true, category: true } },
          option: { select: { durationMinutes: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              reservationId: true,
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              totalPriceCents: true,
              isExtra: true,
              service: { select: { name: true, category: true } },
              option: { select: { durationMinutes: true } },
            },
          },
          contracts: {
            select: {
              id: true,
              reservationId: true,
              reservationItemId: true,
              unitIndex: true,
              logicalUnitIndex: true,
              status: true,
              supersededAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!contract) return new NextResponse("Contrato no encontrado", { status: 404 });
  const access = evaluatePublicContractAccess({
    reservation: contract.reservation,
    contract,
  });
  if (!access.ok) return new NextResponse("Contrato no vigente para esta reserva", { status: 409 });

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
