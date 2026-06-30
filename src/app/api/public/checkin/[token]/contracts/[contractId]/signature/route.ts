import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ContractSignatureError,
  saveContractSignature,
} from "@/lib/contracts/save-contract-signature";
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
} as const satisfies Record<string, Record<PublicLanguage, string>>;

function signatureText(language: PublicLanguage, key: keyof typeof CHECKIN_SIGNATURE_TEXT) {
  return CHECKIN_SIGNATURE_TEXT[key][language];
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string; contractId: string }> }) {
  const { token, contractId } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));

  try {
    const body = BodySchema.parse(await req.json());
    const updated = await saveContractSignature({
      contractId,
      signerName: body.signerName,
      imageDataUrl: body.imageDataUrl,
      language,
      access: { type: "reservation-checkin-token", token },
    });

    return NextResponse.json({ ok: true, contract: updated });
  } catch (e: unknown) {
    if (e instanceof ContractSignatureError && e.code === "INVALID_SIGNATURE_TOKEN") {
      return new NextResponse(signatureText(language, "invalidLink"), { status: e.status });
    }

    if (e instanceof ContractSignatureError && e.code === "CONTRACT_NOT_FOUND") {
      return new NextResponse(signatureText(language, "contractNotFound"), { status: e.status });
    }

    const message = e instanceof Error ? e.message : "Error";
    const status = e instanceof ContractSignatureError ? e.status : 400;
    return new NextResponse(message, { status });
  }
}
