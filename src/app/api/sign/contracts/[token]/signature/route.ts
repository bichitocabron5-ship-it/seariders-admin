import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import { saveContractSignature } from "@/lib/contracts/save-contract-signature";

export const runtime = "nodejs";

const BodySchema = z.object({
  signerName: z.string().trim().min(2),
  imageDataUrl: z.string().trim().min(30),
  imageConsentAccepted: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyContractSignatureToken(token);
  if (!payload) return new NextResponse("Enlace de firma no válido o caducado", { status: 401 });

  try {
    const body = BodySchema.parse(await req.json());
    const contract = await saveContractSignature({
      contractId: payload.contractId,
      signerName: body.signerName,
      imageDataUrl: body.imageDataUrl,
      imageConsentAccepted: body.imageConsentAccepted,
    });

    return NextResponse.json({ ok: true, contract });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
