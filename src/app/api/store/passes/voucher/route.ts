// src/app/api/store/passes/voucher/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getPassVoucherPaidCents, getPassVoucherPendingCents } from "@/lib/pass-vouchers";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const Query = z.object({
  code: z.string().min(3),
});

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const parsed = Query.safeParse({ code: url.searchParams.get("code") ?? "" });
  if (!parsed.success) return new NextResponse("code requerido", { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();

  const v = await prisma.passVoucher.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      soldAt: true,
      expiresAt: true,
      salePriceCents: true,
      isVoided: true,
      voidedAt: true,
      voidReason: true,

      minutesTotal: true,
      minutesRemaining: true,

      buyerName: true,
      buyerPhone: true,
      buyerEmail: true,

      // PRO contrato
      customerCountry: true,
      customerAddress: true,
      customerDocType: true,
      customerDocNumber: true,
      soldPayment: {
        select: {
          id: true,
          amountCents: true,
          method: true,
          direction: true,
          createdAt: true,
        },
      },
      salePayments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amountCents: true,
          method: true,
          direction: true,
          createdAt: true,
        },
      },

      product: {
        select: {
          id: true,
          code: true,
          name: true,
          totalMinutes: true,
          priceCents: true,
          service: { select: { id: true, name: true, category: true } },
          option: { select: { id: true, durationMinutes: true } },
        },
      },

      consumes: {
        orderBy: { consumedAt: "desc" },
        take: 20,
        select: {
          id: true,
          consumedAt: true,
          minutesUsed: true,
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          reservationId: true,
        },
      },
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          provider: true,
          recipientPhone: true,
          portalUrl: true,
          errorMessage: true,
          createdAt: true,
          sentAt: true,
        },
      },
    },
  });

  if (!v) return new NextResponse("Bono no existe", { status: 404 });

  const paidCents = getPassVoucherPaidCents(v);
  const pendingCents = v.isVoided ? 0 : getPassVoucherPendingCents(v.salePriceCents, paidCents);

  return NextResponse.json({
    ok: true,
    voucher: {
      ...v,
      paidCents,
      pendingCents,
      isFullyPaid: pendingCents <= 0,
    },
  });
}

const NullableStr = z.string().optional().nullable();

const PatchBody = z.object({
  code: z.string().min(3),

  buyerName: NullableStr,
  buyerPhone: NullableStr,
  buyerEmail: NullableStr,

  customerCountry: NullableStr,   // "ES"
  customerAddress: NullableStr,
  customerDocType: NullableStr,
  customerDocNumber: NullableStr,
});

function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null;          // borrar
  const t = String(v).trim();
  return t.length ? t : null;
}

export async function PATCH(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });

  const code = parsed.data.code.trim().toUpperCase();

  const buyerName = normalizeOptionalString(parsed.data.buyerName);
  const buyerPhone = normalizeOptionalString(parsed.data.buyerPhone);
  const buyerEmail = normalizeOptionalString(parsed.data.buyerEmail);

  const customerCountryRaw = normalizeOptionalString(parsed.data.customerCountry);
  const customerCountry = customerCountryRaw === undefined ? undefined : (customerCountryRaw ? customerCountryRaw.toUpperCase() : null);

  const customerAddress = normalizeOptionalString(parsed.data.customerAddress);
  const customerDocType = normalizeOptionalString(parsed.data.customerDocType);
  const customerDocNumber = normalizeOptionalString(parsed.data.customerDocNumber);

  const existing = await prisma.passVoucher.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!existing) return new NextResponse("Bono no existe", { status: 404 });

  const data: Prisma.PassVoucherUpdateInput = {};

  if (buyerName !== undefined) data.buyerName = buyerName;
  if (buyerPhone !== undefined) data.buyerPhone = buyerPhone;
  if (buyerEmail !== undefined) data.buyerEmail = buyerEmail;

  if (customerCountry !== undefined) data.customerCountry = customerCountry;
  if (customerAddress !== undefined) data.customerAddress = customerAddress;
  if (customerDocType !== undefined) data.customerDocType = customerDocType;
  if (customerDocNumber !== undefined) data.customerDocNumber = customerDocNumber;

  await prisma.passVoucher.update({
    where: { code },
    data,
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

