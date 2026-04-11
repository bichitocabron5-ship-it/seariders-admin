export type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";

export const SERVICE_EVENT_TYPES = new Set(["SERVICE", "OIL_CHANGE"]);

export function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

export function minutesToHours(minutes: number) {
  return roundHours(minutes / 60);
}

export function diffHours(startedAt: Date, endedAt: Date) {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return roundHours(diffMs / 3_600_000);
}

export function applyLiveHours(
  currentHours: number | null,
  activeHours: number
) {
  if (currentHours === null || Number.isNaN(currentHours)) return null;
  return roundHours(currentHours + Math.max(0, activeHours));
}

export function calcService(o: {
  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;
}) {
  const current = o.currentHours;
  const last = o.lastServiceHours;

  if (current === null || Number.isNaN(current)) {
    return {
      state: "UNKNOWN" as ServiceState,
      hoursSinceService: null as number | null,
      serviceDueAt: (last ?? 0) + o.serviceIntervalHours,
      hoursLeft: null as number | null,
    };
  }

  const effectiveBaseHours = last ?? current;
  const hoursSinceService = Math.max(0, current - effectiveBaseHours);
  const serviceDueAt = effectiveBaseHours + o.serviceIntervalHours;
  const hoursLeft = serviceDueAt - current;

  let state: ServiceState = "OK";
  if (current >= serviceDueAt) state = "DUE";
  else if (hoursSinceService >= o.serviceWarnHours) state = "WARN";

  return { state, hoursSinceService, serviceDueAt, hoursLeft };
}

export function isServiceEventType(type: string | null | undefined) {
  return typeof type === "string" && SERVICE_EVENT_TYPES.has(type);
}
