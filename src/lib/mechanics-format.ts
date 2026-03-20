// ssrc/lib/mechanics-format.ts
export function fmtNumber(
  value: number | string | null | undefined,
  decimals = 1
) {
  if (value == null || value === "") return "—";

  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtHours(value: number | string | null | undefined) {
  return fmtNumber(value, 1);
}

export function eurFromCents(value: number | null | undefined) {
  if (value == null) return "—";
  return `${(value / 100).toFixed(2)} €`;
}

export function isNegativeNumber(value: number | string | null | undefined) {
  if (value == null || value === "") return false;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n < 0;
}

export function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}