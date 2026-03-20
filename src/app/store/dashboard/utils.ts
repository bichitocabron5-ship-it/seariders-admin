export function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export async function ensureOkResponse(res: Response, fallbackMessage: string) {
  if (res.ok) return;
  const detail = (await res.text()).trim();
  throw new Error(detail || fallbackMessage);
}

export function todayLocalYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

export function normalizeEurosInput(v: string) {
  return String(v || "").replace(",", ".");
}

export function centsFromEuros(v: string) {
  const n = Number(normalizeEurosInput(v));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function statusColor(status: string) {
  switch (status) {
    case "WAITING":
      return "#e5e7eb";
    case "READY_FOR_PLATFORM":
      return "#dbeafe";
    case "IN_SEA":
      return "#ffedd5";
    case "FINISHED":
      return "#dcfce7";
    case "CANCELED":
      return "#fee2e2";
    default:
      return "#f3f4f6";
  }
}

export function hhmm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function getStoreFormalizedWaitMeta(params: {
  formalizedAt?: string | null;
  status: string;
  pendingTotal: number;
  nowMs?: number;
}) {
  if (!params.formalizedAt) return null;
  if (params.pendingTotal <= 0) return null;
  if (params.status === "READY_FOR_PLATFORM" || params.status === "IN_SEA") return null;

  const startedMs = new Date(params.formalizedAt).getTime();
  if (!Number.isFinite(startedMs)) return null;

  const waitMs = Math.max(0, (params.nowMs ?? Date.now()) - startedMs);
  const warnMs = 15 * 60_000;
  const criticalMs = 30 * 60_000;
  const isCritical = waitMs >= criticalMs;
  const isWarn = waitMs >= warnMs;

  return {
    waitMs,
    isWarn,
    isCritical,
    label: isCritical
      ? "ALERTA CRITICA (30+ min)"
      : isWarn
        ? "Alerta de cobro (15+ min)"
        : `Cobro ${msToClock(waitMs)}`,
    bg: isCritical ? "#fff1f2" : isWarn ? "#fffbeb" : "#eff6ff",
    bd: isCritical ? "#fecaca" : isWarn ? "#fde68a" : "#bfdbfe",
    fg: isCritical ? "#b91c1c" : isWarn ? "#92400e" : "#1d4ed8",
  };
}
