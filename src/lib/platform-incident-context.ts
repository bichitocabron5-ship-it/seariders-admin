export function resolvePlatformIncidentEntity(input: {
  jetskiId?: string | null;
  assetId?: string | null;
}) {
  if (input.jetskiId) {
    return {
      entityType: "JETSKI" as const,
      jetskiId: input.jetskiId,
      assetId: null,
    };
  }

  return {
    entityType: "ASSET" as const,
    jetskiId: null,
    assetId: input.assetId ?? null,
  };
}
