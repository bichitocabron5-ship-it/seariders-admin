import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const PutBody = z.object({
  rules: z.array(
    z.object({
      serviceId: z.string().min(1),
      commissionPct: z.number().int().min(0).max(100),
      isActive: z.boolean().default(true),
    })
  ),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const channelId = id;

  const [channel, services, rules] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, commissionEnabled: true, commissionBps: true },
    }),
    prisma.service.findMany({
      where: { isActive: true, category: { not: "EXTRA" } }, // solo principales
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
    prisma.channelCommissionRule.findMany({
      where: { channelId },
      select: { id: true, serviceId: true, commissionPct: true, isActive: true },
    }),
  ]);

  if (!channel) return new NextResponse("Canal no existe", { status: 404 });

  return NextResponse.json({ channel, services, rules });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const { id } = await Promise.resolve(ctx.params);
  const channelId = id;

  // Fallback del canal (por si quieres limpiar reglas "igual al fallback")
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { commissionBps: true },
  });
  if (!channel) return new NextResponse("Canal no existe", { status: 404 });

  const fallbackPct = (channel.commissionBps ?? 0) / 100; // bps -> %

  await prisma.$transaction(async (tx) => {
    for (const r of parsed.data.rules) {
      const pct = Math.max(0, Math.min(100, Math.trunc(r.commissionPct)));

      // Anti-ruido:
      // si desactivas -> borramos regla
      if (!r.isActive) {
        await tx.channelCommissionRule.deleteMany({
          where: { channelId, serviceId: r.serviceId },
        });
        continue;
      }

      // Si coincide con el fallback del canal, no aporta (opcional) -> borramos
      if (pct === Math.round(fallbackPct)) {
        await tx.channelCommissionRule.deleteMany({
          where: { channelId, serviceId: r.serviceId },
        });
        continue;
      }

      await tx.channelCommissionRule.upsert({
        where: { channelId_serviceId: { channelId, serviceId: r.serviceId } },
        update: { commissionPct: pct, isActive: true },
        create: { channelId, serviceId: r.serviceId, commissionPct: pct, isActive: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}

