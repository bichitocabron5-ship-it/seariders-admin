import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  kind: z.enum(["STANDARD", "EXTERNAL_ACTIVITY"]).optional(),
  visibleInStore: z.boolean().optional(),
  visibleInBooth: z.boolean().optional(),
  showDiscountPolicyInStore: z.boolean().optional(),
  showDiscountPolicyInBooth: z.boolean().optional(),
  allowsPromotions: z.boolean().optional(),
  commissionEnabled: z.boolean().optional(),
  commissionBps: z.number().int().min(0).max(10000).optional(), // 0..100% en bps
  discountResponsibility: z.enum(["COMPANY", "PROMOTER", "SHARED"]).optional(),
  promoterDiscountShareBps: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});

function normalizeCommissionPatch(
  current: { commissionEnabled: boolean; commissionBps: number },
  patch: { commissionEnabled?: boolean; commissionBps?: number }
) {
  const commissionEnabled = patch.commissionEnabled ?? current.commissionEnabled;
  const commissionBps = commissionEnabled ? (patch.commissionBps ?? current.commissionBps) : 0;
  return { commissionEnabled, commissionBps };
}

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
  const current = await prisma.channel.findUnique({
    where: { id },
    select: { commissionEnabled: true, commissionBps: true },
  });

  if (!current) {
    return new NextResponse("Canal no existe", { status: 404 });
  }

  const normalizedCommission = normalizeCommissionPatch(current, parsed.data);

  const updated = await prisma.channel.update({
    where: { id },
    data: {
      kind: parsed.data.kind,
      visibleInStore: parsed.data.visibleInStore,
      visibleInBooth: parsed.data.visibleInBooth,
      showDiscountPolicyInStore: parsed.data.showDiscountPolicyInStore,
      showDiscountPolicyInBooth: parsed.data.showDiscountPolicyInBooth,
      allowsPromotions: parsed.data.allowsPromotions,
      isActive: parsed.data.isActive,
      commissionEnabled: normalizedCommission.commissionEnabled,
      commissionBps: normalizedCommission.commissionBps,
      discountResponsibility: parsed.data.discountResponsibility,
      promoterDiscountShareBps:
        parsed.data.discountResponsibility === undefined && parsed.data.promoterDiscountShareBps === undefined
          ? undefined
          : parsed.data.discountResponsibility === "PROMOTER"
            ? 10_000
            : parsed.data.discountResponsibility === "COMPANY"
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    10_000,
                    Math.round(parsed.data.promoterDiscountShareBps ?? 0)
                  )
                ),
    },
    select: {
      id: true,
      name: true,
      kind: true,
      isActive: true,
      visibleInStore: true,
      visibleInBooth: true,
      showDiscountPolicyInStore: true,
      showDiscountPolicyInBooth: true,
      allowsPromotions: true,
      commissionEnabled: true,
      commissionBps: true,
      discountResponsibility: true,
      promoterDiscountShareBps: true,
    },
  });

  return NextResponse.json({ channel: updated });
}

