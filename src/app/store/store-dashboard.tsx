// src/app/store/store-dashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { StoreHero, StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import { StoreOpsSummarySection } from "./dashboard/components/StoreOpsSummarySection";
import { StorePendingColumnSection } from "./dashboard/components/StorePendingColumnSection";
import { StoreReservationColumnSection } from "./dashboard/components/StoreReservationColumnSection";
import { LeftReservationCard } from "./dashboard/components/LeftReservationCard";
import { ReadyReservationCard } from "./dashboard/components/ReadyReservationCard";
import type {
  CashClosureSummary,
  CashSummary,
  CommissionSummary,
  CompleteReturnInput,
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
    ...storeStyles.secondaryButton,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "none",
  };

  const btnPrimary: CSSProperties = {
    ...storeStyles.primaryButton,
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
    return servicePayLinesByReservation[reservationId] ?? [{ amountEuros: "", method: "CASH", receivedEuros: "" }];
  }

  function addServicePayLine(reservationId: string) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: [...(prev[reservationId] ?? [{ amountEuros: "", method: "CASH", receivedEuros: "" }]), { amountEuros: "", method: "CARD", receivedEuros: "" }],
    }));
  }

  function removeServicePayLine(reservationId: string, idx: number) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: (prev[reservationId] ?? [{ amountEuros: "", method: "CASH", receivedEuros: "" }]).filter((_, i) => i !== idx),
    }));
  }

  function updateServicePayLine(reservationId: string, idx: number, patch: Partial<PayLine>) {
    setServicePayLinesByReservation((prev) => ({
      ...prev,
      [reservationId]: (prev[reservationId] ?? [{ amountEuros: "", method: "CASH", receivedEuros: "" }]).map((l, i) => (i === idx ? { ...l, ...patch } : l)),
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
          headers: { "Content-Type": "application/json" },
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
        [reservationId]: [{ amountEuros: "", method: "CASH", receivedEuros: "" }],
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

  async function completeReturn(input: CompleteReturnInput) {
    setError(null);
    try {
      const r = await fetch(`/api/store/reservations/${input.reservationId}/complete-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementMode: input.settlementMode ?? "AUTO",
          refundAmountCents: input.refundAmountCents,
          refundMethod: input.refundMethod,
          retainReason: input.retainReason,
        }),
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
    <div style={{ ...storeStyles.shell, width: "min(1760px, 100%)", padding: 20 }}>
      <StoreHero
        title="Tienda"
        description="Operativa del día, cobros, pendientes y seguimiento de plataforma en una sola vista."
        eyebrowColor="#58708f"
        background="linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)"
        actions={
          <>
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
            <a href="/store/create" style={btnPrimary}>
              + Crear reserva
            </a>
          </>
        }
      >
        <StoreMetricGrid>
          <StoreMetricCard
            label="Pendientes de formalizar"
            value={pendingLoading ? "..." : pendingCount}
            description={pendingErr ?? "Se actualiza automáticamente."}
          />
          <StoreMetricCard label="Reservas del día" value={totals.dayCount} description={`${euros(totals.dayTotalCents)} previstos`} />
          <StoreMetricCard label="Pendiente de cobro" value={totals.pendingCount} description={euros(totals.pendingCents)} />
          <StoreMetricCard label="Cobrado" value={totals.paidCount} description={euros(totals.paidCents)} />
          <StoreMetricCard
            label="Incidencias con fianza retenida"
            value={retainedIncidentCount}
            description={retainedIncidentCount > 0 ? "Revisar antes de devolver fianza." : "Sin incidencias bloqueantes."}
          />
          <StoreMetricCard
            label="Extras plataforma"
            value={platformExtrasPendingCount}
            description={platformExtrasPendingCount > 0 ? "Pendientes de aplicar o cobrar en tienda." : "Sin extras pendientes."}
          />
        </StoreMetricGrid>

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
      </StoreHero>

      {error ? <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fee2e2", borderRadius: 14 }}>{error}</div> : null}
      <CashClosedBanner />

      <StoreOpsSummarySection
        cashSummary={cashSummary}
        commissionSummary={commissionSummary}
        cashClosureSummary={cashClosureSummary}
        returnedWithIncidentCount={returnedWithIncidentCount}
        rowsRightCount={rowsRight.length}
        platformExtrasPendingCount={platformExtrasPendingCount}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start" }}>
        <div style={{ ...columnCard, minWidth: 0 }}>
          <StorePendingColumnSection totals={totals}>
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
          </StorePendingColumnSection>
        </div>

        <div style={{ ...columnCard, minWidth: 0 }}>
          <StoreReservationColumnSection
            title="Ready for platform / En mar"
            count={rowsRight.length}
            subtitle="Incluye IN_SEA para seguimiento"
            emptyMessage={<p>No hay reservas en ready o en mar.</p>}
          >
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
          </StoreReservationColumnSection>
        </div>

        <div style={{ ...columnCard, minWidth: 0 }}>
          <StoreReservationColumnSection
            title="Devueltas / Cierre"
            count={rowsReturned.length}
            subtitle={
              returnedWithIncidentCount > 0
                ? `${returnedWithIncidentCount} con incidencia o fianza retenida`
                : "Pendientes de devolver/retener fianza y cerrar operativa"
            }
            emptyMessage={<p>No hay reservas devueltas.</p>}
          >
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
          </StoreReservationColumnSection>
        </div>
      </section>
    </div>
  );
}

const columnCard: CSSProperties = {
  padding: 18,
  border: "1px solid #dde4ee",
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 10px 28px rgba(20, 32, 51, 0.04)",
};

