// src/app/api/store/reservations/[id]/ready_for_platform/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { ReservationStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";

export const runtime = "nodejs";

async function requireStore() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId || !["STORE", "ADMIN"].includes(session.role as string)) return null;
  return session;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensureUnitsTx(
  tx: Prisma.TransactionClient,
  reservation: {
    id: string;
    quantity: number | null;
    isPackParent: boolean | null;
    parentReservationId: string | null;
    isLicense: boolean;
    serviceCategory?: string | null;
    items: Array<{ quantity: number | null; isExtra: boolean; service: { category: string | null } | null }>;
  }
) {
  if (reservation.isPackParent && !reservation.parentReservationId) return;

  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.serviceCategory ?? null,
    items: reservation.items ?? [],
  });
  if (requiredUnits <= 0) return;

  const existing = await tx.reservationUnit.findMany({
    where: { reservationId: reservation.id },
    select: { unitIndex: true },
  });
  const set = new Set(existing.map((u: { unitIndex: number }) => Number(u.unitIndex)));

  const toCreate: Array<{ reservationId: string; unitIndex: number }> = [];
  for (let i = 1; i <= requiredUnits; i++) {
    if (!set.has(i)) toCreate.push({ reservationId: reservation.id, unitIndex: i });
  }

  if (toCreate.length > 0) {
    await tx.reservationUnit.createMany({ data: toCreate, skipDuplicates: true });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStore();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) cargar reserva padre + items
      const parent = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          packId: true,
          isPackParent: true,
          parentReservationId: true,
          activityDate: true,
          scheduledTime: true,
          channelId: true,
          customerName: true,
          customerCountry: true,
          pax: true,
          quantity: true,
          isLicense: true,
          status: true,
          service: { select: { category: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              isExtra: true,
              splitReservationId: true,
              service: { select: { category: true } },
            },
          },
        },
      });

      if (!parent) throw new Error("Reserva no existe");

      // Solo padre (evita llamar esto sobre una hija)
      if (parent.parentReservationId) {
        return { ok: true, already: true, message: "Ya es una hija; no se splitea" };
      }

      // Marcar ready-for-platform (idempotente)
      // Si no tienes estos campos, reemplázalo por el update que uses para “pasar a plataforma”
      await tx.reservation.update({
        where: { id: parent.id },
        data: {
          status: 
          ReservationStatus.READY_FOR_PLATFORM,
        }
      });
      await ensureUnitsTx(tx, {
        id: parent.id,
        quantity: parent.quantity,
        isPackParent: parent.isPackParent,
        parentReservationId: parent.parentReservationId,
        isLicense: Boolean(parent.isLicense),
        serviceCategory: parent.service?.category ?? null,
        items: (parent.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
      });

      // Si no es pack, terminamos aquí
      if (!parent.packId || !parent.isPackParent) {
        return { ok: true, split: false, childrenCreated: 0 };
      }

      // 2) comprobar si ya hay split (por items marcados)
      const pendingItems = parent.items.filter(
        (it) => it.isExtra && !it.splitReservationId
      );

      if (pendingItems.length === 0) {
        return { ok: true, split: true, already: true, childrenCreated: 0 };
      }

      // 3) crear hijas: UNA por item (las hijas total=0)
      const createdChildrenIds: string[] = [];

      for (const it of pendingItems) {
        // OJO: para hija, necesitamos optionId. Si algún item viene sin optionId, decide:
        // - o lo prohibimos
        // - o lo tratamos como “extra” sin option (si tu modelo permite optionId null)
        if (!it.optionId) {
          // por ahora lo bloqueamos para no romper tu modelo
          throw new Error("Hay un item del pack sin optionId (no se puede splittear todavía).");
        }

        const child = await tx.reservation.create({
          data: {
            source: parent.source, // o "STORE" fijo si lo prefieres
            status: ReservationStatus.READY_FOR_PLATFORM,
            activityDate: parent.activityDate ?? startOfToday(),
            scheduledTime: parent.scheduledTime,
	          isPackParent: false,

            channelId: parent.channelId,
            customerName: parent.customerName,
            customerCountry: parent.customerCountry ?? "ES",
            customerAddress: "-",
            customerDocType: "-",
            customerDocNumber: "-",

            // hija apunta al padre
            parentReservationId: parent.id,
            packId: parent.packId,

            // “principal” de la hija = este item
            serviceId: it.serviceId,
            optionId: it.optionId,

            // cantidades
            quantity: Number(it.quantity ?? 1),
            pax: Number(it.pax ?? parent.pax ?? 1),

            // precios a 0 (el cobro vive en padre)
            basePriceCents: 0,
            manualDiscountCents: 0,
            autoDiscountCents: 0,
            totalPriceCents: 0,
            depositCents: 0,
            isLicense: false,
          },
          select: { id: true },
        });
        await ensureUnitsTx(tx, {
          id: child.id,
          quantity: Number(it.quantity ?? 1),
          isPackParent: false,
          parentReservationId: parent.id,
          isLicense: false,
          items: [
            {
              quantity: Number(it.quantity ?? 1),
              isExtra: false,
              service: it.service ? { category: it.service.category ?? null } : null,
            },
          ],
        });

        createdChildrenIds.push(child.id);

        // Crear item principal en hija (snapshot 0)
        await tx.reservationItem.create({
          data: {
            reservationId: child.id,
            serviceId: it.serviceId,
            optionId: it.optionId,
            servicePriceId: null,
            quantity: Number(it.quantity ?? 1),
            pax: Number(it.pax ?? parent.pax ?? 1),
            unitPriceCents: 0,
            totalPriceCents: 0,
            isExtra: false,
          },
        });

        // Marcar item del padre como “splitteado”
        await tx.reservationItem.update({
          where: { id: it.id },
          data: { splitReservationId: child.id },
        });
      }

      return { ok: true, split: true, childrenCreated: createdChildrenIds.length, childrenIds: createdChildrenIds };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
