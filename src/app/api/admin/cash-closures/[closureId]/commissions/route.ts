// src/app/api/admin/cash-closures/[closureId]/commissions/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCashClosureCommissionSummary } from "@/lib/cash-closure-commissions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ closureId: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { closureId } = await params;

  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || String(session.role) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const closure = await prisma.cashClosure.findUnique({
    where: { id: closureId },
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      windowFrom: true,
      windowTo: true,
      isVoided: true,
    },
  });
  if (!closure) return NextResponse.json({ error: "Cierre no existe" }, { status: 404 });
  if (closure.isVoided) return NextResponse.json({ error: "Cierre anulado" }, { status: 400 });

  const summary = await getCashClosureCommissionSummary({
    closureId: closure.id,
    origin: closure.origin,
    windowFrom: closure.windowFrom,
    windowTo: closure.windowTo,
  });

  return NextResponse.json({
    ...summary,
    meta: {
      closureId: closure.id,
      origin: closure.origin,
      shift: closure.shift,
      businessDate: closure.businessDate,
      windowFrom: closure.windowFrom,
      windowTo: closure.windowTo,
    },
  });
}

