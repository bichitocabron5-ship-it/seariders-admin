// src/app/api/store/contracts/[id]/signature/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "@/lib/s3";
import { regenerateSignedContractPdf } from "@/lib/contracts/render-contract-pdf";

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

const BodySchema = z.object({
  signerName: z.string().trim().min(2),
  imageDataUrl: z.string().trim().min(30),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

function buildSignatureKey(args: { contractId: string; reservationId: string }) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/signature_${args.contractId}.png`;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Formato de firma no válido");
  return Buffer.from(match[1], "base64");
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contractId = id;

  try {
    const body = BodySchema.parse(await req.json());

    const contract = await prisma.reservationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        reservationId: true,
      },
    });

    if (!contract) {
      return new NextResponse("Contrato no encontrado", { status: 404 });
    }

    const buffer = dataUrlToBuffer(body.imageDataUrl);
    const bucket = requireEnv("S3_BUCKET");
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

    const key = buildSignatureKey({
      contractId: contract.id,
      reservationId: contract.reservationId,
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      })
    );

    const imageUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : body.imageDataUrl;

    await prisma.reservationContract.update({
      where: { id: contract.id },
      data: {
        signatureImageKey: key,
        signatureImageUrl: imageUrl,
        signatureSignedBy: body.signerName,
        signedAt: new Date(),
        status: "SIGNED",
      },
    });

    const regenerated = await regenerateSignedContractPdf(contract.id);

    return NextResponse.json({
      ok: true,
      contract: regenerated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
