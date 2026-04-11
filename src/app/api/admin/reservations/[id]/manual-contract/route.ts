import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { OperationalOverrideAction, OperationalOverrideTarget } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";
import { buildManualReservationContractKey, s3 } from "@/lib/s3";

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

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        customerName: true,
        isManualEntry: true,
      },
    });

    if (!reservation) {
      return new NextResponse("Reserva no encontrada", { status: 404 });
    }

    if (!reservation.isManualEntry) {
      return new NextResponse("Solo se puede adjuntar contrato a reservas manuales", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = requireEnv("S3_BUCKET");
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

    const key = buildManualReservationContractKey({
      reservationId: reservation.id,
      displayName: reservation.customerName,
      fileName: file.name || "manual_contract",
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

    const created = await prisma.operationalOverrideLog.create({
      data: {
        targetType: OperationalOverrideTarget.RESERVATION,
        action: OperationalOverrideAction.MANUAL_RESERVATION_CREATE,
        targetId: reservation.id,
        reason: "Adjunto contrato manual",
        payloadJson: {
          kind: "MANUAL_CONTRACT_ATTACHMENT",
          fileKey: key,
          fileUrl,
          fileName: file.name || null,
          uploadedAt: new Date().toISOString(),
        },
        createdByUserId: session.userId,
      },
      select: {
        id: true,
        payloadJson: true,
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: created.id,
        payloadJson: created.payloadJson,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
