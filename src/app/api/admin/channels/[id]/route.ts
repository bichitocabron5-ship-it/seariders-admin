import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  commissionEnabled: z.boolean().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(), // 0..100% en bps
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  
  if (!session?.userId || (session.role as string) !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos invalidos", { status: 400 });

  const { id } = await params;

  const updated = await prisma.channel.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      isActive: true,
      commissionEnabled: true,
      commissionBps: true,
    },
  });

  return NextResponse.json({ channel: updated });
}

