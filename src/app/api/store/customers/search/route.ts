// src/app/api/store/customers/search/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const Query = z.object({
  q: z.string().trim().min(1),
  take: z.coerce.number().int().min(1).max(20).optional().default(8),
});

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

function toYmd(value: Date | null | undefined) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    q: url.searchParams.get("q") ?? "",
    take: url.searchParams.get("take") ?? undefined,
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { q, take } = parsed.data;

  const rows = await prisma.reservation.findMany({
    where: {
      formalizedAt: { not: null },
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { customerDocNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [
      { activityDate: "desc" },
      { createdAt: "desc" },
    ],
    take,
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerDocNumber: true,
      customerCountry: true,
      customerBirthDate: true,
      customerPostalCode: true,
      customerAddress: true,
      licenseNumber: true,
      activityDate: true,
      service: {
        select: {
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => ({
      reservationId: r.id,
      customerName: r.customerName ?? null,
      serviceName: r.service?.name ?? null,
      email: r.customerEmail ?? null,
      phone: r.customerPhone ?? null,
      customerDocNumber: r.customerDocNumber ?? null,
      country: r.customerCountry ?? null,
      birthDate: toYmd(r.customerBirthDate),
      address: r.customerAddress ?? null,
      postalCode: r.customerPostalCode ?? null,
      licenseNumber: r.licenseNumber ?? null,
      lastActivityAt: r.activityDate ?? null,
    })),
  });
}
