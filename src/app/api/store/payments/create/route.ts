// src/app/api/store/payments/create/route.ts
// src/app/api/store/payments/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PaymentDirection, PaymentMethod, PaymentOrigin, RoleName, ReservationStatus } from "@prisma/client";
import { assertCashOpenForUser } from "@/lib/cashClosureLock";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { syncStoreFulfillmentTasksForReservation } from "@/lib/fulfillment/sync-store-fulfillment";
import { computeReservationDepositCents } from "@/lib/reservation-deposits";
import { evaluateReadyForPlatform } from "@/lib/ready-for-platform";
import { countReadyVisibleContracts } from "@/lib/contracts/active-contracts";
import { ensureReservationPlatformUnitsTx } from "@/lib/reservation-platform";

export const runtime = "nodejs";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function POST(req: Request) {
  try {
    // ✅ sesión
    const cookieStore = await cookies();
    const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
    if (!session?.userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();

    const reservationId = body.reservationId as string;
    const amountCents = Number(body.amountCents);
    const method = body.method as PaymentMethod;
    const origin = body.origin as PaymentOrigin;
    const isDeposit = Boolean(body.isDeposit);
    const direction = (body.direction as PaymentDirection) ?? "IN";

    if (!reservationId) return NextResponse.json({ error: "reservationId requerido" }, { status: 400 });
    if (!Number.isFinite(amountCents) || amountCents <= 0)
      return NextResponse.json({ error: "amountCents inválido" }, { status: 400 });
    if (!method) return NextResponse.json({ error: "method requerido" }, { status: 400 });
    if (!origin) return NextResponse.json({ error: "origin requerido" }, { status: 400 });

    // ✅ BLOQUEO: si hay cierre activo en la ventana actual -> no cobrar
    await assertCashOpenForUser(session.userId, session.role as RoleName);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Reservation" WHERE "id" = ${reservationId} FOR UPDATE`;

      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          totalPriceCents: true,  // ✅ servicio (total final sin fianza)
          depositCents: true,     // ✅ fianza
          status: true,
          formalizedAt: true,
          depositHeld: true,
          depositHoldReason: true,

          // ✅ packs
          packId: true,
          isPackParent: true,
          parentReservationId: true,
          source: true,
          activityDate: true,
          scheduledTime: true,
          storeQueueStartedAt: true,
          paymentCompletedAt: true,
          channelId: true,
          customerName: true,
          customerCountry: true,
          pax: true,
          quantity: true,
          isLicense: true,
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

          contracts: {
            select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
          },

          payments: {
            select: { amountCents: true, isDeposit: true, direction: true },
          },
        },
      });

      if (!reservation) {
        throw Object.assign(new Error("Reserva no encontrada"), { status: 404 });
      }

      // Netos por tipo (IN suma, OUT resta)
      const netServicePaidCents = reservation.payments
        .filter((p) => !p.isDeposit)
        .reduce((sum, p) => sum + (p.direction === "OUT" ? -1 : 1) * p.amountCents, 0);

      const netDepositPaidCents = reservation.payments
        .filter((p) => p.isDeposit)
        .reduce((sum, p) => sum + (p.direction === "OUT" ? -1 : 1) * p.amountCents, 0);

      const serviceDueCents = Number(reservation.totalPriceCents ?? 0);
      const depositDueCents = computeReservationDepositCents({
        storedDepositCents: reservation.depositCents,
        quantity: reservation.quantity,
        isLicense: Boolean(reservation.isLicense),
        serviceCategory: reservation.service?.category ?? null,
        items: reservation.items ?? [],
      });

      const pendingServiceCents = Math.max(0, serviceDueCents - netServicePaidCents);
      const pendingDepositCents = Math.max(0, depositDueCents - netDepositPaidCents);

      // Bloqueo de caja: no permitir cobro si faltan contratos operativos.
      if (direction === "IN" && reservation.formalizedAt) {
        const requiredUnits = computeRequiredContractUnits({
          quantity: reservation.quantity,
          isLicense: Boolean(reservation.isLicense),
          serviceCategory: reservation.service?.category ?? null,
          items: (reservation.items ?? []).map((it) => ({
            quantity: it.quantity ?? 0,
            isExtra: Boolean(it.isExtra),
            service: it.service ? { category: it.service.category ?? null } : null,
          })),
        });

        const readyCount = countReadyVisibleContracts(reservation.contracts ?? [], requiredUnits);

        if (requiredUnits > 0 && readyCount < requiredUnits) {
          throw Object.assign(
            new Error(`Faltan contratos listos (${readyCount}/${requiredUnits}). Completa contratos antes de cobrar.`),
            { status: 409 }
          );
        }
      }

      // --- Validaciones IN (cobro) ---
      if (direction === "IN") {
        const pendingTarget = isDeposit ? pendingDepositCents : pendingServiceCents;
        if (amountCents > pendingTarget) {
          throw Object.assign(new Error("Importe supera el pendiente"), { status: 400 });
        }
      }

      // --- Validaciones OUT (devolución) ---
      const refundableDepositCents = Math.max(0, netDepositPaidCents);

      if (direction === "OUT") {
        // devoluciones: por ahora solo fianza
        if (!isDeposit) {
          throw Object.assign(new Error("Solo se permite devolución de fianza"), { status: 400 });
        }

        // si plataforma marcó retenida → tienda no puede devolver
        if (reservation.depositHeld) {
          throw Object.assign(
            new Error(
              `Fianza retenida por plataforma` +
              (reservation.depositHoldReason ? `: ${reservation.depositHoldReason}` : "")
            ),
            { status: 400 }
          );
        }

        if (refundableDepositCents <= 0) {
          throw Object.assign(new Error("No hay fianza liberable para devolver"), { status: 400 });
        }

        // no devolver más de lo cobrado neto de fianza
        if (amountCents > refundableDepositCents) {
          throw Object.assign(new Error("Importe supera la fianza cobrada"), { status: 400 });
        }
      }

      // ✅ Crear pago
      const payment = await tx.payment.create({
        data: {
          reservationId,
          origin,
          method,
          amountCents,
          isDeposit,
          direction,
        },
      });

      // ✅ Recalcular tras el pago (incluyendo ESTE pago)
      const newNetServicePaidCents =
        netServicePaidCents + (!isDeposit ? (direction === "OUT" ? -1 : 1) * amountCents : 0);

      const newNetDepositPaidCents =
        netDepositPaidCents + (isDeposit ? (direction === "OUT" ? -1 : 1) * amountCents : 0);

      const newPendingServiceCents = Math.max(0, serviceDueCents - newNetServicePaidCents);
      const newPendingDepositCents = Math.max(0, depositDueCents - newNetDepositPaidCents);

      const fullyPaid = newPendingServiceCents === 0 && newPendingDepositCents === 0;

      // ✅ AUTO: si todo pagado → READY_FOR_PLATFORM (solo si no está finalizada/cancelada)
      let statusUpdated = false;
      let splitInfo: { ok: true; childrenCreated: number; childrenIds?: string[] } | null = null;
      const readyAt = new Date();
      const readyCheck = evaluateReadyForPlatform({
        status: reservation.status,
        formalizedAt: reservation.formalizedAt,
        totalPriceCents: reservation.totalPriceCents,
        depositCents: reservation.depositCents,
        quantity: reservation.quantity,
        isLicense: Boolean(reservation.isLicense),
        service: reservation.service,
        items: (reservation.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null } : null,
        })),
        contracts: (reservation.contracts ?? []).map((contract) => ({
          unitIndex: Number(contract.unitIndex ?? 0),
          status: contract.status,
        })),
        payments: [
          ...(reservation.payments ?? []).map((payment) => ({
            amountCents: Number(payment.amountCents ?? 0),
            isDeposit: Boolean(payment.isDeposit),
            direction: payment.direction,
          })),
          {
            amountCents,
            isDeposit,
            direction,
          },
        ],
      });

      if (fullyPaid && readyCheck.ok) {
        if (reservation.status !== ReservationStatus.READY_FOR_PLATFORM && reservation.status !== ReservationStatus.IN_SEA) {
          await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              status: ReservationStatus.READY_FOR_PLATFORM,
              paymentCompletedAt: reservation.paymentCompletedAt ?? readyAt,
              readyForPlatformAt: readyAt,
            },
          });
          statusUpdated = true;
        }

        // Plataforma consume ReservationUnit; sin units no aparece en cola.
        await ensureReservationPlatformUnitsTx(tx, {
          id: reservation.id,
          quantity: reservation.quantity,
          isPackParent: reservation.isPackParent,
          parentReservationId: reservation.parentReservationId,
          serviceCategory: reservation.service?.category ?? null,
          items: (reservation.items ?? []).map((it) => ({
            quantity: it.quantity ?? 0,
            isExtra: Boolean(it.isExtra),
            service: it.service ? { category: it.service.category ?? null } : null,
          })),
        }, reservation.status === ReservationStatus.READY_FOR_PLATFORM || reservation.status === ReservationStatus.IN_SEA ? undefined : readyAt);
        if (reservation.status !== ReservationStatus.READY_FOR_PLATFORM && reservation.status !== ReservationStatus.IN_SEA) {
          await tx.reservationUnit.updateMany({
            where: { reservationId: reservation.id, status: "READY_FOR_PLATFORM" },
            data: { readyForPlatformAt: readyAt },
          });
        }

        // ✅ OPCIONAL/RECOMENDADO: packs → split automático de extras pendientes en hijas
        const isPackParent = Boolean(reservation.packId && reservation.isPackParent && !reservation.parentReservationId);
        if (isPackParent) {
          const pendingItems = (reservation.items ?? []).filter((it) => it.isExtra && !it.splitReservationId);

          if (pendingItems.length > 0) {
            let created = 0;
            const childrenIds: string[] = [];

            for (const it of pendingItems) {
              if (!it.optionId) {
                // no rompemos el flujo: lo dejamos y seguimos
                continue;
              }

              const child = await tx.reservation.create({
                data: {
                  source: reservation.source,
                  status: ReservationStatus.READY_FOR_PLATFORM,
                  storeQueueStartedAt: reservation.storeQueueStartedAt ?? readyAt,
                  paymentCompletedAt: readyAt,
                  readyForPlatformAt: readyAt,
                  activityDate: reservation.activityDate ?? startOfToday(),
                  scheduledTime: reservation.scheduledTime,
                  isPackParent: false,

                  channelId: reservation.channelId,
                  customerName: reservation.customerName,
                  customerCountry: reservation.customerCountry ?? "ES",
                  customerAddress: "-",
                  customerDocType: "-",
                  customerDocNumber: "-",

                  parentReservationId: reservation.id,
                  packId: reservation.packId,

                  serviceId: it.serviceId,
                  optionId: it.optionId,

                  quantity: Number(it.quantity ?? 1),
                  pax: Number(it.pax ?? reservation.pax ?? 1),

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

            await ensureReservationPlatformUnitsTx(tx, {
              id: child.id,
                quantity: Number(it.quantity ?? 1),
                isPackParent: false,
                parentReservationId: reservation.id,
                items: [
                  {
                    quantity: Number(it.quantity ?? 1),
                    isExtra: false,
                    service: it.service ? { category: it.service.category ?? null } : null,
                  },
                ],
            }, readyAt);

              childrenIds.push(child.id);
              created++;

              await tx.reservationItem.create({
                data: {
                  reservationId: child.id,
                  serviceId: it.serviceId,
                  optionId: it.optionId,
                  servicePriceId: null,
                  quantity: Number(it.quantity ?? 1),
                  pax: Number(it.pax ?? reservation.pax ?? 1),
                  unitPriceCents: 0,
                  totalPriceCents: 0,
                  isExtra: false,
                },
              });

              await tx.reservationItem.update({
                where: { id: it.id },
                data: { splitReservationId: child.id },
              });
            }

            for (const childId of childrenIds) {
              await syncStoreFulfillmentTasksForReservation(tx, childId);
            }

            splitInfo = { ok: true, childrenCreated: created, childrenIds };
          } else {
            splitInfo = { ok: true, childrenCreated: 0 };
          }
        }

        await syncStoreFulfillmentTasksForReservation(tx, reservation.id);
      }

      return {
        ok: true,
        payment,
        fullyPaid,
        readyForPlatformOk: readyCheck.ok,
        statusUpdated,
        newPendingServiceCents,
        newPendingDepositCents,
        splitInfo,
      };
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const status =
      typeof e === "object" && e !== null && "status" in e
        ? Number((e as { status?: number }).status ?? 500)
        : 500;
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status });
  }
}
