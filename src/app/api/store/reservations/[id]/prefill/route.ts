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
      basePriceCents: true,
      manualDiscountCents: true,
      autoDiscountCents: true,
      totalPriceCents: true,
      customerName: true,
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
      giftVoucherId: true,
      passVoucherId: true,
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
        },
      },
    },
  });

  if (!r) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const isPast = r.activityDate < startOfToday();
  const isHistorical = isPast && (r.status === "COMPLETED" || r.status === "CANCELED");

  return NextResponse.json({
    reservation: r,
    flags: {
      isPast,
      isHistorical,
      isGift: Boolean(r.giftVoucherId),
      isPass: Boolean(r.passVoucherId),
    },
  });
}

