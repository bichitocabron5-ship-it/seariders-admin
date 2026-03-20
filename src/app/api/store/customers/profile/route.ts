// src/app/api/store/customers/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const Query = z.object({
  reservationId: z.string().min(1),
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

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    reservationId: url.searchParams.get("reservationId") ?? "",
  });

  if (!parsed.success) {
    return new NextResponse("Query inválida", { status: 400 });
  }

  const { reservationId } = parsed.data;

  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerDocNumber: true,
      customerCountry: true,
      customerBirthDate: true,
      customerAddress: true,
      customerPostalCode: true,
      licenseNumber: true,
    },
  });

  if (!r) {
    return new NextResponse("Ficha no encontrada", { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      customerName: r.customerName,
      email: r.customerEmail,
      phone: r.customerPhone,
      customerDocNumber: r.customerDocNumber,
      country: r.customerCountry,
      birthDate: r.customerBirthDate,
      address: r.customerAddress,
      postalCode: r.customerPostalCode,
      licenseNumber: r.licenseNumber,
    },
  });
}