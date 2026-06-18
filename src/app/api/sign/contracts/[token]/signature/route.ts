import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import { saveContractSignature } from "@/lib/contracts/save-contract-signature";
import { normalizePublicLanguage, type PublicLanguage } from "@/lib/public-links/i18n";

export const runtime = "nodejs";

const BodySchema = z.object({
  signerName: z.string().trim().min(2),
  imageDataUrl: z.string().trim().min(30),
  imageConsentAccepted: z.boolean().optional(),
});

const SIGNATURE_ROUTE_TEXT = {
  invalidLink: {
    es: "Enlace de firma no valido o caducado",
    en: "Signature link is invalid or expired",
    fr: "Le lien de signature est invalide ou expire",
  },
} as const satisfies Record<string, Record<PublicLanguage, string>>;

function signatureRouteText(language: PublicLanguage, key: keyof typeof SIGNATURE_ROUTE_TEXT) {
  return SIGNATURE_ROUTE_TEXT[key][language];
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));
  const payload = verifyContractSignatureToken(token);
  if (!payload) {
    return new NextResponse(signatureRouteText(language, "invalidLink"), { status: 401 });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const contract = await saveContractSignature({
      contractId: payload.contractId,
      signerName: body.signerName,
      imageDataUrl: body.imageDataUrl,
      imageConsentAccepted: body.imageConsentAccepted,
      language,
      signedLanguage: language,
    });

    return NextResponse.json({ ok: true, contract });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
