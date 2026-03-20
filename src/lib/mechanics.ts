export type ServiceState = "UNKNOWN" | "OK" | "WARN" | "DUE";

export function calcService(o: {
  currentHours: number | null;
  lastServiceHours: number | null;
  serviceIntervalHours: number;
  serviceWarnHours: number;
}) {
  const current = o.currentHours;
  const last = o.lastServiceHours ?? 0;

  if (current === null || Number.isNaN(current)) {
    return {
      state: "UNKNOWN" as ServiceState,
      hoursSinceService: null as number | null,
      serviceDueAt: last + o.serviceIntervalHours,
      hoursLeft: null as number | null,
    };
  }

  const hoursSinceService = Math.max(0, current - last);
  const serviceDueAt = last + o.serviceIntervalHours;
  const hoursLeft = serviceDueAt - current;

  let state: ServiceState = "OK";
  if (current >= serviceDueAt) state = "DUE";
  else if (hoursSinceService >= o.serviceWarnHours) state = "WARN";

  return { state, hoursSinceService, serviceDueAt, hoursLeft };
}
