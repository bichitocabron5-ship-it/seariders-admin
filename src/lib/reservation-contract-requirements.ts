import {
  needsContractForCategory,
  needsContractForReservationItemCategory,
} from "@/lib/reservation-rules";
import type { ReservationContractPreparedResourceKind } from "@/lib/reservation-contract-sync-plan";

export type ReservationContractRequirementItem = {
  id?: string | null;
  serviceId?: string | null;
  optionId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  isExtra?: boolean | null;
  service?: {
    name?: string | null;
    category?: string | null;
    code?: string | null;
  } | null;
  option?: {
    durationMinutes?: number | null;
  } | null;
};

export type ReservationContractRequirement = {
  reservationItemId: string | null;
  logicalUnitIndex: number;
  itemUnitIndex: number;
  templateCode: string | null;
  requiresLicense: boolean;
  expectedResourceKind: ReservationContractPreparedResourceKind | null;
  expectedAssetType: string | null;
  serviceId: string | null;
  optionId: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  quantity: number;
  pax: number | null;
  totalPriceCents: number | null;
};

function normalizeCode(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeQuantity(value: number | null | undefined) {
  const parsed = Math.trunc(Number(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export function templateCodeForContractRequirement(args: {
  category?: string | null;
  isLicense: boolean;
}) {
  const category = normalizeCode(args.category);
  if (category === "JETSKI" && args.isLicense) return "JETSKI_LICENSED";
  if (category === "JETSKI") return "JETSKI_NO_LICENSE";
  if (category === "BOAT" && args.isLicense) return "BOAT_LICENSED";
  return null;
}

export function expectedResourceKindForTemplate(
  templateCode: string | null | undefined
): ReservationContractPreparedResourceKind | null {
  const code = normalizeCode(templateCode);
  if (code === "JETSKI_LICENSED") return "jetski";
  if (code === "BOAT_LICENSED") return "asset";
  return null;
}

function requirementForLine(args: {
  reservationItemId: string | null;
  logicalUnitIndex: number;
  itemUnitIndex: number;
  isLicense: boolean;
  item: ReservationContractRequirementItem;
}) {
  const category = normalizeCode(args.item.service?.category ?? null);
  const templateCode = templateCodeForContractRequirement({
    category,
    isLicense: args.isLicense,
  });

  return {
    reservationItemId: args.reservationItemId,
    logicalUnitIndex: args.logicalUnitIndex,
    itemUnitIndex: args.itemUnitIndex,
    templateCode,
    requiresLicense: Boolean(args.isLicense),
    expectedResourceKind: expectedResourceKindForTemplate(templateCode),
    expectedAssetType: templateCode === "BOAT_LICENSED" ? "BOAT" : null,
    serviceId: args.item.serviceId ?? null,
    optionId: args.item.optionId ?? null,
    serviceName: args.item.service?.name ?? null,
    serviceCategory: category,
    durationMinutes: args.item.option?.durationMinutes ?? null,
    quantity: normalizeQuantity(args.item.quantity),
    pax: args.item.pax ?? null,
    totalPriceCents: args.item.totalPriceCents ?? null,
  } satisfies ReservationContractRequirement;
}

export function buildReservationContractRequirements(input: {
  quantity: number | null | undefined;
  isLicense: boolean;
  serviceId?: string | null;
  optionId?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  durationMinutes?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  items?: ReservationContractRequirementItem[] | null;
}) {
  const mainItems = (input.items ?? []).filter((item) => !item.isExtra);
  const requirements: ReservationContractRequirement[] = [];
  let logicalUnitIndex = 1;

  if (mainItems.length > 0) {
    for (const item of mainItems) {
      const quantity = normalizeQuantity(item.quantity);
      const category = item.service?.category ?? null;
      if (!needsContractForReservationItemCategory(category, input.isLicense)) continue;

      for (let itemUnitIndex = 1; itemUnitIndex <= quantity; itemUnitIndex += 1) {
        requirements.push(
          requirementForLine({
            reservationItemId: item.id ?? null,
            logicalUnitIndex,
            itemUnitIndex,
            isLicense: input.isLicense,
            item,
          })
        );
        logicalUnitIndex += 1;
      }
    }

    return requirements;
  }

  const quantity = normalizeQuantity(input.quantity);
  if (!needsContractForCategory(input.serviceCategory, input.isLicense)) return requirements;

  for (let itemUnitIndex = 1; itemUnitIndex <= quantity; itemUnitIndex += 1) {
    requirements.push(
      requirementForLine({
        reservationItemId: null,
        logicalUnitIndex,
        itemUnitIndex,
        isLicense: input.isLicense,
        item: {
          serviceId: input.serviceId ?? null,
          optionId: input.optionId ?? null,
          quantity,
          pax: input.pax ?? null,
          totalPriceCents: input.totalPriceCents ?? null,
          isExtra: false,
          service: {
            name: input.serviceName ?? null,
            category: input.serviceCategory ?? null,
          },
          option: {
            durationMinutes: input.durationMinutes ?? null,
          },
        },
      })
    );
    logicalUnitIndex += 1;
  }

  return requirements;
}

export function countReservationContractRequirements(input: Parameters<typeof buildReservationContractRequirements>[0]) {
  return buildReservationContractRequirements(input).length;
}

export function reservationContractRequirementsToSyncTargets(
  requirements: readonly ReservationContractRequirement[],
  options: {
    changedReservationItemIds?: ReadonlySet<string>;
    materialChange?: boolean;
  } = {}
) {
  return requirements.map((requirement) => ({
    reservationItemId: requirement.reservationItemId,
    logicalUnitIndex: requirement.logicalUnitIndex,
    templateCode: requirement.templateCode,
    requiresLicense: requirement.requiresLicense,
    expectedResourceKind: requirement.expectedResourceKind,
    expectedAssetType: requirement.expectedAssetType,
    materialChange:
      Boolean(options.materialChange) ||
      Boolean(
        requirement.reservationItemId &&
          options.changedReservationItemIds?.has(requirement.reservationItemId)
      ),
  }));
}

export function findContractRequirementForContract<T extends { reservationItemId?: string | null; logicalUnitIndex?: number | null; unitIndex?: number | null }>(
  requirements: readonly ReservationContractRequirement[],
  contract: T
) {
  const contractItemId = contract.reservationItemId ?? null;
  const contractSlot = Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);

  if (contractItemId) {
    return (
      requirements.find(
        (requirement) =>
          requirement.reservationItemId === contractItemId &&
          requirement.logicalUnitIndex === contractSlot
      ) ??
      requirements.find((requirement) => requirement.reservationItemId === contractItemId) ??
      null
    );
  }

  return (
    requirements.find(
      (requirement) =>
        requirement.reservationItemId === null &&
        requirement.logicalUnitIndex === contractSlot
    ) ??
    (new Set(
      requirements
        .map((requirement) => requirement.reservationItemId)
        .filter((itemId): itemId is string => Boolean(itemId))
    ).size <= 1
      ? requirements.find((requirement) => requirement.logicalUnitIndex === contractSlot) ?? null
      : null)
  );
}
