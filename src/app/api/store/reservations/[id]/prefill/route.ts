// src/app/api/store/reservations/[id]/prefill/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fallbackOptionalString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized && normalized !== "-") return normalized;
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const r = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      activityDate: true,
      scheduledTime: true,
      serviceId: true,
      optionId: true,
      channelId: true,
      quantity: true,
      pax: true,
      isLicense: true,
      jetskiLicenseMode: true,
      pricingTier: true,
      basePriceCents: true,
      commissionBaseCents: true,
      manualDiscountCents: true,
      autoDiscountCents: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
      promoterDiscountCents: true,
      companyDiscountCents: true,
      totalPriceCents: true,
      source: true,
      customerName: true,
      boothNote: true,
      customerPhone: true,
      customerEmail: true,
      customerCountry: true,
      customerAddress: true,
      customerPostalCode: true,
      customerBirthDate: true,
      customerDocType: true,
      customerDocNumber: true,
      marketing: true,
      companionsCount: true,
      formalizedAt: true,
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,
      contracts: {
        orderBy: { unitIndex: "asc" },
        take: 1,
        select: {
          driverName: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          driverAddress: true,
          driverPostalCode: true,
          driverBirthDate: true,
          driverDocType: true,
          driverDocNumber: true,
        },
      },
      giftVoucherId: true,
      passVoucherId: true,
      payments: {
        select: {
          amountCents: true,
          isDeposit: true,
          direction: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          isLicense: true,
        },
      },
      option: {
        select: {
          id: true,
          serviceId: true,
          code: true,
          durationMinutes: true,
          paxMax: true,
          contractedMinutes: true,
          basePriceCents: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
          commissionEnabled: true,
          commissionBps: true,
          discountResponsibility: true,
          promoterDiscountShareBps: true,
        },
      },
    },
  });

  if (!r) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const primaryContract = r.contracts[0] ?? null;
  const boothCompatibilityFallback =
    r.source === "BOOTH" && !r.formalizedAt ? primaryContract : null;
  const reservation = {
    ...r,
    customerName: fallbackOptionalString(r.customerName, boothCompatibilityFallback?.driverName),
    customerPhone: fallbackOptionalString(r.customerPhone, boothCompatibilityFallback?.driverPhone),
    customerEmail: fallbackOptionalString(r.customerEmail, boothCompatibilityFallback?.driverEmail),
    customerCountry: fallbackOptionalString(r.customerCountry, boothCompatibilityFallback?.driverCountry),
    customerAddress: fallbackOptionalString(r.customerAddress, boothCompatibilityFallback?.driverAddress),
    customerPostalCode: fallbackOptionalString(r.customerPostalCode, boothCompatibilityFallback?.driverPostalCode),
    customerBirthDate: r.customerBirthDate ?? boothCompatibilityFallback?.driverBirthDate ?? null,
    customerDocType: fallbackOptionalString(r.customerDocType, boothCompatibilityFallback?.driverDocType),
    customerDocNumber: fallbackOptionalString(r.customerDocNumber, boothCompatibilityFallback?.driverDocNumber),
  };

  const isPast = r.activityDate < startOfToday();
  const isHistorical = isPast && (r.status === "COMPLETED" || r.status === "CANCELED");
  const isCanceled = r.status === "CANCELED";
  const isCompleted = r.status === "COMPLETED";
  const isReadOnly = isHistorical || isCanceled;
  const paidServiceCents = (r.payments ?? [])
    .filter((payment) => !payment.isDeposit)
    .reduce(
      (sum, payment) => sum + (payment.direction === "OUT" ? -Number(payment.amountCents ?? 0) : Number(payment.amountCents ?? 0)),
      0
    );
  const totalServiceCents = Number(r.totalPriceCents ?? 0);
  const pendingServiceCents = Math.max(0, totalServiceCents - paidServiceCents);

  return NextResponse.json({
    reservation,
    financial: {
      totalServiceCents,
      paidServiceCents: Math.max(0, paidServiceCents),
      pendingServiceCents,
    },
    flags: {
      isPast,
      isHistorical,
      isCanceled,
      isCompleted,
      isReadOnly,
      isGift: Boolean(r.giftVoucherId),
      isPass: Boolean(r.passVoucherId),
    },
  });
}

