export type PreparedResourceSelectorKind = "jetski" | "asset";

type PreparedAssetLike = {
  type?: string | null;
};

export function resolvePreparedResourceSelector(args: {
  templateCode?: string | null;
  isLicense: boolean;
  serviceCategory?: string | null;
}): PreparedResourceSelectorKind | null {
  const templateCode = String(args.templateCode ?? "").trim().toUpperCase();

  if (templateCode === "JETSKI_LICENSED") return "jetski";
  if (templateCode === "BOAT_LICENSED") return "asset";
  if (templateCode.length > 0) return null;
  if (!args.isLicense) return null;

  const serviceCategory = String(args.serviceCategory ?? "").trim().toUpperCase();
  if (serviceCategory === "JETSKI") return "jetski";
  if (serviceCategory === "BOAT") return "asset";
  return null;
}

export function filterPreparedBoatAssets<T extends PreparedAssetLike>(assets: readonly T[]): T[] {
  return assets.filter((asset) => asset.type === "BOAT");
}

export function preparedResourcePatchForSelector(args: {
  selectorKind: PreparedResourceSelectorKind | null;
  preparedJetskiId: string;
  preparedAssetId: string;
}): {
  preparedJetskiId?: string | null;
  preparedAssetId?: string | null;
} {
  if (args.selectorKind === "jetski") {
    return {
      preparedJetskiId: args.preparedJetskiId || null,
      preparedAssetId: null,
    };
  }

  if (args.selectorKind === "asset") {
    return {
      preparedJetskiId: null,
      preparedAssetId: args.preparedAssetId || null,
    };
  }

  return {};
}
