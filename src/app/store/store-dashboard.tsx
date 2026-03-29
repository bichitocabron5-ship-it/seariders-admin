// src/app/store/store-dashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { LeftReservationCard } from "./dashboard/components/LeftReservationCard";
import { ReadyReservationCard } from "./dashboard/components/ReadyReservationCard";
import type {
  CashClosureSummary,
  CashSummary,
  CommissionSummary,
  ExtraUiMap,
  PayLine,
  PayMethod,
  ReservationRow,
  Service,
  TotalsSummary,
} from "./dashboard/types";
import {
  centsFromEuros,
  ensureOkResponse,
  errorMessage,
  euros,
  todayLocalYMD,
} from "./dashboard/utils";

const RIGHT_STATUSES = new Set(["READY_FOR_PLATFORM", "IN_SEA"]);
const LEFT_STATUSES_EXCLUDE = new Set(["COMPLETED", "CANCELED"]);

export default function StoreDashboard() {
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethodByReservation, setPaymentMethodByReservation] = useState<Record<string, PayMethod>>({});
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null);
  const [cashClosureSummary, setCashClosureSummary] = useState<CashClosureSummary | null>(null);
  const [openOpsId, setOpenOpsId] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingErr, setPendingErr] = useState<string | null>(null);
  const [servicesExtra, setServicesExtra] = useState<Service[]>([]);
  const [servicePayLinesByReservation, setServicePayLinesByReservation] = useState<Record<string, PayLine[]>>({});
  const [extraUi, setExtraUi] = useState<ExtraUiMap>({});
  const [nowMs, setNowMs] = useState(() => Date.now());

  const btnSecondary: CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#111",
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
  };

  const handleActionError = useCallback((context: string, e: unknown, fallback: string) => {
    const message = errorMessage(e, fallback);
    console.error(`[store/dashboard] ${context} failed`, e);
    setError(message);
  }, []);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    setPendingErr(null);
    try {
      const res = await fetch("/api/store/reservations/pending-today", { cache: "no-store" });
      await ensureOkResponse(res, "No se pudieron cargar los pendientes");
      const j = await res.json();
      setPendingCount(Number(j.count || 0));
    } catch (e: unknown) {
      setPendingErr(errorMessage(e, "Error cargando pendientes"));
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
    const t = setInterval(loadPending, 30_000);
    return () => clearInterval(t);
  }, [loadPending]);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function getServicePayLines(reservationId: string): PayLine[] {
    return servicePayLinesByReservation[reservationId] ?? [{ amountEuros: "", method: "CASH" }];
  }

  function addServicePayLine(reservationId: string) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: [...(prev[reservationId] ?? [{ amountEuros: "", method: "CASH" }]), { amountEuros: "", method: "CARD" }],
    }));
  }

  function removeServicePayLine(reservationId: string, idx: number) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: (prev[reservationId] ?? [{ amountEuros: "", method: "CASH" }]).filter((_, i) => i !== idx),
    }));
  }

  function updateServicePayLine(reservationId: string, idx: number, patch: Partial<PayLine>) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: (prev[reservationId] ?? [{ amountEuros: "", method: "CASH" }]).map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }

  const isCashClosed = Boolean(cashClosureSummary?.isClosed);

  const CashClosedBanner = () =>
    isCashClosed ? (
      <div style={{ marginTop: 12, padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12 }}>
        <b>Caja cerrada.</b> No se pueden registrar cobros en este turno. Si hay que reabrir, pídeselo a Admin.
      </div>
    ) : null;

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/pos/catalog?origin=STORE");
        await ensureOkResponse(r, "No se pudo cargar el catálogo");
        const data = await r.json();
        setServicesExtra(data.servicesExtra ?? []);
      } catch (e: unknown) {
        handleActionError("load catalog", e, "No se pudo cargar el catálogo");
      }
    })();
  }, [handleActionError]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [r, s, c, sum] = await Promise.all([
        fetch("/api/store/reservations/today", { cache: "no-store" }),
        fetch("/api/store/payments/today-summary", { cache: "no-store" }),
        fetch("/api/store/commissions/today-summary", { cache: "no-store" }),
        fetch("/api/store/cash-closures/summary?origin=STORE", { cache: "no-store" }),
      ]);

      await ensureOkResponse(r, "No se pudieron cargar las reservas");
      const data = await r.json();
      setRows(data.rows ?? []);
      console.log(data.rows)

      if (s.ok) setCashSummary(await s.json());
      else setCashSummary(null);

      if (c.ok) setCommissionSummary(await c.json());
      else setCommissionSummary(null);

      if (sum.ok) setCashClosureSummary((await sum.json()) as CashClosureSummary);
      else setCashClosureSummary(null);
    } catch (e: unknown) {
      handleActionError("load dashboard", e, "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chargeServiceSplit(reservationId: string, maxServiceCents: number) {
    setError(null);

    const lines = getServicePayLines(reservationId)
      .map((l) => ({
        ...l,
        amountCents: centsFromEuros(l.amountEuros),
      }))
      .filter((l) => l.amountCents > 0);

    if (!reservationId) {
      setError("Falta reservationId");
      return;
    }
    if (lines.length === 0) {
      setError("Añade al menos un importe");
      return;
    }

    const sumCents = lines.reduce((acc, l) => acc + l.amountCents, 0);
    if (sumCents > maxServiceCents) {
      setError(`La suma (${euros(sumCents)}) supera el pendiente del servicio (${euros(maxServiceCents)}).`);
      return;
    }

    try {
      for (const l of lines) {
        const r = await fetch("/api/store/payments/create", {
          method: "POST",
          headers: { "Content-Typ": "application/json" },
          body: JSON.stringify({
            reservationId,
            amountCents: l.amountCents,
            method: l.method,
            origin: "STORE",
            isDeposit: false,
            direction: "IN",
          }),
        });

        await ensureOkResponse(r, "No se pudo registrar el cobro");
      }

      setServicePayLinesByReservation((prev) => ({
        ...prev,
        [reservationId]: [{ amountEuros: "", method: "CASH" }],
      }));

      await load();
    } catch (e: unknown) {
      handleActionError("charge service split", e, "Error cobrando servicio");
    }
  }

  async function createPayment(
    input: {
      reservationId: string;
      amountCents: number;
      method: PayMethod;
      origin: "STORE" | "BOOTH" | "BAR" | "WEB";
      isDeposit: boolean;
      direction?: "IN" | "OUT";
    },
    opts?: { reload?: boolean },
  ) {
    const direction = input.direction ?? "IN";

    const r = await fetch("/api/store/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, direction }),
    });

    await ensureOkResponse(r, "No se pudo registrar el cobro");

    if (opts?.reload !== false) {
      await load();
    }
  }

  async function applyPlatformExtras(reservationId: string) {
    setError(null);
    try {
      const r = await fetch(`/api/store/reservations/${reservationId}/apply-platform-extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await ensureOkResponse(r, "No se pudieron aplicar los extras de plataforma");
      await load();
    } catch (e: unknown) {
      handleActionError("apply platform extras", e, "No se pudieron aplicar los extras");
    }
  }

  async function passToReadyForPlatform(reservationId: string) {
    setError(null);
    try {
      const r = await fetch(`/api/store/reservations/${reservationId}/ready-for-platform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await ensureOkResponse(r, "No se pudo pasar a Ready for platform");
      await load();
    } catch (e: unknown) {
      handleActionError("pass to ready", e, "No se pudo pasar a Ready for platform");
    }
  }

  async function completeReturn(reservationId: string) {
    setError(null);
    try {
      const r = await fetch(`/api/store/reservations/${reservationId}/complete-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      await ensureOkResponse(r, "No se pudo cerrar la devolución");
      await load();
    } catch (e: unknown) {
      handleActionError("complete return", e, "No se pudo cerrar la devolución");
    }
  }

  async function cancelReservation(reservationId: string, opts: { refund: boolean; method: PayMethod }) {
    setError(null);
    try {
      const r = await fetch(`/api/store/reservations/${reservationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundMode: opts.refund ? "FULL" : "NONE",
          refundMethod: opts.method,
          refundOrigin: "STORE",
        }),
      });

      await ensureOkResponse(r, "No se pudo cancelar la reserva");
      await load();
    } catch (e: unknown) {
      handleActionError("cancel reservation", e, "No se pudo cancelar la reserva");
    }
  }

  async function addExtraToReservation(reservationId: string) {
    setError(null);
    try {
      const st = getExtraState(reservationId, servicesExtra, extraUi);

      if (!st.extraServiceId) {
        setError("Selecciona un extra");
        return;
      }

      const r = await fetch("/api/store/reservations/add-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          extraServiceId: st.extraServiceId,
          quantity: st.qty,
          pax: 1,
        }),
      });

      await ensureOkResponse(r, "No se pudo añadir el extra");
      await load();
    } catch (e: unknown) {
      handleActionError("add extra", e, "No se pudo añadir el extra");
    }
  }

  function getExtraState(reservationId: string, services: Service[], state: ExtraUiMap) {
    const cur = state[reservationId];
    if (cur) return cur;

    return {
      extraServiceId: services[0]?.id ?? "",
      qty: 1,
    };
  }

  const rowsSorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTotal = Number(a.soldTotalCents ?? a.totalPriceCents ?? 0) + Number(a.depositCents ?? 0);
        const bTotal = Number(b.soldTotalCents ?? b.totalPriceCents ?? 0) + Number(b.depositCents ?? 0);
        const aPaid = Number(a.paidCents ?? 0);
        const bPaid = Number(b.paidCents ?? 0);
        const aPending = Math.max(0, aTotal - aPaid);
        const bPending = Math.max(0, bTotal - bPaid);
        const aIsPending = aPending > 0 ? 0 : 1;
        const bIsPending = bPending > 0 ? 0 : 1;
        if (aIsPending !== bIsPending) return aIsPending - bIsPending;
        const aTime = a.scheduledTime ? new Date(a.scheduledTime).getTime() : new Date(a.activityDate).getTime();
        const bTime = b.scheduledTime ? new Date(b.scheduledTime).getTime() : new Date(b.activityDate).getTime();
        return aTime - bTime;
      }),
    [rows],
  );

  const rowsLeft = useMemo(
    () =>
      rowsSorted.filter(
        (r) =>
          !RIGHT_STATUSES.has(r.status) &&
          !LEFT_STATUSES_EXCLUDE.has(r.status) &&
          !r.arrivalAt
      ),
    [rowsSorted],
  );
  const rowsRight = useMemo(() => rowsSorted.filter((r) => RIGHT_STATUSES.has(r.status)), [rowsSorted]);
  const rowsReturned = useMemo(
    () =>
      rowsSorted
        .filter((r) => r.status === "WAITING" && !!r.arrivalAt)
        .sort(
          (a, b) =>
            new Date(b.arrivalAt ?? 0).getTime() -
            new Date(a.arrivalAt ?? 0).getTime()
        ),
    [rowsSorted],
  );

  const retainedIncidentCount = useMemo(
    () => rows.filter((r) => r.depositHeld === true).length,
    [rows],
  );

  const returnedWithIncidentCount = useMemo(
    () => rowsReturned.filter((r) => r.depositHeld === true).length,
    [rowsReturned],
  );
  const platformExtrasPendingCount = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.platformExtrasPendingCount ?? 0), 0),
    [rows],
  );

  const cashClosureHref = cashClosureSummary?.isClosed ? "/admin/cash-closures" : "/store/cash-closures";
  const cashClosureLabel = cashClosureSummary?.isClosed ? "Caja cerrada" : "Cerrar caja";
  
  const totals = useMemo(
    () =>
      rows.reduce<TotalsSummary>(
        (acc, r) => {
          const totalToCharge = Number(r.soldTotalCents ?? r.totalPriceCents ?? 0) + Number(r.depositCents ?? 0);
          const paid = Number(r.paidCents ?? 0);
          const pending = Math.max(0, totalToCharge - paid);
          acc.dayCount += 1;
          acc.dayTotalCents += totalToCharge;
          if (pending > 0) {
            acc.pendingCount += 1;
            acc.pendingCents += pending;
          } else {
            acc.paidCount += 1;
            acc.paidCents += paid;
          }
          return acc;
        },
        {
          dayCount: 0,
          dayTotalCents: 0,
          pendingCount: 0,
          pendingCents: 0,
          paidCount: 0,
          paidCents: 0,
        },
      ),
    [rows],
  );

  return (
    <div style={{ padding: 20, fontFamily: "system-ui", maxWidth: 1760, margin: "0 auto", display: "grid", gap: 18 }}>
      <section style={{ border: "1px solid #d8e0ea", background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)", borderRadius: 26, padding: 22, display: "grid", gap: 16, boxShadow: "0 18px 40px rgba(20, 32, 51, 0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 900, color: "#58708f" }}>Store</div>
            <div style={{ margin: 0, fontSize: 34, lineHeight: 1, fontWeight: 950, color: "#142033" }}>Tienda</div>
            <div style={{ fontSize: 14, color: "#51627b", maxWidth: 720 }}>Operativa del día, cobros, pendientes y seguimiento de plataforma en una sola vista.</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href={cashClosureHref}
              style={{
                ...btnSecondary,
                borderColor: cashClosureSummary?.isClosed ? "#dbe4ea" : "#111",
                background: cashClosureSummary?.isClosed ? "#fff" : "#111",
                color: cashClosureSummary?.isClosed ? "#111" : "#fff",
              }}
            >
              {cashClosureLabel}
            </a>
            <a href="/store/history" style={btnSecondary}>Histórico</a>
            <a href="/store/booth" style={btnSecondary}>Carpa</a>
            <a href="/operations" style={btnSecondary}>Operaciones</a>
            <a href="/store/gifts" style={btnSecondary}>Regalos</a>
            <a href="/store/bonos" style={btnSecondary}>Bonos</a>
            <a href="/store/calendar" style={btnSecondary}>Calendario</a>
            <a href="/store/create" style={{ padding: "10px 12px", border: "1px solid #111", borderRadius: 12, fontWeight: 900, background: "#111", color: "#fff", textDecoration: "none" }}>
              + Crear reserva
            </a>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={summaryCard}><div style={summaryLabel}>Pendientes de formalizar</div><div style={summaryValue}>{pendingLoading ? "..." : pendingCount}</div><div style={{ marginTop: 4, fontSize: 12, color: pendingErr ? "#b91c1c" : "#6b7280" }}>{pendingErr ?? "Se actualiza automáticamente."}</div></div>
          <div style={summaryCard}><div style={summaryLabel}>Reservas del día</div><div style={summaryValue}>{totals.dayCount}</div><div style={summaryMeta}>{euros(totals.dayTotalCents)} previstos</div></div>
          <div style={summaryCard}><div style={summaryLabel}>Pendiente de cobro</div><div style={summaryValue}>{totals.pendingCount}</div><div style={summaryMeta}>{euros(totals.pendingCents)}</div></div>
          <div style={summaryCard}><div style={summaryLabel}>Cobrado</div><div style={summaryValue}>{totals.paidCount}</div><div style={summaryMeta}>{euros(totals.paidCents)}</div></div>
          <div style={summaryCard}>
            <div style={summaryLabel}>Incidencias con fianza retenida</div>
            <div style={summaryValue}>{retainedIncidentCount}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: retainedIncidentCount > 0 ? "#b91c1c" : "#6b7280" }}>
              {retainedIncidentCount > 0 ? "Revisar antes de devolver fianza." : "Sin incidencias bloqueantes."}
            </div>
          </div>
          <div style={summaryCard}>
            <div style={summaryLabel}>Extras plataforma</div>
            <div style={summaryValue}>{platformExtrasPendingCount}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: platformExtrasPendingCount > 0 ? "#0f766e" : "#6b7280" }}>
              {platformExtrasPendingCount > 0 ? "Pendientes de aplicar o cobrar en tienda." : "Sin extras pendientes."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "#51627b" }}>Consulta rápida de pendientes y acceso directo al calendario operativo.</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={loadPending} style={btnSecondary} disabled={pendingLoading}>{pendingLoading ? "Actualizando..." : "Refrescar"}</button>
            <a
              href={`/store/calendar?day=${todayLocalYMD()}`}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111",
                background: pendingCount > 0 ? "#111" : "#fff",
                color: pendingCount > 0 ? "#fff" : "#111",
                fontWeight: 900,
                textDecoration: "none",
                opacity: pendingLoading ? 0.8 : 1,
              }}
            >
              Ver en calendario
            </a>
          </div>
        </div>
      </section>

      {error ? <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fee2e2", borderRadius: 14 }}>{error}</div> : null}
      <CashClosedBanner />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {cashSummary ? (
          <div style={panelCard}>
            <div style={panelTitle}>Caja de hoy</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div><div style={smallLabel}>Cobrado total</div><div style={{ fontSize: 20, fontWeight: 900 }}>{euros(cashSummary.totalCents)}</div></div>
              <div><div style={smallLabel}>Servicio</div><div style={{ fontWeight: 800 }}>{euros(cashSummary.serviceCents)}</div></div>
              <div><div style={smallLabel}>Fianzas</div><div style={{ fontWeight: 800 }}>{euros(cashSummary.depositCents)}</div></div>
              <div><div style={smallLabel}>Pagos</div><div style={{ fontWeight: 800 }}>{cashSummary.count}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <div style={smallLabel}>Por método</div>
                {Object.entries(cashSummary.byMethod).map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div>{k}</div><div>{euros(v.netCents)}</div></div>)}
              </div>
              <div>
                <div style={smallLabel}>Por origen</div>
                {Object.entries(cashSummary.byOrigin).map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div>{k}</div><div>{euros(v.netCents)}</div></div>)}
              </div>
            </div>
          </div>
        ) : null}

        <div style={panelCard}>
          <div style={panelTitle}>Comisiones</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Estado: {commissionSummary ? "Cargado" : "Sin datos"}</div>
          {commissionSummary ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div>Total comisiones: <strong>{euros(commissionSummary.totalCommissionCents)}</strong></div>
              {Object.entries(commissionSummary.byChannel).map(([channel, cents]) => <div key={channel} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{channel}</span><strong>{euros(Number(cents))}</strong></div>)}
            </div>
          ) : (
            <div style={{ opacity: 0.6 }}>No hay datos de comisión o falló la carga.</div>
          )}
        </div>

        <div style={panelCard}>
          <div style={panelTitle}>Estado operativo</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={smallLabel}>Cierre de caja</span>
              <strong>{cashClosureSummary?.isClosed ? "Cerrado" : "Abierto"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={smallLabel}>Devueltas con incidencia</span>
              <strong>{returnedWithIncidentCount}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={smallLabel}>Ready / En mar</span>
              <strong>{rowsRight.length}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span style={smallLabel}>Extras de plataforma</span>
              <strong>{platformExtrasPendingCount}</strong>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {cashClosureSummary?.isClosed
                ? `Ultimo cierre: ${cashClosureSummary.closure?.closedAt ? new Date(cashClosureSummary.closure.closedAt).toLocaleString() : "sin fecha"}`
                : "Pendiente de cierre en este turno."}
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ ...columnCard, minWidth: 0 }}>
          <h2 style={{ marginTop: 0, marginBottom: 12 }}>Pendientes tienda</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
            <div style={miniStat}><div style={smallLabel}>Pendientes</div><div style={{ fontSize: 18, fontWeight: 900 }}>{totals.pendingCount}</div><div style={{ fontWeight: 800 }}>{euros(totals.pendingCents)}</div></div>
            <div style={miniStat}><div style={smallLabel}>Pagadas</div><div style={{ fontSize: 18, fontWeight: 900 }}>{totals.paidCount}</div><div style={{ fontWeight: 800 }}>{euros(totals.paidCents)}</div></div>
            <div style={miniStat}><div style={smallLabel}>Total del día</div><div style={{ fontSize: 18, fontWeight: 900 }}>{totals.dayCount}</div><div style={{ fontWeight: 800 }}>{euros(totals.dayTotalCents)}</div></div>
          </div>

          {rowsLeft.length === 0 ? (
            <p>No hay reservas hoy.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rowsLeft.map((r) => {
                const method = (paymentMethodByReservation[r.id] ?? "CASH") as PayMethod;
                return (
                  <LeftReservationCard
                    key={r.id}
                    r={r}
                    isCashClosed={isCashClosed}
                    method={method}
                    setMethod={(m) => setPaymentMethodByReservation((prev) => ({ ...prev, [r.id]: m }))}
                    passToReadyForPlatform={passToReadyForPlatform}
                    createPayment={createPayment}
                    load={load}
                    setError={setError}
                    servicesExtra={servicesExtra}
                    extraUi={extraUi}
                    setExtraUi={setExtraUi}
                    getExtraState={getExtraState}
                    addExtraToReservation={addExtraToReservation}
                    servicePayLines={getServicePayLines(r.id)}
                    addServicePayLine={() => addServicePayLine(r.id)}
                    removeServicePayLine={(idx) => removeServicePayLine(r.id, idx)}
                    updateServicePayLine={(idx, patch) => updateServicePayLine(r.id, idx, patch)}
                    chargeServiceSplit={chargeServiceSplit}
                    btnSecondary={btnSecondary}
                    nowMs={nowMs}
                    cancelReservation={cancelReservation}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div style={{ ...columnCard, minWidth: 0 }}>
          <h2 style={{ marginTop: 0 }}>
            Ready for platform / En mar <span style={{ opacity: 0.6, fontWeight: 700 }}>({rowsRight.length})</span>
          </h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: -6, marginBottom: 10 }}>(Incluye IN_SEA para seguimiento)</div>
          {rowsRight.map((r) => {
            const method = (paymentMethodByReservation[r.id] ?? "CASH") as PayMethod;
            return (
              <ReadyReservationCard
                key={r.id}
                r={r}
                isCashClosed={isCashClosed}
                isOpen={openOpsId === r.id}
                onToggleOpen={() => setOpenOpsId((prev) => (prev === r.id ? "" : r.id))}
                method={method}
                setMethod={(m) => setPaymentMethodByReservation((prev) => ({ ...prev, [r.id]: m }))}
                applyPlatformExtras={applyPlatformExtras}
                createPayment={createPayment}
                load={load}
                setError={setError}
                servicesExtra={servicesExtra}
                extraUi={extraUi}
                setExtraUi={setExtraUi}
                getExtraState={getExtraState}
                addExtraToReservation={addExtraToReservation}
                servicePayLines={getServicePayLines(r.id)}
                addServicePayLine={() => addServicePayLine(r.id)}
                removeServicePayLine={(idx) => removeServicePayLine(r.id, idx)}
                updateServicePayLine={(idx, patch) => updateServicePayLine(r.id, idx, patch)}
                chargeServiceSplit={chargeServiceSplit}
                btnSecondary={btnSecondary}
                completeReturn={completeReturn}
                cancelReservation={cancelReservation}
              />
            );
          })}
        </div>

        <div style={{ ...columnCard, minWidth: 0 }}>
          <h2 style={{ marginTop: 0 }}>
            Devueltas / Cierre <span style={{ opacity: 0.6 }}>({rowsReturned.length})</span>
          </h2>

        <div style={{ fontSize: 12, opacity: 0.7, marginTop: -6, marginBottom: 10 }}>
          {returnedWithIncidentCount > 0
            ? `${returnedWithIncidentCount} con incidencia o fianza retenida`
            : "Pendientes de devolver/retener fianza y cerrar operativa"}
        </div>

          {rowsReturned.length === 0 ? (
            <p>No hay reservas devueltas.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {rowsReturned.map((r) => {
                const method = (paymentMethodByReservation[r.id] ?? "CASH") as PayMethod;

                return (
                  <ReadyReservationCard
                    key={r.id}
                    r={r}
                    isCashClosed={isCashClosed}
                    isOpen={openOpsId === r.id}
                    onToggleOpen={() => setOpenOpsId((prev) => (prev === r.id ? "" : r.id))}
                    method={method}
                    setMethod={(m) => setPaymentMethodByReservation((prev) => ({ ...prev, [r.id]: m }))}
                    applyPlatformExtras={applyPlatformExtras}
                    createPayment={createPayment}
                    load={load}
                    setError={setError}
                    servicesExtra={servicesExtra}
                    extraUi={extraUi}
                    setExtraUi={setExtraUi}
                    getExtraState={getExtraState}
                    addExtraToReservation={addExtraToReservation}
                    servicePayLines={getServicePayLines(r.id)}
                    addServicePayLine={() => addServicePayLine(r.id)}
                    removeServicePayLine={(idx) => removeServicePayLine(r.id, idx)}
                    updateServicePayLine={(idx, patch) => updateServicePayLine(r.id, idx, patch)}
                    chargeServiceSplit={chargeServiceSplit}
                    btnSecondary={btnSecondary}
                    showReturnedBanner
                    showReturnedActions
                    completeReturn={completeReturn}
                    cancelReservation={cancelReservation}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const summaryCard: CSSProperties = {
  border: "1px solid #dde4ee",
  borderRadius: 18,
  padding: 14,
  background: "#fff",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  fontWeight: 800,
};

const summaryValue: CSSProperties = {
  marginTop: 6,
  fontSize: 28,
  fontWeight: 950,
};

const summaryMeta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
};

const panelCard: CSSProperties = {
  padding: 16,
  border: "1px solid #dde4ee",
  borderRadius: 20,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const panelTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
};

const columnCard: CSSProperties = {
  padding: 18,
  border: "1px solid #dde4ee",
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 10px 28px rgba(20, 32, 51, 0.04)",
};

const miniStat: CSSProperties = {
  padding: 10,
  border: "1px solid #eee",
  borderRadius: 10,
};

const smallLabel: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};
