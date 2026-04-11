import { AssetType } from "@prisma/client";

function normalizeCategory(category: string | null | undefined) {
  return String(category ?? "").trim().toUpperCase();
}

export function allowedAssetTypesForServiceCategory(
  category: string | null | undefined
): AssetType[] | null {
  const normalized = normalizeCategory(category);

  if (!normalized) return null;
  if (normalized === "TOWABLE") return [AssetType.TOWABLE, AssetType.TOWBOAT];
  if (normalized === "JETCAR") return [AssetType.JETCAR];
  if (normalized === "BOAT") return [AssetType.BOAT, AssetType.PARASAILING, AssetType.FLYBOARD];
  if (normalized === "PARASAILING") return [AssetType.PARASAILING, AssetType.BOAT];
  if (normalized === "FLYBOARD") return [AssetType.FLYBOARD, AssetType.BOAT];

  return null;
}

export function isAssetCompatibleWithServiceCategory(params: {
  assetType: AssetType | string | null | undefined;
  serviceCategory: string | null | undefined;
}) {
  const allowed = allowedAssetTypesForServiceCategory(params.serviceCategory);
  if (!allowed) return true;
  return allowed.includes(params.assetType as AssetType);
}

export function assetCompatibilityReason(serviceCategory: string | null | undefined) {
  const normalized = normalizeCategory(serviceCategory);
  const allowed = allowedAssetTypesForServiceCategory(serviceCategory);

  if (!normalized || !allowed) return null;
  return `El servicio ${normalized} solo admite recursos de tipo ${allowed.join(" / ")}.`;
}
