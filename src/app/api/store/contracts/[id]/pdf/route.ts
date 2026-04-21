// src/app/api/store/contracts/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { buildContractPdfKey, uploadPdfToS3 } from "@/lib/s3";
import { generateContractPdfFromHtml } from "@/lib/contracts/render-contract-pdf";

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
    const contract = await prisma.reservationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        reservationId: true,
        driverName: true,
        renderedHtml: true,
        renderedPdfUrl: true,
        renderedPdfKey: true,
        reservation: {
          select: {
            customerName: true,
          },
        },
      },
    });

    if (!contract) {
      return new NextResponse("Contrato no encontrado", { status: 404 });
    }

    if (!contract.renderedHtml?.trim()) {
      return new NextResponse("Primero genera la vista previa del contrato", {
        status: 400,
      });
    }

    const pdfBuffer = await generateContractPdfFromHtml(contract.renderedHtml);

    const pdfKey = buildContractPdfKey({
      reservationId: contract.reservationId,
      contractId: contract.id,
      displayName: contract.driverName ?? contract.reservation.customerName,
    });

    const uploaded = await uploadPdfToS3({
      key: pdfKey,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    const updated = await prisma.reservationContract.update({
      where: { id: contract.id },
      data: {
        renderedPdfKey: uploaded.key,
        renderedPdfUrl: uploaded.url,
      },
      select: {
        id: true,
        renderedPdfKey: true,
        renderedPdfUrl: true,
      },
    });

    return NextResponse.json({
      ok: true,
      contractId: updated.id,
      renderedPdfKey: updated.renderedPdfKey,
      renderedPdfUrl: updated.renderedPdfUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
