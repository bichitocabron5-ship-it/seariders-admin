// src/lib/fulfillment/sync-store-fulfillment.ts
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function isCateringService(service: {
  category?: string | null;
  code?: string | null;
  name?: string | null;
}) {
  const category = String(service.category ?? "").toUpperCase();
  const code = String(service.code ?? "").toUpperCase();
  const name = String(service.name ?? "").toUpperCase();

  return (
    category === "CATERING" ||
    code.includes("CATERING") ||
    name.includes("CATERING")
  );
}

function isDeliverableExtraService(service: {
  category?: string | null;
  code?: string | null;
  name?: string | null;
}) {
  const category = String(service.category ?? "").toUpperCase();
  const code = String(service.code ?? "").toUpperCase();
  const name = String(service.name ?? "").toUpperCase();

  return (
    category === "EXTRA" &&
    (
      code.includes("GOPRO") ||
      code.includes("NEOPRENO") ||
      name.includes("GOPRO") ||
      name.includes("NEOPRENO")
    )
  );
}

function deliveryAreaForExtra(service: {
  code?: string | null;
  name?: string | null;
}) {
  const code = String(service.code ?? "").toUpperCase();
  const name = String(service.name ?? "").toUpperCase();

  // Si prefieres que todo esto salga en BAR, deja siempre "BAR"
  if (code.includes("GOPRO") || name.includes("GOPRO")) return "BAR";
  if (code.includes("NEOPRENO") || name.includes("NEOPRENO")) return "BAR";

  return "STORE";
}

async function findBarProductForCateringItem(
  tx: Tx,
  service: { code?: string | null; name?: string | null }
) {
  const code = String(service.code ?? "").trim();
  const name = String(service.name ?? "").trim();

  // Prioridad 1: SKU exacto = code del servicio Store
  if (code) {
    const bySku = await tx.barProduct.findFirst({
      where: { sku: code, isActive: true },
      select: { id: true },
    });
    if (bySku) return bySku.id;
  }

  // Prioridad 2: nombre exacto
  if (name) {
    const byName = await tx.barProduct.findFirst({
      where: { name, isActive: true },
      select: { id: true },
    });
    if (byName) return byName.id;
  }

  return null;
}

async function findBarProductForDeliverableItem(
  tx: Tx,
  service: { code?: string | null; name?: string | null }
) {
  return findBarProductForCateringItem(tx, service);
}

export async function syncStoreFulfillmentTasksForReservation(
  tx: Tx,
  reservationId: string
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      customerName: true,
      activityDate: true,
      scheduledTime: true,
      totalPriceCents: true,
      items: {
        where: {
          // solo items activos/reales si tu schema lo necesita
        },
        select: {
          id: true,
          quantity: true,
          isExtra: true,
          splitReservationId: true,
          service: {
            select: {
              id: true,
              name: true,
              code: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!reservation) {
    throw new Error("Reserva no encontrada para sync de fulfillment.");
  }

  const historicalTaskItems = await tx.fulfillmentTaskItem.findMany({
    where: {
      reservationItemId: { not: null },
      task: {
        reservationId: reservation.id,
        source: "STORE",
        status: { not: "PENDING" },
      },
    },
    select: { reservationItemId: true },
  });
  const frozenReservationItemIds = new Set(
    historicalTaskItems
      .map((row) => row.reservationItemId)
      .filter((value): value is string => Boolean(value))
  );

  // 1) borrar tareas pendientes previas generadas desde STORE para esta reserva
  const pendingTasks = await tx.fulfillmentTask.findMany({
    where: {
      reservationId: reservation.id,
      source: "STORE",
      status: "PENDING",
    },
    select: { id: true },
  });

  if (pendingTasks.length > 0) {
    await tx.fulfillmentTaskItem.deleteMany({
      where: { taskId: { in: pendingTasks.map((t) => t.id) } },
    });

    await tx.fulfillmentTask.deleteMany({
      where: { id: { in: pendingTasks.map((t) => t.id) } },
    });
  }

  const reservationStatus = String(reservation.status ?? "").toUpperCase();
  if (!["READY_FOR_PLATFORM", "IN_SEA"].includes(reservationStatus)) {
    return { ok: true, created: 0 };
  }

  // 2) agrupar items
  const activeItems = reservation.items.filter(
    (it) => !it.splitReservationId && !frozenReservationItemIds.has(it.id)
  );

  const cateringItems = activeItems.filter((it) => it.service && isCateringService(it.service));

  const extraItems = activeItems.filter((it) => it.service && isDeliverableExtraService(it.service));

  let created = 0;

  // 3) crear tarea de catering para BAR
  if (cateringItems.length > 0) {
    const task = await tx.fulfillmentTask.create({
      data: {
        reservationId: reservation.id,
        source: "STORE",
        type: "CATERING",
        area: "BAR",
        status: "PENDING",
        title: `Catering reserva ${reservation.id.slice(-6)}`,
        customerNameSnap: reservation.customerName ?? null,
        paid: true,
        paidAmountCents: 0, // si luego quieres, puedes calcular solo la parte de catering
        scheduledFor: reservation.scheduledTime ?? reservation.activityDate ?? null,
        notes: "Autogenerado desde Store",
      },
      select: { id: true },
    });
    created += 1;

    for (const item of cateringItems) {
      const barProductId = await findBarProductForDeliverableItem(tx, {
        code: item.service?.code ?? null,
        name: item.service?.name ?? null,
      });

      await tx.fulfillmentTaskItem.create({
        data: {
          taskId: task.id,
          barProductId,
          reservationItemId: item.id,
          kind: "BAR_PRODUCT",
          nameSnap: item.service?.name ?? "Producto catering",
          quantity: Number(item.quantity ?? 0),
        },
      });
    }
  }

  // 4) crear tareas de extras físicos
  for (const item of extraItems) {
    const area = deliveryAreaForExtra({
      code: item.service?.code ?? null,
      name: item.service?.name ?? null,
    });
    const barProductId = await findBarProductForDeliverableItem(tx, {
      code: item.service?.code ?? null,
      name: item.service?.name ?? null,
    });

    const task = await tx.fulfillmentTask.create({
      data: {
        reservationId: reservation.id,
        source: "STORE",
        type: "EXTRA_DELIVERY",
        area,
        status: "PENDING",
        title: `Extra ${item.service?.name ?? "Extra"} · ${reservation.id.slice(-6)}`,
        customerNameSnap: reservation.customerName ?? null,
        paid: true,
        paidAmountCents: 0,
        scheduledFor: reservation.scheduledTime ?? reservation.activityDate ?? null,
        notes: "Autogenerado desde Store",
      },
      select: { id: true },
    });
    created += 1;

    await tx.fulfillmentTaskItem.create({
      data: {
        taskId: task.id,
        barProductId,
        reservationItemId: item.id,
        kind: "EXTRA",
        nameSnap: item.service?.name ?? "Extra",
        quantity: Number(item.quantity ?? 0),
      },
    });
  }

  return { ok: true, created };
}
