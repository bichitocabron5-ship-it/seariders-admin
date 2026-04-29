// src/app/api/bar/payments/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { PaymentMethod, PaymentOrigin, PaymentDirection, RoleName } from "@prisma/client";
import { originFromRoleName, parseBusinessDate } from "@/lib/cashClosures";
import { calculateBarLineTotal } from "@/lib/bar-pricing";

export const runtime = "nodejs";

const Body = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(999),
      })
    )
    .min(1)
    .max(50),
  amountCents: z.number().int().positive(),
  method: z.nativeEnum(PaymentMethod).nullable().optional(),
  note: z.string().max(300).optional().nullable(),
  date: z.string().min(10).max(10),
  shift: z.enum(["MORNING", "AFTERNOON"]),
  label: z.string().min(1).max(120),
  staffMode: z.boolean().optional().default(false),
  staffEmployeeId: z.string().min(1).optional().nullable(),
  deferStaffPayment: z.boolean().optional().default(false),
  manualDiscountCents: z.number().int().min(0).max(100_000).optional().default(0),
  manualDiscountReason: z.string().max(200).optional().nullable(),
});

function allocateProportionally(totalCents: number, weights: number[]) {
  if (totalCents <= 0 || weights.length === 0) return weights.map(() => 0);

  const totalWeight = weights.reduce((sum, value) => sum + Math.max(0, value), 0);
  if (totalWeight <= 0) return weights.map(() => 0);

  const provisional = weights.map((weight, index) => {
    const exact = (Math.max(0, weight) / totalWeight) * totalCents;
    const base = Math.floor(exact);
    return { index, base, remainder: exact - base };
  });

  let remaining = totalCents - provisional.reduce((sum, row) => sum + row.base, 0);
  provisional.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const row of provisional) {
    if (remaining <= 0) break;
    row.base += 1;
    remaining -= 1;
  }

  return provisional
    .sort((a, b) => a.index - b.index)
    .map((row) => row.base);
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);

  if (!session?.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const roleOrigin = originFromRoleName(session.role as RoleName);
  if (String(session.role) !== "ADMIN" && roleOrigin !== PaymentOrigin.BAR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return new NextResponse("Datos inválidos", { status: 400 });
  }

  const {
    items,
    amountCents,
    method,
    note,
    date,
    shift,
    label,
    staffMode,
    staffEmployeeId,
    deferStaffPayment,
    manualDiscountCents,
    manualDiscountReason,
  } = parsed.data;
  const businessDate = parseBusinessDate(date);

  if (!deferStaffPayment && !method) {
    return new NextResponse("Selecciona método de cobro.", { status: 400 });
  }

  if (deferStaffPayment && !staffMode) {
    return new NextResponse("Solo se puede dejar pendiente en modo staff.", { status: 400 });
  }

  if (staffMode && !staffEmployeeId) {
    return new NextResponse("Selecciona el trabajador de la venta staff.", { status: 400 });
  }

  if (staffMode && manualDiscountCents > 0) {
    return new NextResponse("El descuento manual no está disponible en modo staff.", { status: 400 });
  }

  if (!manualDiscountReason && manualDiscountCents > 0) {
    return new NextResponse("Indica el motivo del descuento manual.", { status: 400 });
  }

  try {
    const shiftSession = await prisma.shiftSession.findFirst({
      where: {
        userId: session.userId,
        shift,
        businessDate,
        role: { name: { in: ["BAR", "ADMIN"] as RoleName[] } },
      },
      select: { id: true },
      orderBy: { startedAt: "desc" },
    });

    if (!shiftSession && String(session.role) !== "ADMIN") {
      return new NextResponse("No hay shift session abierta para BAR en ese turno/día.", {
        status: 400,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee =
        staffEmployeeId != null
          ? await tx.employee.findUnique({
              where: { id: staffEmployeeId },
              select: { id: true, fullName: true, isActive: true },
            })
          : null;

      if (staffEmployeeId && (!employee || !employee.isActive)) {
        throw new Error("Trabajador staff no válido.");
      }

      const itemMap = new Map<string, number>();
      for (const item of items) {
        itemMap.set(item.productId, (itemMap.get(item.productId) ?? 0) + item.quantity);
      }

      const products = await tx.barProduct.findMany({
        where: { id: { in: Array.from(itemMap.keys()) } },
        select: {
          id: true,
          name: true,
          type: true,
          salePriceCents: true,
          costPriceCents: true,
          staffEligible: true,
          staffPriceCents: true,
          isActive: true,
          controlsStock: true,
          currentStock: true,
          unitLabel: true,
        },
      });

      if (products.length !== itemMap.size) {
        throw new Error("Algún producto ya no existe.");
      }

      const productById = new Map(products.map((product) => [product.id, product]));

      const lines = [];
      for (const item of items) {
        const product = productById.get(item.productId);
        if (!product || !product.isActive) {
          throw new Error("Producto no encontrado o inactivo.");
        }

        const currentStock = Number(product.currentStock ?? 0);
        if (product.controlsStock && currentStock < item.quantity) {
          throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}.`);
        }

        const unitPriceCents =
          staffMode && product.staffEligible && product.staffPriceCents != null
            ? Number(product.staffPriceCents)
            : Number(product.salePriceCents);

        const promotions = await tx.barPromotion.findMany({
          where: {
            productId: product.id,
            isActive: true,
          },
        });

        const pricing = calculateBarLineTotal({
          unitPriceCents,
          quantity: item.quantity,
          promotions,
          staffMode,
          staffPriceCents: product.staffPriceCents,
        });

        lines.push({
          product,
          quantity: item.quantity,
          pricing,
        });
      }

      if (!staffMode && manualDiscountCents > 0 && lines.some((line) => line.product.type !== "DRINK")) {
        throw new Error("El descuento manual solo se puede aplicar a ventas compuestas exclusivamente por bebidas.");
      }

      const subtotalBeforeManualCents = lines.reduce(
        (sum, line) => sum + line.pricing.subtotalBeforeManualCents,
        0
      );

      const appliedManualDiscountCents = Math.min(
        Math.max(0, manualDiscountCents),
        Math.max(0, subtotalBeforeManualCents - 1)
      );

      const totalCalculatedCents = subtotalBeforeManualCents - appliedManualDiscountCents;
      if (amountCents !== totalCalculatedCents) {
        throw new Error("El importe no coincide con el precio calculado.");
      }

      const manualDiscountByLine = allocateProportionally(
        appliedManualDiscountCents,
        lines.map((line) => line.pricing.subtotalBeforeManualCents)
      );

      const payment = deferStaffPayment
        ? null
        : await tx.payment.create({
            data: {
              origin: PaymentOrigin.BAR,
              direction: PaymentDirection.IN,
              method: method!,
              amountCents,
              isDeposit: false,
              isStaffSale: Boolean(staffMode),
              shiftSessionId: shiftSession?.id ?? null,
              createdByUserId: session.userId,
            },
            select: {
              id: true,
              amountCents: true,
              method: true,
              origin: true,
              createdAt: true,
              isStaffSale: true,
            },
          });

      const totalBaseRevenueCents = lines.reduce((sum, line) => sum + line.pricing.baseTotalCents, 0);
      const totalAutoDiscountCents = lines.reduce((sum, line) => sum + line.pricing.autoDiscountCents, 0);
      const totalCostCents = lines.reduce((sum, line) => {
        const unitCostCents =
          line.product.costPriceCents != null ? Number(line.product.costPriceCents) : 0;
        return sum + Math.round(unitCostCents * line.quantity);
      }, 0);
      const totalMarginCents = amountCents - totalCostCents;

      const barSale = await tx.barSale.create({
        data: {
          paymentId: payment?.id ?? null,
          shiftSessionId: shiftSession?.id ?? null,
          soldAt: new Date(),
          soldByUserId: session.userId,
          employeeId: employee?.id ?? null,
          staffEmployeeNameSnap: employee?.fullName ?? null,
          staffMode: Boolean(staffMode),
          note: note?.trim() || null,
          totalBaseRevenueCents,
          autoDiscountCents: totalAutoDiscountCents,
          manualDiscountCents: appliedManualDiscountCents,
          manualDiscountReason: appliedManualDiscountCents > 0 ? manualDiscountReason?.trim() || null : null,
          totalRevenueCents: amountCents,
          totalCostCents,
          totalMarginCents,
        },
        select: {
          id: true,
        },
      });

      for (const [index, line] of lines.entries()) {
        const lineManualDiscountCents = manualDiscountByLine[index] ?? 0;
        const lineRevenueCents = line.pricing.subtotalBeforeManualCents - lineManualDiscountCents;
        const unitCostCents =
          line.product.costPriceCents != null ? Number(line.product.costPriceCents) : null;

        await tx.barSaleItem.create({
          data: {
            saleId: barSale.id,
            productId: line.product.id,
            quantity: line.quantity,
            baseUnitPriceCents: line.pricing.unitPriceCents,
            unitPriceCents: Math.round(lineRevenueCents / line.quantity),
            baseRevenueCents: line.pricing.baseTotalCents,
            autoDiscountCents: line.pricing.autoDiscountCents,
            manualDiscountCents: lineManualDiscountCents,
            revenueCents: lineRevenueCents,
            unitCostCents,
            costCents: unitCostCents != null ? Math.round(unitCostCents * line.quantity) : null,
            marginCents:
              unitCostCents != null
                ? lineRevenueCents - Math.round(unitCostCents * line.quantity)
                : null,
            promotionLabel: line.pricing.label ?? null,
          },
        });

        if (line.product.controlsStock) {
          const currentStock = Number(line.product.currentStock ?? 0);
          const nextStock = currentStock - line.quantity;

          await tx.barProduct.update({
            where: { id: line.product.id },
            data: {
              currentStock: nextStock,
            },
          });

          await tx.barStockMovement.create({
            data: {
              productId: line.product.id,
              type: "OUT",
              reason: "BAR_SALE",
              quantity: line.quantity,
              stockBefore: currentStock,
              stockAfter: nextStock,
              notes: `${label}${staffMode ? " · STAFF" : ""} · ${line.product.name} · x${line.quantity}`,
              sourceType: "PAYMENT",
              sourceId: payment?.id ?? barSale.id,
              userId: session.userId,
            },
          });
        }
      }

      return {
        payment,
        sale: {
          id: barSale.id,
          deferred: deferStaffPayment,
          employeeName: employee?.fullName ?? null,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      payment: result.payment,
    });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", {
      status: 400,
    });
  }
}
