import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PutBody = z.object({
  rules: z.array(
    z.object({
      serviceId: z.string().min(1),
      commissionPct: z.number().int().min(0).max(100),
      isActive: z.boolean().default(true),
    })
  ),
  optionPrices: z.array(
    z.object({
      optionId: z.string().min(1),
      useDefault: z.boolean().default(true),
      priceCents: z.number().int().min(0).max(50_000_000).nullable().optional(),
    })
  ).default([]),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || (session.role as string) !== "ADMIN") return null;
  return session;
}

function isMissingChannelOptionPriceTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.modelName ?? "") === "ChannelOptionPrice"
  );
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const channelId = id;
  const now = new Date();

  const [channel, services, options, prices, rules] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, name: true, commissionEnabled: true, commissionBps: true },
    }),
    prisma.service.findMany({
      where: { isActive: true, category: { not: "EXTRA" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
    prisma.serviceOption.findMany({
      where: { isActive: true, service: { isActive: true, category: { not: "EXTRA" } } },
      orderBy: [{ serviceId: "asc" }, { durationMinutes: "asc" }, { paxMax: "asc" }],
      select: {
        id: true,
        serviceId: true,
        durationMinutes: true,
        paxMax: true,
        basePriceCents: true,
      },
    }),
    prisma.servicePrice.findMany({
      where: {
        isActive: true,
        optionId: { not: null },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      orderBy: { validFrom: "desc" },
      select: {
        optionId: true,
        basePriceCents: true,
      },
    }),
    prisma.channelCommissionRule.findMany({
      where: { channelId },
      select: { id: true, serviceId: true, commissionPct: true, isActive: true },
    }),
  ]);

  if (!channel) return new NextResponse("Canal no existe", { status: 404 });

  const optionPrices = await prisma.channelOptionPrice.findMany({
    where: { channelId, isActive: true },
    select: { id: true, optionId: true, priceCents: true, isActive: true },
  }).catch((error: unknown) => {
    if (isMissingChannelOptionPriceTable(error)) return [];
    throw error;
  });

  const priceMap = new Map<string, number>();
  for (const price of prices) {
    if (price.optionId && !priceMap.has(price.optionId)) {
      priceMap.set(price.optionId, Number(price.basePriceCents ?? 0));
    }
  }

  const serviceRows = services.map((service) => ({
    ...service,
    options: options
      .filter((option) => option.serviceId === service.id)
      .map((option) => ({
        id: option.id,
        durationMinutes: option.durationMinutes,
        paxMax: option.paxMax,
        basePriceCents: priceMap.get(option.id) ?? Number(option.basePriceCents ?? 0),
      })),
  }));

  return NextResponse.json({ channel, services: serviceRows, rules, optionPrices });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const json = await req.json().catch(() => null);
    const parsed = PutBody.safeParse(json);
    if (!parsed.success) return new NextResponse("Datos inválidos", { status: 400 });

    const { id } = await Promise.resolve(ctx.params);
    const channelId = id;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { commissionBps: true },
    });
    if (!channel) return new NextResponse("Canal no existe", { status: 404 });

    const fallbackPct = (channel.commissionBps ?? 0) / 100;

    await prisma.$transaction(async (tx) => {
      for (const rule of parsed.data.rules) {
        const pct = Math.max(0, Math.min(100, Math.trunc(rule.commissionPct)));

        if (!rule.isActive) {
          await tx.channelCommissionRule.deleteMany({
            where: { channelId, serviceId: rule.serviceId },
          });
          continue;
        }

        if (pct === Math.round(fallbackPct)) {
          await tx.channelCommissionRule.deleteMany({
            where: { channelId, serviceId: rule.serviceId },
          });
          continue;
        }

        await tx.channelCommissionRule.upsert({
          where: { channelId_serviceId: { channelId, serviceId: rule.serviceId } },
          update: { commissionPct: pct, isActive: true },
          create: { channelId, serviceId: rule.serviceId, commissionPct: pct, isActive: true },
        });
      }

      for (const optionPrice of parsed.data.optionPrices) {
        if (optionPrice.useDefault || optionPrice.priceCents == null) {
          await tx.channelOptionPrice.deleteMany({
            where: { channelId, optionId: optionPrice.optionId },
          });
          continue;
        }

        await tx.channelOptionPrice.upsert({
          where: { channelId_optionId: { channelId, optionId: optionPrice.optionId } },
          update: { priceCents: optionPrice.priceCents, isActive: true },
          create: {
            channelId,
            optionId: optionPrice.optionId,
            priceCents: optionPrice.priceCents,
            isActive: true,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (isMissingChannelOptionPriceTable(error)) {
      return new NextResponse("Falta aplicar la migración de PVP por canal en la base de datos.", { status: 409 });
    }
    return new NextResponse(error instanceof Error ? error.message : "No se pudieron guardar las reglas", { status: 500 });
  }
}
