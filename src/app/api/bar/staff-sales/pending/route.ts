import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { prisma } from "@/lib/prisma";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

async function requireBarOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["BAR", "ADMIN"].includes(String(session.role))) return null;
  return session;
}

export async function GET() {
  const session = await requireBarOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.barSale.findMany({
    where: {
      staffMode: true,
      paymentId: null,
    },
    orderBy: [{ soldAt: "desc" }],
    select: {
      id: true,
      soldAt: true,
      totalRevenueCents: true,
      note: true,
      staffEmployeeNameSnap: true,
      employee: {
        select: {
          id: true,
          fullName: true,
          code: true,
        },
      },
      soldByUser: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          revenueCents: true,
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    rows: rows.map((row) => ({
      id: row.id,
      soldAt: row.soldAt,
      totalRevenueCents: row.totalRevenueCents,
      note: row.note,
      employee: row.employee
        ? {
            id: row.employee.id,
            fullName: row.employee.fullName,
            code: row.employee.code,
          }
        : null,
      employeeName: row.employee?.fullName ?? row.staffEmployeeNameSnap ?? "Sin trabajador",
      soldByUser: row.soldByUser
        ? {
            id: row.soldByUser.id,
            fullName: row.soldByUser.fullName,
            username: row.soldByUser.username,
          }
        : null,
      items: row.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: Number(item.quantity ?? 0),
        revenueCents: item.revenueCents,
      })),
    })),
  });
}
