export type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";

export const SERVICE_EVENT_TYPES = new Set(["SERVICE", "OIL_CHANGE"]);

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
