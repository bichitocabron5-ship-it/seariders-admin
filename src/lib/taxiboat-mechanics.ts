import { diffHours } from "@/lib/mechanics";
import type { TaxiboatBoat, TaxiboatOperationStatus } from "@prisma/client";

const TAXIBOAT_ASSET_CODES: Record<TaxiboatBoat, string[]> = {
  TAXIBOAT_1: ["TAXIBOAT_1"],
  TAXIBOAT_2: ["TAXIBOAT_2"],
};

type AssetLike = {
  id: string;
  name: string;
  code?: string | null;
};

type TaxiboatOperationLike = {
  boat: TaxiboatBoat;
  status: TaxiboatOperationStatus;
  departedBoothAt?: Date | null;
  departedPlatformAt?: Date | null;
};

function normalizeToken(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function resolveTaxiboatAssetIdFromAssets(
  assets: AssetLike[],
  boat: TaxiboatBoat
) {
  const codes = TAXIBOAT_ASSET_CODES[boat].map(normalizeToken);

  for (const asset of assets) {
    const code = normalizeToken(asset.code);

    for (const expectedCode of codes) {
      if (code === expectedCode) {
        return asset.id;
      }
    }
  }

  return null;
}

export function getTaxiboatTravelStart(
  operation: TaxiboatOperationLike
) {
  if (operation.status === "TO_PLATFORM") {
    return operation.departedBoothAt ?? null;
  }

  if (operation.status === "TO_BOOTH") {
    return operation.departedPlatformAt ?? null;
  }

  return null;
}

export function getActiveTaxiboatHoursMap(params: {
  assets: AssetLike[];
  operations: TaxiboatOperationLike[];
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const map = new Map<string, number>();

  for (const operation of params.operations) {
    const startedAt = getTaxiboatTravelStart(operation);
    if (!startedAt) continue;

    const assetId = resolveTaxiboatAssetIdFromAssets(params.assets, operation.boat);
    if (!assetId) continue;

    map.set(assetId, (map.get(assetId) ?? 0) + diffHours(startedAt, now));
  }

  return map;
}
