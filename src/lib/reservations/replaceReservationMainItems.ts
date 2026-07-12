import type { Prisma } from "@prisma/client";

export type ReplacementReservationItemInput = {
  serviceId: string;
  optionId: string | null;
  servicePriceId: string | null;
  quantity: number;
  pax: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isPackParent?: boolean;
};

export type ExistingReservationItemForReplacement = {
  id: string;
  serviceId: string;
  optionId: string | null;
  servicePriceId?: string | null;
  quantity: number | null;
  pax: number | null;
  unitPriceCents: number | null;
  totalPriceCents: number | null;
  isExtra?: boolean | null;
  isPackParent?: boolean | null;
};

function itemKey(item: { serviceId: string; optionId?: string | null }) {
  return `${item.serviceId}::${item.optionId ?? ""}`;
}

function sameContractMaterialShape(
  existing: ExistingReservationItemForReplacement,
  next: ReplacementReservationItemInput
) {
  return (
    existing.serviceId === next.serviceId &&
    (existing.optionId ?? null) === (next.optionId ?? null) &&
    Number(existing.quantity ?? 0) === Number(next.quantity ?? 0) &&
    Number(existing.pax ?? 0) === Number(next.pax ?? 0) &&
    Number(existing.totalPriceCents ?? 0) === Number(next.totalPriceCents ?? 0)
  );
}

function takeMatchingExisting(
  buckets: Map<string, ExistingReservationItemForReplacement[]>,
  next: ReplacementReservationItemInput
) {
  const bucket = buckets.get(itemKey(next));
  if (!bucket?.length) return null;
  return bucket.shift() ?? null;
}

export async function replaceReservationMainItemsTx(
  tx: Prisma.TransactionClient,
  args: {
    reservationId: string;
    existingItems: ExistingReservationItemForReplacement[];
    nextItems: ReplacementReservationItemInput[];
  }
) {
  const mainExisting = args.existingItems.filter((item) => !item.isExtra);
  const buckets = new Map<string, ExistingReservationItemForReplacement[]>();
  for (const item of mainExisting) {
    const bucket = buckets.get(itemKey(item)) ?? [];
    bucket.push(item);
    buckets.set(itemKey(item), bucket);
  }

  const remainingExisting = [...mainExisting];
  const changedReservationItemIds = new Set<string>();
  const keptReservationItemIds = new Set<string>();
  const nextReservationItemIds: string[] = [];

  function removeRemaining(id: string) {
    const index = remainingExisting.findIndex((item) => item.id === id);
    if (index >= 0) remainingExisting.splice(index, 1);
  }

  function removeFromBucket(item: ExistingReservationItemForReplacement) {
    const bucket = buckets.get(itemKey(item));
    if (!bucket?.length) return;
    const index = bucket.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) bucket.splice(index, 1);
  }

  for (const next of args.nextItems) {
    const matched = takeMatchingExisting(buckets, next) ?? remainingExisting.shift() ?? null;

    if (!matched) {
      const created = await tx.reservationItem.create({
        data: {
          reservationId: args.reservationId,
          serviceId: next.serviceId,
          optionId: next.optionId,
          servicePriceId: next.servicePriceId,
          quantity: next.quantity,
          pax: next.pax,
          unitPriceCents: next.unitPriceCents,
          totalPriceCents: next.totalPriceCents,
          isExtra: false,
          isPackParent: Boolean(next.isPackParent),
        },
        select: { id: true },
      });
      changedReservationItemIds.add(created.id);
      keptReservationItemIds.add(created.id);
      nextReservationItemIds.push(created.id);
      continue;
    }

    removeRemaining(matched.id);
    removeFromBucket(matched);
    keptReservationItemIds.add(matched.id);
    nextReservationItemIds.push(matched.id);
    if (!sameContractMaterialShape(matched, next)) {
      changedReservationItemIds.add(matched.id);
    }

    await tx.reservationItem.update({
      where: { id: matched.id },
      data: {
        serviceId: next.serviceId,
        optionId: next.optionId,
        servicePriceId: next.servicePriceId,
        quantity: next.quantity,
        pax: next.pax,
        unitPriceCents: next.unitPriceCents,
        totalPriceCents: next.totalPriceCents,
        isExtra: false,
        isPackParent: Boolean(next.isPackParent),
      },
      select: { id: true },
    });
  }

  const removedReservationItemIds = mainExisting
    .filter((item) => !keptReservationItemIds.has(item.id))
    .map((item) => item.id);

  return {
    nextReservationItemIds,
    changedReservationItemIds,
    removedReservationItemIds,
  };
}

export async function deleteRemovedReservationMainItemsTx(
  tx: Prisma.TransactionClient,
  reservationItemIds: readonly string[]
) {
  if (reservationItemIds.length === 0) return;
  await tx.reservationItem.deleteMany({
    where: { id: { in: [...reservationItemIds] } },
  });
}
