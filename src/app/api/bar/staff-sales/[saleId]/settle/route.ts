import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { PaymentDirection, PaymentOrigin, PaymentMethod, RoleName } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { originFromRoleName, parseBusinessDate } from "@/lib/cashClosures";
import { AppSession, sessionOptions } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  method: z.nativeEnum(PaymentMethod),
  date: z.string().min(10).max(10),
  shift: z.enum(["MORNING", "AFTERNOON"]),
});

export async function POST(req: Request, context: { params: Promise<{ saleId: string }> }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== PaymentOrigin.BAR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { saleId } = await context.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const businessDate = parseBusinessDate(parsed.data.date);

  try {
    const shiftSession = await prisma.shiftSession.findFirst({
      where: {
        userId: session.userId,
        shift: parsed.data.shift,
        businessDate,
        role: { name: { in: ["BAR", "ADMIN"] as RoleName[] } },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (!shiftSession && String(session.role) !== "ADMIN") {
      return new NextResponse("No hay shift session abierta para BAR en ese turno/día.", { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.barSale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          paymentId: true,
          staffMode: true,
          totalRevenueCents: true,
        },
      });

      if (!sale || !sale.staffMode) throw new Error("Venta staff no encontrada.");
      if (sale.paymentId) throw new Error("Esta venta staff ya está cobrada.");

      const payment = await tx.payment.create({
        data: {
          origin: PaymentOrigin.BAR,
          direction: PaymentDirection.IN,
          method: parsed.data.method,
          amountCents: sale.totalRevenueCents,
          isDeposit: false,
          isStaffSale: true,
          shiftSessionId: shiftSession?.id ?? null,
          createdByUserId: session.userId,
        },
        select: {
          id: true,
          method: true,
          amountCents: true,
          createdAt: true,
        },
      });

      await tx.barSale.update({
        where: { id: sale.id },
        data: { paymentId: payment.id },
      });

      return payment;
    });

    return NextResponse.json({ ok: true, payment: result });
  } catch (error: unknown) {
    return new NextResponse(error instanceof Error ? error.message : "Error", { status: 400 });
  }
}
