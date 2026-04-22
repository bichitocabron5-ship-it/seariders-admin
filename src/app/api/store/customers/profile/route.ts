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
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerDocType: true,
      customerDocNumber: true,
      customerCountry: true,
      customerBirthDate: true,
      customerAddress: true,
      customerPostalCode: true,
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,
      service: {
        select: {
          name: true,
        },
      },
      contracts: {
        where: {
          supersededAt: null,
          status: { not: "VOID" },
        },
        orderBy: [{ signedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          driverName: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          driverAddress: true,
          driverPostalCode: true,
          driverDocType: true,
          driverDocNumber: true,
          driverBirthDate: true,
          minorAuthorizationProvided: true,
          imageConsentAccepted: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
        },
      },
    },
  });

  if (!r) {
    return new NextResponse("Ficha no encontrada", { status: 404 });
  }

  const latestContract = r.contracts[0] ?? null;

  return NextResponse.json({
    ok: true,
    profile: {
      customerName: r.customerName,
      email: r.customerEmail,
      phone: r.customerPhone,
      customerDocType: r.customerDocType,
      customerDocNumber: r.customerDocNumber,
      country: r.customerCountry,
      birthDate: r.customerBirthDate,
      address: r.customerAddress,
      postalCode: r.customerPostalCode,
      licenseSchool: r.licenseSchool,
      licenseType: r.licenseType,
      licenseNumber: r.licenseNumber,
      contractProfile: latestContract
        ? {
            sourceReservationId: r.id,
            sourceReservationLabel: [r.customerName, r.service?.name]
              .filter((value) => String(value ?? "").trim().length > 0)
              .join(" · "),
            driverName: latestContract.driverName,
            driverPhone: latestContract.driverPhone,
            driverEmail: latestContract.driverEmail,
            driverCountry: latestContract.driverCountry,
            driverAddress: latestContract.driverAddress,
            driverPostalCode: latestContract.driverPostalCode,
            driverDocType: latestContract.driverDocType,
            driverDocNumber: latestContract.driverDocNumber,
            driverBirthDate: latestContract.driverBirthDate,
            minorAuthorizationProvided: latestContract.minorAuthorizationProvided,
            imageConsentAccepted: latestContract.imageConsentAccepted,
            licenseSchool: latestContract.licenseSchool,
            licenseType: latestContract.licenseType,
            licenseNumber: latestContract.licenseNumber,
          }
        : null,
    },
  });
}
