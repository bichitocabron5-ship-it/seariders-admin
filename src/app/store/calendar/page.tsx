// src/app/store/calendar/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import { StoreHero, StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";

type LiteRow = {
  id: string;
  status: string;
  storeFlowStage: string | null;
  activityDate: string;
  scheduledTime: string | null;
  arrivalAt?: string | null;
  customerName: string;
  formalizedAt?: string | null;
  pendingCents?: number;
  totalCents?: number;
  paidCents?: number;
  service?: { name: string; category?: string | null };
  option?: { durationMinutes?: number | null; paxMax?: number | null };
  contractsRequiredUnits?: number;
  contractsReadyCount?: number;
};

type DayBucket = { count: number; rows: LiteRow[] };
type ApiResponse = { ok: boolean; month: string; days: Record<string, DayBucket> };

type RowAction = {
  label: string;
  href: string;
  secondary?: { label: string; href: string };
};

const BUSINESS_TZ = "Europe/Madrid";

function todayMadridYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekdayMadrid(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: BUSINESS_TZ,
    weekday: "long",
  }).format(d);
}

function euros(cents?: number) {
  const v = Number(cents ?? 0);
  return `${(v / 100).toFixed(2)} EUR`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function yyyyMmDdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addMonths(d: Date, delta: number) {
  const x = new Date(d);
  x.setDate(1);
  x.setMonth(x.getMonth() + delta);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfCalendarGrid(monthDate: Date) {
  const first = startOfMonth(monthDate);
  const day = first.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isPastDateLocal(yyyyMmDd: string) {
  return yyyyMmDd < todayMadridYmd();
}

function dayKeyFromRow(r: LiteRow) {
  const src = r.scheduledTime ?? r.activityDate;
  if (!src) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(src));
}

function isHistoricalRow(r: LiteRow) {
  const k = dayKeyFromRow(r);
  return k ? isPastDateLocal(k) : false;
}

function isPendingFormalization(r: LiteRow) {
  return !r.formalizedAt;
}

function displayStatus(r: LiteRow) {
  if (!isHistoricalRow(r) && isPendingFormalization(r)) return "PENDING";
  return r.storeFlowStage || r.status;
}

function displayStatusLabel(r: LiteRow) {
  const status = displayStatus(r);
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "QUEUE":
      return "Pendiente de salida";
    case "RETURN_PENDING_CLOSE":
      return "Devuelta pendiente de cierre";
    case "READY_FOR_PLATFORM":
      return "Lista para platform";
    case "IN_SEA":
      return "En mar";
    case "COMPLETED":
      return "Completada";
    case "CANCELED":
    case "CANCELLED":
      return "Cancelada";
    case "WAITING":
      return "En espera";
    default:
      return status;
  }
}

function isTodayLocal(yyyyMmDd: string) {
  return yyyyMmDd === todayMadridYmd();
}

function rowDayKey(r: LiteRow) {
  const src = r.scheduledTime ?? r.activityDate;
  if (!src) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(src));
}

function actionForRow(r: LiteRow): RowAction {
  if (r.status === "CANCELED" || r.status === "CANCELLED") {
    return { label: "Ver ficha", href: `/store?reservationId=${r.id}` };
  }

  const dayKey = rowDayKey(r);
  const past = dayKey ? isPastDateLocal(dayKey) : false;
  const today = dayKey ? isTodayLocal(dayKey) : false;

  if (isPendingFormalization(r)) {
    if (today) return { label: "Formalizar", href: `/store/create?migrateFrom=${r.id}` };
    return { label: "Editar reserva", href: `/store/create?editFrom=${r.id}` };
  }

  if (past) return { label: "Ver ficha", href: `/store?reservationId=${r.id}` };

  return {
    label: "Abrir ficha",
    href: `/store?reservationId=${r.id}`,
    secondary: { label: "Editar / reagendar", href: `/store/create?editFrom=${r.id}` },
  };
}

