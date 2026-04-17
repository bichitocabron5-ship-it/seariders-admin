import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { getSignedPrivateFileUrl } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    select: {
      isManualEntry: true,
    },
  });

  if (!reservation?.isManualEntry) {
    return new NextResponse("Contrato manual no encontrado", { status: 404 });
  }

  const requestedAttachmentId = new URL(req.url).searchParams.get("attachmentId")?.trim() || null;

  const attachmentLog = await prisma.operationalOverrideLog.findFirst({
    where: {
      targetType: "RESERVATION",
      targetId: id,
      action: "MANUAL_RESERVATION_CREATE",
      reason: "Adjunto contrato manual",
      ...(requestedAttachmentId ? { id: requestedAttachmentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      payloadJson: true,
    },
  });

  const payload =
    attachmentLog?.payloadJson && typeof attachmentLog.payloadJson === "object"
      ? (attachmentLog.payloadJson as Record<string, unknown>)
      : null;
  const fileKey = typeof payload?.fileKey === "string" ? payload.fileKey : null;

  if (!fileKey) {
    return new NextResponse("Contrato manual no encontrado", { status: 404 });
  }

  const url = await getSignedPrivateFileUrl(fileKey, 300);
  return NextResponse.json({ ok: true, url });
}
