import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveContractSignature } from "@/lib/contracts/save-contract-signature";
import { verifyReservationCheckinToken } from "@/lib/reservations/public-checkin-link";
import { evaluateContractCheckinState } from "@/lib/contracts/public-checkin";
import { normalizePublicLanguage, type PublicLanguage } from "@/lib/public-links/i18n";

export const runtime = "nodejs";

const BodySchema = z.object({
  signerName: z.string().trim().min(2),
  imageDataUrl: z.string().trim().min(30),
});

const CHECKIN_SIGNATURE_TEXT = {
  invalidLink: {
    es: "Enlace de pre-checkin no valido o caducado",
    en: "Pre-check-in link is invalid or expired",
    fr: "Le lien de pre-check-in est invalide ou expire",
  },
  contractNotFound: {
    es: "Contrato no encontrado",
    en: "Contract not found",
    fr: "Contrat introuvable",
  },
  notReady: {
    es: "El contrato no esta listo para firmar",
    en: "The contract is not ready to sign",
    fr: "Le contrat n'est pas pret a etre signe",
  },
} as const satisfies Record<string, Record<PublicLanguage, string>>;

function signatureText(language: PublicLanguage, key: keyof typeof CHECKIN_SIGNATURE_TEXT) {
  return CHECKIN_SIGNATURE_TEXT[key][language];
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string; contractId: string }> }) {
  const { token, contractId } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));
  const payload = verifyReservationCheckinToken(token);
  if (!payload) return new NextResponse(signatureText(language, "invalidLink"), { status: 401 });

  try {
    const body = BodySchema.parse(await req.json());
    const contract = await prisma.reservationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        reservationId: true,
        status: true,
        driverName: true,
        driverPhone: true,
        driverCountry: true,
        driverAddress: true,
        driverDocType: true,
        driverDocNumber: true,
        driverBirthDate: true,
        minorAuthorizationProvided: true,
        minorAuthorizationFileKey: true,
        licenseSchool: true,
        licenseType: true,
        licenseNumber: true,
        reservation: {
          select: {
            isLicense: true,
          },
        },
      },
    });

    if (!contract || contract.reservationId !== payload.reservationId) {
      return new NextResponse(signatureText(language, "contractNotFound"), { status: 404 });
    }

    const evaluation = evaluateContractCheckinState({
      isLicense: Boolean(contract.reservation.isLicense),
      status: contract.status,
      language,
      contract,
    });

    if (!evaluation.canBeReady) {
      return new NextResponse(evaluation.blockingReason || signatureText(language, "notReady"), { status: 400 });
    }

    const updated = await saveContractSignature({
      contractId: contract.id,
      signerName: body.signerName,
      imageDataUrl: body.imageDataUrl,
      language,
    });

    return NextResponse.json({ ok: true, contract: updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
