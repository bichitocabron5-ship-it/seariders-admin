// src/lib/operability-ui.ts
import type React from "react";

export function operabilityLabel(value: string | null | undefined) {
  const map: Record<string, string> = {
    OPERATIONAL: "Operativa",
    MAINTENANCE: "Mantenimiento",
    DAMAGED: "Dañada",
    OUT_OF_SERVICE: "Fuera de servicio",
  };

  if (!value) return "—";
  return map[value] ?? value;
}

export function operabilityBadgeStyle(
  value: string | null | undefined
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #e5e7eb",
    background: "#fff",
  };

  if (value === "OUT_OF_SERVICE") {
    return {
      ...base,
      borderColor: "#fecaca",
      background: "#fff1f2",
      color: "#b91c1c",
    };
  }

  if (value === "DAMAGED") {
    return {
      ...base,
      borderColor: "#fde68a",
      background: "#fffbeb",
      color: "#92400e",
    };
  }

  if (value === "MAINTENANCE") {
    return {
      ...base,
      borderColor: "#bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  return {
    ...base,
    borderColor: "#bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
  };
}