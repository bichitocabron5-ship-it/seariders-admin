import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import {
  buildContractHtml,
  loadLogoSrc,
  templateCodeForContract,
} from "@/lib/contracts/render-contract";

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

export async function POST(
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
    const logoSrc = await loadLogoSrc();

    const out = await prisma.$transaction(async (tx) => {
      const contract = await tx.reservationContract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          unitIndex: true,
          driverName: true,
          driverDocType: true,
          driverDocNumber: true,
          driverBirthDate: true,
          driverAddress: true,
          driverPostalCode: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          minorAuthorizationProvided: true,
          signatureImageUrl: true,
          signatureSignedBy: true,
          signedAt: true,
          preparedJetski: {
            select: {
              id: true,
              number: true,
              model: true,
              plate: true,
            },
          },
          preparedAsset: {
            select: {
              id: true,
              name: true,
              type: true,
              plate: true,
            },
          },
          reservation: {
            select: {
              id: true,
              activityDate: true,
              scheduledTime: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              customerCountry: true,
              quantity: true,
              pax: true,
              totalPriceCents: true,
              isLicense: true,
              option: {
                select: {
                  durationMinutes: true,
                },
              },
              service: {
                select: {
                  name: true,
                  category: true,
                },
              },
            },
          },
        },
      });

      if (!contract) {
        throw new Error("Contrato no encontrado");
      }

      const hasLicense =
        Boolean(contract.licenseNumber?.trim()) ||
        Boolean(contract.reservation.isLicense);
      const templateCode = templateCodeForContract({
        category: contract.reservation.service?.category ?? null,
        hasLicense,
      });
      const templateVersion = "v1";

      const renderedHtml = buildContractHtml({
        templateCode,
        templateVersion,
        logoSrc,
        reservation: {
          id: contract.reservation.id,
          activityDate: contract.reservation.activityDate,
          scheduledTime: contract.reservation.scheduledTime,
          customerName: contract.reservation.customerName,
          customerEmail: contract.reservation.customerEmail,
          customerPhone: contract.reservation.customerPhone,
          customerCountry: contract.reservation.customerCountry,
          serviceName: contract.reservation.service?.name ?? null,
          serviceCategory: contract.reservation.service?.category ?? null,
          quantity: contract.reservation.quantity,
          pax: contract.reservation.pax,
          durationMinutes: contract.reservation.option?.durationMinutes ?? null,
          totalPriceCents: contract.reservation.totalPriceCents,
        },
        contract: {
          id: contract.id,
          unitIndex: contract.unitIndex,
          driverName: contract.driverName,
          driverDocType: contract.driverDocType,
          driverDocNumber: contract.driverDocNumber,
          driverBirthDate: contract.driverBirthDate,
          driverAddress: contract.driverAddress,
          driverPostalCode: contract.driverPostalCode,
          driverPhone: contract.driverPhone,
          driverEmail: contract.driverEmail,
          driverCountry: contract.driverCountry,
          licenseSchool: contract.licenseSchool,
          licenseType: contract.licenseType,
          licenseNumber: contract.licenseNumber,
          minorAuthorizationProvided: contract.minorAuthorizationProvided,
          signatureImageUrl: contract.signatureImageUrl,
          signatureSignedBy: contract.signatureSignedBy,
          signedAt: contract.signedAt,
          preparedJetski: contract.preparedJetski ?? null,
          preparedAsset: contract.preparedAsset ?? null,
        },
      });

      const updated = await tx.reservationContract.update({
        where: { id: contractId },
        data: {
          templateCode,
          templateVersion,
          renderedHtml,
        },
        select: {
          id: true,
          templateCode: true,
          templateVersion: true,
          renderedHtml: true,
        },
      });

      return { ok: true, contract: updated };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
