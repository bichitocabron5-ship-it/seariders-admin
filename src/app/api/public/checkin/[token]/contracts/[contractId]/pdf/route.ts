import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { regenerateSignedContractPdf } from "@/lib/contracts/render-contract-pdf";
import { getSignedContractPdfUrl } from "@/lib/s3";
import { verifyReservationCheckinToken } from "@/lib/reservations/public-checkin-link";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ token: string; contractId: string }> }) {
  const { token, contractId } = await ctx.params;
  const payload = verifyReservationCheckinToken(token);
  if (!payload) return new NextResponse("Enlace de pre-checkin no valido o caducado", { status: 401 });

  try {
    const existing = await prisma.reservationContract.findUnique({
      where: { id: contractId },
      select: { id: true, reservationId: true },
    });
    if (!existing || existing.reservationId !== payload.reservationId) {
      return new NextResponse("Contrato no encontrado", { status: 404 });
    }

    const contract = await regenerateSignedContractPdf(existing.id);
    if (!contract.renderedPdfKey) {
      return new NextResponse("PDF no disponible", { status: 404 });
    }

    const url = await getSignedContractPdfUrl(contract.renderedPdfKey, 300);
    return NextResponse.redirect(url);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    if (message.includes("Could not find Chrome")) {
      const fallback = await prisma.reservationContract.findUnique({
        where: { id: contractId },
        select: { renderedHtml: true },
      });
      if (fallback?.renderedHtml?.trim()) {
        return new NextResponse(fallback.renderedHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new NextResponse("No se pudo generar el PDF. Abre el contrato en el navegador y usa Imprimir > Guardar como PDF.", { status: 503 });
    }
    return new NextResponse(message, { status: 400 });
  }
}
