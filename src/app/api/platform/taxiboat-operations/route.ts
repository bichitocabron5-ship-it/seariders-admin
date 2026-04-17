import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  ensureTaxiboatOperations,
  isTaxiboatBoatCode,
} from "@/lib/taxiboat-operations";
import { diffHours } from "@/lib/mechanics";
import { resolveTaxiboatAssetIdFromAssets } from "@/lib/taxiboat-mechanics";

export const runtime = "nodejs";

async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
}

export async function GET() {
  const session = await getSession();
  if (
    !session?.userId ||
    !["ADMIN", "PLATFORM", "BOOTH"].includes(String(session.role))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await ensureTaxiboatOperations();

  const rows = await prisma.taxiboatOperation.findMany({
    orderBy: { boat: "asc" },
    select: {
      id: true,
      boat: true,
      status: true,
      departedBoothAt: true,
      arrivedPlatformAt: true,
      departedPlatformAt: true,
      arrivedBoothAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    rows: rows.map((row) => ({
      ...row,
      departedBoothAt: row.departedBoothAt?.toISOString() ?? null,
      arrivedPlatformAt: row.arrivedPlatformAt?.toISOString() ?? null,
      departedPlatformAt: row.departedPlatformAt?.toISOString() ?? null,
      arrivedBoothAt: row.arrivedBoothAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const boat = String(body?.boat ?? "");
  const action = String(body?.action ?? "");

  if (!isTaxiboatBoatCode(boat)) {
    return NextResponse.json({ error: "Boat invalido" }, { status: 400 });
  }

  if (!["MARK_AT_PLATFORM", "DEPART_TO_BOOTH", "MARK_ARRIVED_BOOTH"].includes(action)) {
    return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
  }

  const role = String(session.role);
  const canPlatform = ["ADMIN", "PLATFORM"].includes(role);
  const canBooth = ["ADMIN", "BOOTH"].includes(role);

  if (
    (action === "MARK_ARRIVED_BOOTH" && !canBooth) ||
    (action !== "MARK_ARRIVED_BOOTH" && !canPlatform)
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await ensureTaxiboatOperations();

  const now = new Date();

  const current = await prisma.taxiboatOperation.findUnique({
    where: { boat },
    select: {
      status: true,
      departedBoothAt: true,
      departedPlatformAt: true,
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Taxiboat no encontrado" }, { status: 404 });
  }

  if (action === "MARK_AT_PLATFORM" && current.status !== "TO_PLATFORM") {
    return NextResponse.json(
      { error: "Solo se puede marcar llegada a Platform si el taxiboat ha salido desde Booth" },
      { status: 409 }
    );
  }

  if (action === "DEPART_TO_BOOTH" && current.status !== "AT_PLATFORM") {
    return NextResponse.json(
      { error: "Solo se puede marcar salida a Booth si el taxiboat esta en Platform" },
      { status: 409 }
    );
  }

  if (action === "MARK_ARRIVED_BOOTH" && current.status !== "TO_BOOTH") {
    return NextResponse.json(
      { error: "Solo se puede marcar llegada a Booth si el taxiboat viene desde Platform" },
      { status: 409 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.taxiboatOperation.update({
      where: { boat },
      data:
        action === "MARK_AT_PLATFORM"
          ? {
              status: "AT_PLATFORM",
              arrivedPlatformAt: now,
            }
          : action === "MARK_ARRIVED_BOOTH"
            ? {
                status: "AT_BOOTH",
                arrivedBoothAt: now,
              }
            : {
                status: "TO_BOOTH",
                departedPlatformAt: now,
              },
      select: {
        id: true,
        boat: true,
        status: true,
        departedBoothAt: true,
        arrivedPlatformAt: true,
        departedPlatformAt: true,
        arrivedBoothAt: true,
        updatedAt: true,
      },
    });

    const travelStartedAt =
      action === "MARK_AT_PLATFORM"
        ? current.departedBoothAt
        : action === "MARK_ARRIVED_BOOTH"
          ? current.departedPlatformAt
          : null;

    if (travelStartedAt) {
      const hoursToAdd = diffHours(travelStartedAt, now);

      if (hoursToAdd > 0) {
        const candidateAssets = await tx.asset.findMany({
          where: {
            type: "BOAT",
          },
          select: {
            id: true,
            name: true,
            code: true,
            meterType: true,
            currentHours: true,
          },
        });

        const assetId = resolveTaxiboatAssetIdFromAssets(candidateAssets, boat);
        const matchedAsset = assetId
          ? candidateAssets.find((asset) => asset.id === assetId) ?? null
          : null;

        if (matchedAsset && matchedAsset.meterType === "HOURS") {
          await tx.asset.update({
            where: { id: matchedAsset.id },
            data: {
              currentHours: Number(matchedAsset.currentHours ?? 0) + hoursToAdd,
            },
          });
        }
      }
    }

    return row;
  });

  return NextResponse.json({
    ok: true,
    row: {
      ...updated,
      departedBoothAt: updated.departedBoothAt?.toISOString() ?? null,
      arrivedPlatformAt: updated.arrivedPlatformAt?.toISOString() ?? null,
      departedPlatformAt: updated.departedPlatformAt?.toISOString() ?? null,
      arrivedBoothAt: updated.arrivedBoothAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
