import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(120),
  isActive: z.boolean().optional(),
  allowsPromotions: z.boolean().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true, allowsPromotions: true, commissionEnabled: true, commissionBps: true },
  });

  return NextResponse.json({ channels });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos invalidos", { status: 400 });
  }

  try {
    const channel = await prisma.channel.create({
      data: {
        name: parsed.data.name,
        isActive: parsed.data.isActive ?? true,
        allowsPromotions: parsed.data.allowsPromotions ?? false,
        commissionEnabled: parsed.data.commissionEnabled ?? false,
        commissionBps: parsed.data.commissionEnabled ? (parsed.data.commissionBps ?? 0) : 0,
      },
      select: { id: true, name: true, isActive: true, allowsPromotions: true, commissionEnabled: true, commissionBps: true },
    });

    return NextResponse.json({ channel });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return new NextResponse("Ya existe un canal con ese nombre", { status: 409 });
    }
    return new NextResponse("No se pudo crear el canal", { status: 500 });
  }
}
