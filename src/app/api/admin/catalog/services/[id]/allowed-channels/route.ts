import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  resetToDefault: z.boolean().optional(),
  rules: z
    .array(
      z.object({
        channelId: z.string().min(1),
        active: z.boolean(),
      })
    )
    .optional(),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  const [service, channels, rules] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        category: true,
      },
    }),
    prisma.channel.findMany({
      where: {
        isActive: true,
        OR: [{ visibleInStore: true }, { visibleInBooth: true }],
      },
      select: {
        id: true,
        name: true,
        visibleInStore: true,
        visibleInBooth: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.serviceAllowedChannel.findMany({
      where: { serviceId: id },
      select: {
        channelId: true,
        active: true,
      },
    }),
  ]);

  if (!service) return new NextResponse("Servicio no existe", { status: 404 });

  return NextResponse.json({
    service,
    channels,
    rules,
    hasConfiguration: rules.length > 0,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

  const service = await prisma.service.findUnique({ where: { id }, select: { id: true } });
  if (!service) return new NextResponse("Servicio no existe", { status: 404 });

  const visibleChannels = await prisma.channel.findMany({
    where: {
      isActive: true,
      OR: [{ visibleInStore: true }, { visibleInBooth: true }],
    },
    select: { id: true },
  });
  const visibleChannelIds = new Set(visibleChannels.map((channel) => channel.id));

  if (parsed.data.resetToDefault) {
    await prisma.serviceAllowedChannel.deleteMany({ where: { serviceId: id } });
  } else {
    const rules = parsed.data.rules ?? [];
    if (rules.some((rule) => !visibleChannelIds.has(rule.channelId))) {
      return new NextResponse("Solo se pueden configurar canales visibles en Store o Booth.", { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.serviceAllowedChannel.deleteMany({ where: { serviceId: id } });

      if (rules.length > 0) {
        await tx.serviceAllowedChannel.createMany({
          data: rules.map((rule) => ({
            serviceId: id,
            channelId: rule.channelId,
            active: rule.active,
          })),
        });
      }
    });
  }

  const rules = await prisma.serviceAllowedChannel.findMany({
    where: { serviceId: id },
    select: {
      channelId: true,
      active: true,
    },
  });

  return NextResponse.json({
    ok: true,
    rules,
    hasConfiguration: rules.length > 0,
  });
}