function actionHintForRow(r: LiteRow) {
  const status = displayStatus(r);
  if (status === "CANCELED" || status === "COMPLETED") return "Consulta y seguimiento de la ficha.";
  if (status === "RETURN_PENDING_CLOSE") return "La reserva ya volvió y queda pendiente de cierre en tienda.";
  if (isHistoricalRow(r)) return "Consulta de la reserva histórica.";
  if (isPendingFormalization(r)) {
    return "Antes de formalizar puedes ajustar actividad, cantidad, fecha u hora.";
  }
  return "Puedes editar actividad, cantidad, fecha, hora, reagendar o cancelar.";
}

function hhmm(iso?: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function monthTitle(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === "PENDING") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  if (status === "CANCELED" || status === "CANCELLED") return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  if (status === "COMPLETED") return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  if (status === "RETURN_PENDING_CLOSE") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  if (status === "QUEUE") return { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
  if (status === "WAITING") return { background: "#e5e7eb", color: "#374151", border: "1px solid #d1d5db" };
  if (status === "READY_FOR_PLATFORM") return { background: "#e0f2fe", color: "#075985", border: "1px solid #bae6fd" };
  if (status === "IN_SEA") return { background: "#ede9fe", color: "#5b21b6", border: "1px solid #ddd6fe" };
  return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
}

function contractsBadgeStyle(readyCount: number, requiredUnits: number): React.CSSProperties {
  if (requiredUnits <= 0) return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
  if (readyCount >= requiredUnits) return { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" };
  if (readyCount > 0) return { background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" };
  return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
}

const shellStyle: React.CSSProperties = { ...storeStyles.shell, width: "min(1380px, 100%)" };
const panelStyle: React.CSSProperties = { ...storeStyles.panel, borderRadius: 22 };
const actionStyle: React.CSSProperties = {
  ...storeStyles.secondaryButton,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  textDecoration: "none",
};
const heroPillStyle: React.CSSProperties = { ...opsStyles.heroPill, background: "rgba(15, 23, 42, 0.24)", color: "#fff" };
function RowCard({
  r,
  onCancel,
  canceling,
}: {
  r: LiteRow;
  onCancel: (row: LiteRow) => Promise<void>;
  canceling: boolean;
}) {
  const a = actionForRow(r);
  const canCancel = displayStatus(r) !== "CANCELED" && displayStatus(r) !== "COMPLETED";
  const requiredUnits = Number(r.contractsRequiredUnits ?? 0);
  const readyCount = Number(r.contractsReadyCount ?? 0);
  return (
    <article style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 16, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900 }}>
          {(hhmm(r.scheduledTime) || "Sin hora") + " | " + (r.customerName || "Sin nombre")}
        </div>
        <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, fontWeight: 800, ...statusBadgeStyle(displayStatus(r)) }}>
          {displayStatusLabel(r)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: "#475569" }}>
        {r.service?.category ? `${r.service.category} | ` : ""}
        {r.service?.name ?? "Servicio"}
        {r.option?.durationMinutes ? ` | ${r.option.durationMinutes} min` : ""}
        {r.option?.paxMax ? ` | pax ${r.option.paxMax}` : ""}
      </div>

      {requiredUnits > 0 ? (
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            ...contractsBadgeStyle(readyCount, requiredUnits),
          }}
        >
          {`Contratos ${readyCount}/${requiredUnits}`}
        </div>
      ) : null}

      {displayStatus(r) === "RETURN_PENDING_CLOSE" && r.arrivalAt ? (
        <div style={{ fontSize: 12, color: "#92400e" }}>
          Devuelta: <b>{hhmm(r.arrivalAt) || new Date(r.arrivalAt).toLocaleString("es-ES", { timeZone: BUSINESS_TZ })}</b>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, color: "#334155" }}>
        {typeof r.totalCents !== "undefined" ? <span>Total: <b>{euros(r.totalCents)}</b></span> : null}
        {typeof r.pendingCents !== "undefined" ? <span>Pendiente: <b>{euros(r.pendingCents)}</b></span> : null}
      </div>

      <div style={{ fontSize: 12, color: "#64748b" }}>
        {actionHintForRow(r)}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href={a.href}
          style={{
            ...actionStyle,
            border: "1px solid #0f172a",
            background: a.label === "Formalizar" ? "#0f172a" : "#fff",
            color: a.label === "Formalizar" ? "#fff" : "#111827",
          }}
        >
          {a.label}
        </a>
        {a.secondary ? (
          <a href={a.secondary.href} style={actionStyle}>
            {a.secondary.label}
          </a>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            onClick={() => void onCancel(r)}
            disabled={canceling}
            style={{
              ...actionStyle,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              cursor: canceling ? "wait" : "pointer",
            }}
          >
            {canceling ? "Cancelando..." : "Cancelar"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function StoreCalendarPage() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [cancelingId, setCancelingId] = useState<string>("");

  const month = useMemo(() => monthKey(monthDate), [monthDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/store/calendar/month?month=${month}`, { cache: "no-store" });
      if (!r.ok) {
        const ct = r.headers.get("content-type") || "";
        const msg = ct.includes("application/json") ? (await r.json().catch(() => null))?.error : (await r.text()).slice(0, 200);
        throw new Error(msg || `Error ${r.status}`);
      }

      const j = (await r.json()) as ApiResponse;
      setData(j);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando calendario");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (selectedDay && !selectedDay.startsWith(month)) setSelectedDay("");
  }, [month, selectedDay]);

  useEffect(() => {
    load();
  }, [load]);

  const gridStart = useMemo(() => startOfCalendarGrid(monthDate), [monthDate]);
  const cells = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [gridStart]);

  const selectedBucket: DayBucket | null = useMemo(() => {
    if (!data?.days || !selectedDay) return null;
    return data.days[selectedDay] ?? { count: 0, rows: [] };
  }, [data, selectedDay]);

  const selectedGroups = useMemo(() => {
    const rows = selectedBucket?.rows ?? [];
    const pending = rows.filter((r) => !isHistoricalRow(r) && isPendingFormalization(r));
    const ops = rows.filter((r) => !isHistoricalRow(r) && !isPendingFormalization(r));
    const hist = rows.filter((r) => isHistoricalRow(r));
    return { pending, ops, hist };
  }, [selectedBucket]);

  const weekDays = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const todayKey = todayMadridYmd();
  const mode = selectedDay === todayKey ? "today" : "future";
  const monthReservations = useMemo(
    () => Object.values(data?.days ?? {}).reduce((acc, bucket) => acc + Number(bucket?.count ?? 0), 0),
    [data]
  );
  const monthPending = useMemo(
    () =>
      Object.values(data?.days ?? {}).reduce(
        (acc, bucket) => acc + (bucket?.rows ?? []).filter((r) => !isHistoricalRow(r) && isPendingFormalization(r)).length,
        0
      ),
    [data]
  );

  const askRefundMethod = useCallback(() => {
    const raw = window.prompt("Método para la devolución: CASH, CARD, BIZUM o TRANSFER", "CARD");
    if (raw === null) return null;
    const value = raw.trim().toUpperCase();
    if (value === "CASH" || value === "CARD" || value === "BIZUM" || value === "TRANSFER") return value;
    throw new Error("Método de devolución no válido");
  }, []);

  const cancelReservation = useCallback(
    async (row: LiteRow) => {
      const paidCents = Math.max(0, Number(row.paidCents ?? 0));
      const wantsCancel = window.confirm(
        paidCents > 0
          ? "La reserva tiene cobros registrados. Aceptar = continuar con la cancelación."
          : "¿Cancelar esta reserva?"
      );
      if (!wantsCancel) return;

      let refundMode: "NONE" | "FULL" = "NONE";
      let refundMethod: "CASH" | "CARD" | "BIZUM" | "TRANSFER" = "CARD";

      if (paidCents > 0) {
        const wantsRefund = window.confirm("Aceptar = cancelar y devolver el dinero cobrado. Cancelar = cancelar sin devolución.");
        refundMode = wantsRefund ? "FULL" : "NONE";
        if (wantsRefund) {
          const chosenMethod = askRefundMethod();
          if (!chosenMethod) return;
          refundMethod = chosenMethod;
        }
      }

      setCancelingId(row.id);
      setErr(null);
      try {
        const res = await fetch(`/api/store/reservations/${row.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refundMode,
            refundMethod,
            refundOrigin: "STORE",
          }),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || `Error ${res.status}`);
        }

        await load();
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "No se pudo cancelar la reserva");
      } finally {
        setCancelingId("");
      }
    },
    [askRefundMethod, load]
  );

  return (
    <div style={shellStyle}>
      <StoreHero
        title="Calendario"
        description="Vista mensual de reservas con acceso directo a edición, apertura y formalización."
        titleColor="#fff"
        eyebrowColor="#7dd3fc"
        background="radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%), radial-gradient(circle at right bottom, rgba(15, 118, 110, 0.14), transparent 24%), linear-gradient(135deg, #0f172a 0%, #0f766e 55%, #082f49 100%)"
        actions={
          <>
            <a href="/store" style={{ ...actionStyle, background: "rgba(255,255,255,0.92)" }}>Volver a tienda</a>
            <button onClick={load} disabled={loading} style={{ ...actionStyle, border: "1px solid rgba(255,255,255,0.24)", background: "#0f172a", color: "#fff" }}>{loading ? "Cargando..." : "Refrescar"}</button>
          </>
        }
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPillStyle}>Mes: {monthTitle(monthDate)}</span>
          <span style={heroPillStyle}>Reservas: {monthReservations}</span>
          <span style={heroPillStyle}>Pendientes: {monthPending}</span>
          <span style={heroPillStyle}>Día seleccionado: {selectedDay || "Ninguno"}</span>
        </div>
      </StoreHero>

      <StoreMetricGrid>
        <StoreMetricCard label="Reservas del mes" value={monthReservations} />
        <StoreMetricCard label="Pendientes" value={monthPending} />
        <StoreMetricCard label="Operativas del día" value={selectedGroups.ops.length} />
        <StoreMetricCard label="Históricas del día" value={selectedGroups.hist.length} />
      </StoreMetricGrid>

      {err ? <div style={{ padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 700 }}>{err}</div> : null}

      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setMonthDate((d) => addMonths(d, -1))} style={actionStyle}>Anterior</button>
          <div style={{ fontWeight: 900, fontSize: 22, textTransform: "capitalize" }}>{monthTitle(monthDate)}</div>
          <button onClick={() => setMonthDate((d) => addMonths(d, 1))} style={actionStyle}>Siguiente</button>
        </div>
        <button onClick={() => setMonthDate(startOfMonth(new Date()))} style={{ ...actionStyle, border: "1px solid #0f172a", background: "#0f172a", color: "#fff" }}>
          Ir a hoy
        </button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 430px)", gap: 16, alignItems: "start" }}>
        <div style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", padding: 12, gap: 8, borderBottom: "1px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            {weekDays.map((d) => (
              <div key={d} style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8, padding: 12 }}>
            {cells.map((d) => {
              const key = yyyyMmDdLocal(d);
              const inMonth = d.getMonth() === monthDate.getMonth();
              const bucket = data?.days?.[key] ?? null;
              const count = bucket?.count ?? 0;
              const rows = bucket?.rows ?? [];
              const isToday = key === yyyyMmDdLocal(new Date());
              const isSelected = key === selectedDay;
              const pendingCount = rows.filter((r) => !isHistoricalRow(r) && isPendingFormalization(r)).length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  style={{
                    minHeight: 132,
                    padding: 10,
                    borderRadius: 18,
                    border: isSelected ? "2px solid #0f172a" : "1px solid #e2e8f0",
                    background: isSelected ? "linear-gradient(180deg, #f8fafc 0%, #ecfeff 100%)" : isToday ? "#f8fafc" : "#fff",
                    opacity: inMonth ? 1 : 0.45,
                    cursor: "pointer",
                    display: "grid",
                    alignContent: "start",
                    gap: 8,
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>
                      {d.getDate()}
                      {isToday ? <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#0f172a", color: "#fff" }}>hoy</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {pendingCount > 0 ? <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: "#fef3c7", border: "1px solid #fcd34d", fontWeight: 900 }}>P {pendingCount}</span> : null}
                      {count > 0 ? <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, background: "#e2e8f0", fontWeight: 900 }}>{count}</span> : null}
                    </div>
                  </div>

                  {count === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Sin reservas</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {rows.slice(0, 3).map((r) => (
                        <div key={r.id} style={{ fontSize: 12, color: "#334155", lineHeight: 1.25 }}>
                          <strong>{hhmm(r.scheduledTime) || "Sin hora"}</strong>
                          <div>{r.customerName || "Sin nombre"}</div>
                        </div>
                      ))}
                      {count > 3 ? <div style={{ fontSize: 12, color: "#64748b" }}>+{count - 3} más</div> : null}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <aside style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>Detalle del día</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedDay ? (
                <a href={`/store/create?date=${selectedDay}&mode=${mode}`} style={{ ...actionStyle, border: "1px solid #0f172a", background: "#0f172a", color: "#fff" }}>
                  Crear reserva
                </a>
              ) : null}
              {selectedDay ? <button onClick={() => setSelectedDay("")} style={actionStyle}>Cerrar</button> : null}
            </div>
          </div>

          {!selectedDay ? (
            <div style={{ padding: 16, color: "#64748b" }}>Selecciona un día del calendario para ver reservas y accesos rápidos.</div>
          ) : (
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{selectedDay}</div>
                <div style={{ color: "#64748b", textTransform: "capitalize" }}>{weekdayMadrid(selectedDay)}</div>
              </div>

              <div style={{ fontSize: 13, color: "#475569" }}>
                Reservas: <b>{selectedBucket?.count ?? 0}</b>
              </div>

              {!selectedBucket || selectedBucket.count === 0 ? (
                <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", color: "#64748b" }}>No hay reservas este día.</div>
              ) : (
                <>
                  <div style={{ padding: 12, borderRadius: 16, border: "1px solid #fcd34d", background: "#fffbeb", display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Pendientes de formalizar ({selectedGroups.pending.length})</div>
                    {selectedGroups.pending.length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>Sin pendientes.</div> : selectedGroups.pending.map((r) => <RowCard key={r.id} r={r} onCancel={cancelReservation} canceling={cancelingId === r.id} />)}
                  </div>

                  <div style={{ padding: 12, borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Operativa ({selectedGroups.ops.length})</div>
                    {selectedGroups.ops.length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>Sin reservas operativas.</div> : selectedGroups.ops.map((r) => <RowCard key={r.id} r={r} onCancel={cancelReservation} canceling={cancelingId === r.id} />)}
                  </div>

                  <div style={{ padding: 12, borderRadius: 16, border: "1px solid #e2e8f0", background: "#f8fafc", display: "grid", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>Histórico ({selectedGroups.hist.length})</div>
                    {selectedGroups.hist.length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>Sin reservas históricas.</div> : selectedGroups.hist.map((r) => <RowCard key={r.id} r={r} onCancel={cancelReservation} canceling={cancelingId === r.id} />)}
                  </div>
                </>
              )}

              <div style={{ fontSize: 12, color: "#64748b" }}>
                Este panel permite reagendar desde `Editar` y cancelar con o sin devolución desde cualquier reserva no histórica.
              </div>
            </div>
          )}
        </aside>
      </section>

      {loading ? <div style={{ color: "#64748b" }}>Cargando mes...</div> : null}
    </div>
  );
}
