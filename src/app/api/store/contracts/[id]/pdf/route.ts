// src/app/api/store/contracts/[id]/pdf/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

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
        renderedHtml: true,
        renderedPdfUrl: true,
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

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(contract.renderedHtml, {
        waitUntil: "networkidle0",
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "16mm",
          right: "12mm",
          bottom: "16mm",
          left: "12mm",
        },
      });

      const dir = path.join(process.cwd(), "public", "generated-contracts");
      await fs.mkdir(dir, { recursive: true });

      const filename = `contract-${contract.id}.pdf`;
      const absolutePath = path.join(dir, filename);
      const publicUrl = `/generated-contracts/${filename}`;

      await fs.writeFile(absolutePath, pdfBuffer);

      await prisma.reservationContract.update({
        where: { id: contract.id },
        data: {
          renderedPdfUrl: publicUrl,
        },
      });

      return NextResponse.json({
        ok: true,
        contractId: contract.id,
        renderedPdfUrl: publicUrl,
      });
    } finally {
      await browser.close();
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}