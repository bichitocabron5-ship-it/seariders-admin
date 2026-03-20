export const PART_CATEGORIES = [
  "Mantenimiento y Consumibles",
  "Sistema de Propulsión y Turbina",
  "Motor y Mecánica Interna",
  "Electricidad y Electrónica",
  "Casco, Cubierta y Accesorios",
] as const;

export type PartCategory = (typeof PART_CATEGORIES)[number];

export function normalizePartCategory(category: string | null | undefined) {
  const trimmed = category?.trim();
  return trimmed || "Sin categoría";
}
