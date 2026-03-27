// src/app/store/services/assets.ts
export type AssetAvailability = {
  type: "GOPRO" | "WETSUIT" | "OTHER";
  size: string | null;
  available: number;
};

export async function getAssetAvailability() {
  const res = await fetch("/api/store/assets/availability", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());

  return (await res.json()) as {
    ok: true;
    rows: AssetAvailability[];
  };
}