import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";

import { prisma } from "@/lib/prisma";
import { type AppSession, sessionOptions } from "@/lib/session";
import { readCommercialAdjustmentPreview } from "@/lib/commercial-adjustment-preview";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

const Body = z.object({
  newTotalCents: z.number().int().min(0),
  newDepositCents: z.number().int().min(0).optional().nullable(),
  operationType: z.enum(["EDIT", "CANCEL"]),
  requestedRefundMode: z.enum(["refundNow", "leavePendingRefund", "none"]).default("none"),
  refundScope: z.enum(["SERVICE", "DEPOSIT", "FULL"]).optional(),
  reason: z.string().max(500).optional().nullable(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Body invalido" }, { status: 400 });

  const preview = await readCommercialAdjustmentPreview(prisma, id, parsed.data);
  if (!preview) return NextResponse.json({ error: "Reserva no existe" }, { status: 404 });

  return NextResponse.json(preview);
}
