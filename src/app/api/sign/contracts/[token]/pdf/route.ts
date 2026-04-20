import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import { regenerateSignedContractPdf } from "@/lib/contracts/render-contract-pdf";
import { getSignedContractPdfUrl } from "@/lib/s3";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));
  const payload = verifyContractSignatureToken(token);
  if (!payload) return new NextResponse(language === "en" ? "Signature link is invalid or expired" : "Enlace de firma no valido o caducado", { status: 401 });

  try {
    const contract = await regenerateSignedContractPdf(payload.contractId, language);
    if (!contract.renderedPdfKey) {
      return new NextResponse(language === "en" ? "PDF not available" : "PDF no disponible", { status: 404 });
    }

    const url = await getSignedContractPdfUrl(contract.renderedPdfKey, 300);
    return NextResponse.redirect(url);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    if (message.includes("Could not find Chrome")) {
      const fallback = await prisma.reservationContract.findUnique({
        where: { id: payload.contractId },
        select: { renderedHtml: true },
      });
      if (fallback?.renderedHtml?.trim()) {
        return new NextResponse(fallback.renderedHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new NextResponse(
        language === "en"
          ? "The PDF could not be generated. Open the contract in the browser and use Print > Save as PDF."
          : "No se pudo generar el PDF. Abre el contrato en el navegador y usa Imprimir > Guardar como PDF.",
        { status: 503 }
      );
    }
    return new NextResponse(message, { status: 400 });
  }
}
