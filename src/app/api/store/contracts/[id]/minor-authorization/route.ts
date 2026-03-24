// src/app/api/store/contracts/[id]/minor-authorization/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3, buildMinorAuthorizationKey } from "@/lib/s3";

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
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
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new NextResponse("Archivo no válido", { status: 400 });
    }

    if (file.size <= 0) {
      return new NextResponse("Archivo vacío", { status: 400 });
    }

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      return new NextResponse("Formato no permitido. Usa PDF, JPG, PNG o WEBP.", { status: 400 });
    }

    const contract = await prisma.reservationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        reservationId: true,
        driverName: true,
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = requireEnv("S3_BUCKET");
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

    const key = buildMinorAuthorizationKey({
      reservationId: contract.reservationId,
      contractId: contract.id,
      displayName: contract.driverName ?? contract.reservation.customerName,
      fileName: file.name || "minor_authorization",
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const fileUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : null;

    const updated = await prisma.reservationContract.update({
      where: { id: contract.id },
      data: {
        minorAuthorizationProvided: true,
        minorAuthorizationFileKey: key,
        minorAuthorizationFileUrl: fileUrl,
        minorAuthorizationFileName: file.name || null,
        minorAuthorizationUploadedAt: new Date(),
      },
      select: {
        id: true,
        minorAuthorizationProvided: true,
        minorAuthorizationFileKey: true,
        minorAuthorizationFileUrl: true,
        minorAuthorizationFileName: true,
        minorAuthorizationUploadedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      contract: updated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const contract = await prisma.reservationContract.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!contract) {
      return new NextResponse("Contrato no encontrado", { status: 404 });
    }

    const updated = await prisma.reservationContract.update({
      where: { id: contract.id },
      data: {
        minorAuthorizationProvided: false,
        minorAuthorizationFileKey: null,
        minorAuthorizationFileUrl: null,
        minorAuthorizationFileName: null,
        minorAuthorizationUploadedAt: null,
      },
      select: {
        id: true,
        minorAuthorizationProvided: true,
        minorAuthorizationFileKey: true,
        minorAuthorizationFileUrl: true,
        minorAuthorizationFileName: true,
        minorAuthorizationUploadedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      contract: updated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
