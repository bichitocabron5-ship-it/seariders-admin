// src/app/api/store/customers/profile/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import type { Prisma } from "@prisma/client";
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

function fallbackOptionalString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized && normalized !== "-") return normalized;
  }
  return null;
}

function normalizeMatchValue(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

function hasText(value: string | null | undefined) {
  return String(value ?? "").trim().length > 0;
}

type ReservationProfileRow = {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerDocType: string | null;
  customerDocNumber: string | null;
  customerCountry: string | null;
  customerBirthDate: Date | null;
  customerAddress: string | null;
  customerPostalCode: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  service: { name: string | null } | null;
  contracts: Array<{
    driverName: string | null;
    driverPhone: string | null;
    driverEmail: string | null;
    driverCountry: string | null;
    driverAddress: string | null;
    driverPostalCode: string | null;
    driverDocType: string | null;
    driverDocNumber: string | null;
    driverBirthDate: Date | null;
    minorAuthorizationProvided: boolean | null;
    imageConsentAccepted: boolean | null;
    licenseSchool: string | null;
    licenseType: string | null;
    licenseNumber: string | null;
  }>;
};

function contractMandatoryScore(row: ReservationProfileRow) {
  const contract = row.contracts[0] ?? null;
  if (!contract) return 0;

  let score = 0;
  if (hasText(contract.driverName)) score += 1;
  if (hasText(contract.driverPhone)) score += 1;
  if (hasText(contract.driverCountry)) score += 1;
  if (hasText(contract.driverAddress)) score += 1;
  if (hasText(contract.driverDocType)) score += 1;
  if (hasText(contract.driverDocNumber)) score += 1;
  if (contract.driverBirthDate) score += 1;

  const hasAnyLicenseData =
    hasText(contract.licenseSchool) || hasText(contract.licenseType) || hasText(contract.licenseNumber);
  if (hasAnyLicenseData) {
    if (hasText(contract.licenseSchool)) score += 1;
    if (hasText(contract.licenseType)) score += 1;
    if (hasText(contract.licenseNumber)) score += 1;
  }

  return score;
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
    return new NextResponse("Query invalida", { status: 400 });
  }

  const { reservationId } = parsed.data;

  const selectShape = {
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
        status: { not: "VOID" as const },
      },
      orderBy: [{ signedAt: "desc" as const }, { updatedAt: "desc" as const }, { createdAt: "desc" as const }],
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
  };

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: selectShape,
  });

  if (!reservation) {
    return new NextResponse("Ficha no encontrada", { status: 404 });
  }

  const latestContract = reservation.contracts[0] ?? null;
  const matchDocNumber = normalizeMatchValue(reservation.customerDocNumber ?? latestContract?.driverDocNumber);
  const matchPhone = normalizeMatchValue(reservation.customerPhone ?? latestContract?.driverPhone);
  const matchEmail = normalizeMatchValue(reservation.customerEmail ?? latestContract?.driverEmail);
  const matchName = normalizeMatchValue(reservation.customerName ?? latestContract?.driverName);

  const relatedFilters: Prisma.ReservationWhereInput[] = [
    matchDocNumber
      ? {
          OR: [
            { customerDocNumber: { equals: matchDocNumber, mode: "insensitive" as const } },
            { contracts: { some: { driverDocNumber: { equals: matchDocNumber, mode: "insensitive" as const } } } },
          ],
        }
      : null,
    matchPhone
      ? {
          OR: [
            { customerPhone: { equals: matchPhone, mode: "insensitive" as const } },
            { contracts: { some: { driverPhone: { equals: matchPhone, mode: "insensitive" as const } } } },
          ],
        }
      : null,
    matchEmail
      ? {
          OR: [
            { customerEmail: { equals: matchEmail, mode: "insensitive" as const } },
            { contracts: { some: { driverEmail: { equals: matchEmail, mode: "insensitive" as const } } } },
          ],
        }
      : null,
    matchName
      ? {
          OR: [
            { customerName: { equals: matchName, mode: "insensitive" as const } },
            { contracts: { some: { driverName: { equals: matchName, mode: "insensitive" as const } } } },
          ],
        }
      : null,
  ].filter((value): value is Prisma.ReservationWhereInput => Boolean(value));

  const relatedReservations =
    relatedFilters.length > 0
      ? await prisma.reservation.findMany({
          where: {
            formalizedAt: { not: null },
            OR: relatedFilters,
          },
          orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
          take: 8,
          select: selectShape,
        })
      : [];

  const richestReservation = [...relatedReservations, reservation]
    .sort((left, right) => contractMandatoryScore(right) - contractMandatoryScore(left))[0] ?? reservation;

  const richestContract = richestReservation.contracts[0] ?? null;

  return NextResponse.json({
    ok: true,
    profile: {
      customerName: fallbackOptionalString(richestReservation.customerName, richestContract?.driverName),
      email: fallbackOptionalString(richestReservation.customerEmail, richestContract?.driverEmail),
      phone: fallbackOptionalString(richestReservation.customerPhone, richestContract?.driverPhone),
      customerDocType: fallbackOptionalString(richestReservation.customerDocType, richestContract?.driverDocType),
      customerDocNumber: fallbackOptionalString(richestReservation.customerDocNumber, richestContract?.driverDocNumber),
      country: fallbackOptionalString(richestReservation.customerCountry, richestContract?.driverCountry),
      birthDate: richestReservation.customerBirthDate ?? richestContract?.driverBirthDate ?? null,
      address: fallbackOptionalString(richestReservation.customerAddress, richestContract?.driverAddress),
      postalCode: fallbackOptionalString(richestReservation.customerPostalCode, richestContract?.driverPostalCode),
      licenseSchool: fallbackOptionalString(richestReservation.licenseSchool, richestContract?.licenseSchool),
      licenseType: fallbackOptionalString(richestReservation.licenseType, richestContract?.licenseType),
      licenseNumber: fallbackOptionalString(richestReservation.licenseNumber, richestContract?.licenseNumber),
      contractProfile: richestContract
        ? {
            sourceReservationId: richestReservation.id,
            sourceReservationLabel: [richestReservation.customerName, richestReservation.service?.name]
              .filter((value) => String(value ?? "").trim().length > 0)
              .join(" · "),
            driverName: richestContract.driverName,
            driverPhone: richestContract.driverPhone,
            driverEmail: richestContract.driverEmail,
            driverCountry: richestContract.driverCountry,
            driverAddress: richestContract.driverAddress,
            driverPostalCode: richestContract.driverPostalCode,
            driverDocType: richestContract.driverDocType,
            driverDocNumber: richestContract.driverDocNumber,
            driverBirthDate: richestContract.driverBirthDate,
            minorAuthorizationProvided: richestContract.minorAuthorizationProvided,
            imageConsentAccepted: richestContract.imageConsentAccepted,
            licenseSchool: richestContract.licenseSchool,
            licenseType: richestContract.licenseType,
            licenseNumber: richestContract.licenseNumber,
          }
        : null,
    },
  });
}
