// src/app/api/mechanics/events/lookup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireAdminOrMechanic() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );
  if (!session?.userId) return null;
  if (["ADMIN", "MECHANIC", "PLATFORM"].includes(session.role as string)) return session;
  return null;
}

export async function GET(req: NextRequest) {
  const session = await requireAdminOrMechanic();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const onlyOpen = req.nextUrl.searchParams.get("onlyOpen") === "true";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "30"), 100);
  const numericQ = Number(q);
  const hasNumericQ = q !== "" && Number.isFinite(numericQ);

  const rows = await prisma.maintenanceEvent.findMany({
    where: {
      ...(onlyOpen
        ? {
            status: {
              in: ["OPEN", "IN_PROGRESS", "EXTERNAL"],
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { faultCode: { contains: q, mode: "insensitive" } },
              { supplierName: { contains: q, mode: "insensitive" } },
              ...(hasNumericQ
                ? [
                    {
                      jetski: {
                        is: {
                          number: numericQ,
                        },
                      },
                    },
                  ]
                : []),
              {
                asset: {
                  is: {
                    name: { contains: q, mode: "insensitive" },
                  },
                },
              },
              {
                asset: {
                  is: {
                    code: { contains: q, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      entityType: true,
      type: true,
      status: true,
      severity: true,
      faultCode: true,
      createdAt: true,
      jetski: {
        select: {
          id: true,
          number: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  const mapped = rows.map((r) => ({
    ...r,
    label:
      r.entityType === "JETSKI"
        ? `${r.type} · Jetski ${r.jetski?.number ?? "—"} · ${r.status}${r.faultCode ? ` · ${r.faultCode}` : ""}`
        : `${r.type} · ${r.asset?.name ?? "Asset"}${r.asset?.code ? ` (${r.asset.code})` : ""} · ${r.status}${r.faultCode ? ` · ${r.faultCode}` : ""}`,
  }));

  return NextResponse.json({ ok: true, rows: mapped });
}
