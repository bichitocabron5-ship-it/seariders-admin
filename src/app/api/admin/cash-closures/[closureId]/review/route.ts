// src/app/api/admin/cash-closures/[closureId]/review/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ closureId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { closureId } = await params; // importante en Next (params es Promise)

  if (!closureId) {
    return NextResponse.json({ error: "closureId requerido" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId || session.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const current = await prisma.cashClosure.findUnique({
    where: { id: closureId },
    select: { id: true, reviewedAt: true, isVoided: true },
  });
  if (!current) return NextResponse.json({ error: "Cierre no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const note = typeof body?.note === "string" ? body.note.trim() : null;
   
  const willReview = !current.reviewedAt;
  const updated = await prisma.cashClosure.update({
    where: { id: closureId },
    data: willReview
      ? { reviewedAt: new Date(), reviewedByUserId: session.userId, reviewNote: note || null }
      : { reviewedAt: null, reviewedByUserId: null, reviewNote: null },
    select: {
      id: true,
      reviewedAt: true,
      reviewNote: true,
      reviewedByUser: { select: { id: true, fullName: true, username: true } },
    },
  });

  return NextResponse.json({ ok: true, updated });
}


