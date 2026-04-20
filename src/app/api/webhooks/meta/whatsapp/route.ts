import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from "@/lib/notifications/meta-webhook";

export const runtime = "nodejs";

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{ message?: string; title?: string; code?: number }>;
};

function collectStatuses(payload: unknown): MetaStatus[] {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: MetaStatus[];
        };
      }>;
    }>;
  };

  const out: MetaStatus[] = [];
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        out.push(status);
      }
    }
  }
  return out;
}

function normalizeNotificationStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "sent" || normalized === "accepted") return "SENT";
  if (normalized === "delivered") return "DELIVERED";
  if (normalized === "read") return "READ";
  if (normalized === "failed") return "FAILED";
  return normalized ? normalized.toUpperCase() : "UNKNOWN";
}

function statusTimestamp(status: MetaStatus) {
  const value = Number(status.timestamp ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000);
}

function statusErrorMessage(status: MetaStatus) {
  const first = status.errors?.[0];
  if (!first) return null;
  return first.message || first.title || (typeof first.code === "number" ? `Meta error ${first.code}` : null);
}

async function applyStatusUpdate(status: MetaStatus) {
  const providerMessageId = String(status.id ?? "").trim();
  if (!providerMessageId) return;

  const mappedStatus = normalizeNotificationStatus(status.status);
  const errorMessage = statusErrorMessage(status);
  const sentAt = mappedStatus === "SENT" ? statusTimestamp(status) : undefined;

  await prisma.$transaction([
    prisma.passNotification.updateMany({
      where: { providerMessageId },
      data: {
        status: mappedStatus,
        ...(errorMessage !== null ? { errorMessage } : {}),
        ...(sentAt ? { sentAt } : {}),
      },
    }),
    prisma.contractNotification.updateMany({
      where: { providerMessageId },
      data: {
        status: mappedStatus,
        ...(errorMessage !== null ? { errorMessage } : {}),
        ...(sentAt ? { sentAt } : {}),
      },
    }),
  ]);
}

export async function GET(req: Request) {
  const challenge = verifyMetaWebhookChallenge(new URL(req.url).searchParams);
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  if (!verifyMetaWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody || "{}") as unknown;
  const statuses = collectStatuses(payload);

  for (const status of statuses) {
    await applyStatusUpdate(status);
  }

  return NextResponse.json({ ok: true, processedStatuses: statuses.length });
}
