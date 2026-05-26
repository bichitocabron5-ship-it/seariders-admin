import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export const OPERATIONAL_LOG_SOURCES = [
  "STORE",
  "BOOTH",
  "PLATFORM",
  "ADMIN",
  "SCRIPT",
] as const;

export type OperationalLogSource = (typeof OPERATIONAL_LOG_SOURCES)[number];

export type OperationalLogActor = {
  userId?: string | null;
  actorName?: string | null;
};

export type OperationalLogRequestContext = {
  ip?: string | null;
  userAgent?: string | null;
};

export type WriteOperationalLogInput = {
  action: string;
  entityType: string;
  entityId: string;
  source?: OperationalLogSource | null;
  metadata?: Prisma.InputJsonValue;
  actor?: OperationalLogActor | null;
  request?: OperationalLogRequestContext | null;
};

function normalizeString(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function resolveActorName(
  db: DbClient,
  actor?: OperationalLogActor | null
) {
  const explicitName = normalizeString(actor?.actorName);
  if (explicitName) return explicitName;

  const userId = normalizeString(actor?.userId);
  if (!userId) return "SYSTEM";

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });

  return normalizeString(user?.fullName) ?? normalizeString(user?.username) ?? "SYSTEM";
}

export function getRequestOperationalContext(
  req: Pick<Request, "headers">
): OperationalLogRequestContext {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip =
    normalizeString(forwardedFor?.split(",")[0]) ??
    normalizeString(req.headers.get("x-real-ip")) ??
    null;

  return {
    ip,
    userAgent: normalizeString(req.headers.get("user-agent")),
  };
}

export async function writeOperationalLog(
  input: WriteOperationalLogInput,
  db: DbClient = prisma
) {
  const userId = normalizeString(input.actor?.userId);
  const actorName = await resolveActorName(db, input.actor);

  return db.operationalLog.create({
    data: {
      userId,
      actorName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      source: normalizeString(input.source),
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ip: normalizeString(input.request?.ip),
      userAgent: normalizeString(input.request?.userAgent),
    },
  });
}
