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
    DAMAGED: "Da\u00f1ada",
    OUT_OF_SERVICE: "Fuera de servicio",
  };

  if (!status) return "\u2014";
  return map[String(status)] ?? String(status);
}

export function operabilityBlockingReason(
  status: PlatformOperabilityStatus | null | undefined
) {
  if (!status || status === PlatformOperabilityStatus.OPERATIONAL) return null;

  if (status === PlatformOperabilityStatus.MAINTENANCE) {
    return "La unidad est\u00e1 en mantenimiento y no puede asignarse.";
  }

  if (status === PlatformOperabilityStatus.DAMAGED) {
    return "La unidad est\u00e1 marcada como da\u00f1ada y no puede asignarse.";
  }

  if (status === PlatformOperabilityStatus.OUT_OF_SERVICE) {
    return "La unidad est\u00e1 fuera de servicio y no puede asignarse.";
  }

  return "La unidad no est\u00e1 operativa.";
}

export function platformAssignmentBlockingReason(params: {
  operabilityStatus: PlatformOperabilityStatus | null | undefined;
  hasOpenMaintenanceEvent?: boolean;
  hasOpenIncident?: boolean;
}) {
  const operabilityReason = operabilityBlockingReason(params.operabilityStatus);
  if (operabilityReason) {
    return operabilityReason;
  }

  if (!params.operabilityStatus && params.hasOpenMaintenanceEvent) {
    return "Tiene un evento mec\u00e1nico abierto y no puede asignarse.";
  }

  if (!params.operabilityStatus && params.hasOpenIncident) {
    return "Tiene una incidencia abierta de plataforma y no puede asignarse.";
  }

  return null;
}
