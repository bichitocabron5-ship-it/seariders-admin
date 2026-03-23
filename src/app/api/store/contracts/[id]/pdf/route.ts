// src/app/api/store/contracts/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import puppeteer from "puppeteer";
import { buildContractPdfKey, uploadPdfToS3 } from "@/lib/s3";

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

async function generatePdfFromHtml(html: string) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const htmlWithAbsoluteLogo = html.replace(
      /src="\/logo-seariders\.png"/g,
      `src="${baseUrl}/logo-seariders.png"`
    );

    await page.setContent(htmlWithAbsoluteLogo, {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: {
        top: "20mm",
        right: "12mm",
        bottom: "20mm",
        left: "12mm",
      },
      headerTemplate: `
        <div style="width:100%; font-size:9px; padding:0 12mm; color:#222; text-align:center;">
          UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Dirección: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-size:9px; padding:0 12mm; color:#444; display:flex; justify-content:flex-end;">
          Página <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
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
        renderedHtml: true,
        renderedPdfUrl: true,
        renderedPdfKey: true,
      },
    });

    if (!contract) {
      return new NextResponse("Contrato no encontrado", { status: 404 });
    }

    if (!contract.renderedHtml?.trim()) {
      return new NextResponse(
        "Primero genera la vista previa del contrato",
        { status: 400 }
      );
    }

    const pdfBuffer = await generatePdfFromHtml(contract.renderedHtml);

    const pdfKey = buildContractPdfKey({
      reservationId: contract.reservationId,
      contractId: contract.id,
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