// src/lib/operability.ts
import { PlatformOperabilityStatus } from "@prisma/client";

export function isOperableStatus(
  status: PlatformOperabilityStatus | null | undefined
) {
  return status === PlatformOperabilityStatus.OPERATIONAL;
}

export function operabilityLabel(
  status: PlatformOperabilityStatus | string | null | undefined
) {
  const map: Record<string, string> = {
    OPERATIONAL: "Operativa",
    MAINTENANCE: "Mantenimiento",
    DAMAGED: "Dañada",
    OUT_OF_SERVICE: "Fuera de servicio",
  };

  if (!status) return "—";
  return map[String(status)] ?? String(status);
}

export function operabilityBlockingReason(
  status: PlatformOperabilityStatus | null | undefined
) {
  if (!status || status === PlatformOperabilityStatus.OPERATIONAL) return null;

  if (status === PlatformOperabilityStatus.MAINTENANCE) {
    return "La unidad está en mantenimiento y no puede asignarse.";
  }

  if (status === PlatformOperabilityStatus.DAMAGED) {
    return "La unidad está marcada como dañada y no puede asignarse.";
  }

  if (status === PlatformOperabilityStatus.OUT_OF_SERVICE) {
    return "La unidad está fuera de servicio y no puede asignarse.";
  }

  return "La unidad no está operativa.";
}