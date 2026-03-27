// src/lib/store-rental-assets.ts
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type ItemLike = {
  quantity: number;
  service?: {
    name?: string | null;
    code?: string | null;
    category?: string | null;
  } | null;
};

function normalize(v: string | null | undefined) {
  return String(v ?? "").trim().toUpperCase();
}

function isGoProService(service?: { name?: string | null; code?: string | null; category?: string | null } | null) {
  const name = normalize(service?.name);
  const code = normalize(service?.code);
  const category = normalize(service?.category);

  return (
    name.includes("GOPRO") ||
    code.includes("GOPRO") ||
    (category === "EXTRA" && (name.includes("GO PRO") || code.includes("GO PRO")))
  );
}

function isWetsuitService(service?: { name?: string | null; code?: string | null; category?: string | null } | null) {
  const name = normalize(service?.name);
  const code = normalize(service?.code);
  const category = normalize(service?.category);

  return (
    name.includes("NEOPRENO") ||
    code.includes("NEOPRENO") ||
    category === "WETSUIT"
  );
}

function extractWetsuitSize(service?: { name?: string | null; code?: string | null } | null): string | null {
  const raw = `${normalize(service?.name)} ${normalize(service?.code)}`;
  const match = raw.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/);
  return match?.[1] ?? null;
}

export async function validateReusableAssetsAvailability(args: {
  tx: Tx;
  items: ItemLike[];
}) {
  const goProQty = args.items
    .filter((it) => isGoProService(it.service))
    .reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  const wetsuitBySize = new Map<string, number>();

  for (const it of args.items.filter((x) => isWetsuitService(x.service))) {
    const size = extractWetsuitSize(it.service);
    const key = size ?? "__NO_SIZE__";
    wetsuitBySize.set(key, (wetsuitBySize.get(key) ?? 0) + Number(it.quantity || 0));
  }

  if (goProQty > 0) {
    const availableGoPro = await args.tx.rentalAsset.count({
      where: {
        isActive: true,
        status: "AVAILABLE",
        type: "GOPRO",
      },
    });

    if (goProQty > availableGoPro) {
      throw new Error(`Solo quedan ${availableGoPro} GoPro disponibles.`);
    }
  }

  for (const [sizeKey, requestedQty] of wetsuitBySize.entries()) {
    const size = sizeKey === "__NO_SIZE__" ? null : sizeKey;

    const availableWetsuits = await args.tx.rentalAsset.count({
      where: {
        isActive: true,
        status: "AVAILABLE",
        type: "WETSUIT",
        ...(size ? { size } : {}),
      },
    });

    if (requestedQty > availableWetsuits) {
      throw new Error(
        `Solo quedan ${availableWetsuits} neoprenos${size ? ` talla ${size}` : ""} disponibles.`
      );
    }
  }

  return { ok: true };
}