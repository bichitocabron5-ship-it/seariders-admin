// src/app/store/store-dashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ActionButton, AlertBanner, StatusBadge } from "@/components/seariders-ui";
import { StoreHero, StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { StoreOpsSummarySection } from "./dashboard/components/StoreOpsSummarySection";
import { StorePendingColumnSection } from "./dashboard/components/StorePendingColumnSection";
import { StoreReservationColumnSection } from "./dashboard/components/StoreReservationColumnSection";
import { LeftReservationCard } from "./dashboard/components/LeftReservationCard";
import { ReadyReservationCard } from "./dashboard/components/ReadyReservationCard";
import {
  resolveCancelRefundSubmit,
  type CancelRefundMode,
} from "./dashboard/cancel-refund";
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

type CancelPreview = {
  canCommit: boolean;
  blockers: string[];
  warnings: string[];
  oldTotalCents: number;
  newTotalCents: number;
  oldDepositCents?: number;
  newDepositCents?: number;
  paidServiceCents: number;
  paidDepositCents: number;
  pendingServiceCents: number;
  pendingDepositCents?: number;
  overpaidServiceCents: number;
  overpaidDepositCents?: number;
  refundableServiceCents?: number;
  refundableDepositCents?: number;
  serviceRefundNowCents?: number;
  depositRefundNowCents?: number;
  pendingServiceRefundCents?: number;
  pendingDepositRefundCents?: number;
  depositRefundHeldCents?: number;
  depositRefundBlockedReason?: "DEPOSIT_HELD" | null;
  refundNowCents: number;
  pendingRefundCents: number;
  requiredActions: string[];
};

type CancelDraft = {
  reservation: ReservationRow;
  method: PayMethod;
  refundMode: CancelRefundMode;
  reason: string;
};

async function responseErrorMessage(res: Response, fallbackMessage: string) {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return fallbackMessage;
  try {
    const payload = JSON.parse(text) as { error?: unknown };
    return typeof payload.error === "string" ? payload.error : text.trim();
  } catch {
    return text.trim();
  }
}

function defaultCancelRefundMode(reservation: ReservationRow): CancelRefundMode {
  const paidServiceCents = Math.max(0, Number(reservation.paidServiceCents ?? reservation.paidCents ?? 0));
  const paidDepositCents = Math.max(0, Number(reservation.paidDepositCents ?? 0));
  return paidServiceCents + paidDepositCents > 0 ? "leavePendingRefund" : "none";
}

function refundableCancelAmountsFromReservation(reservation: ReservationRow) {
  return {
    refundableServiceCents: Math.max(0, Number(reservation.paidServiceCents ?? reservation.paidCents ?? 0)),
    refundableDepositCents: Math.max(0, Number(reservation.paidDepositCents ?? 0)),
  };
}

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
  const [cancelDraft, setCancelDraft] = useState<CancelDraft | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null>(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const [cancelPreviewError, setCancelPreviewError] = useState<string | null>(null);
  const [cancelCommitting, setCancelCommitting] = useState(false);

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

  useLiveRefresh(loadPending, { intervalMs: 30_000 });

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
      <AlertBanner tone="warning" title="Caja cerrada">
        No se pueden registrar cobros en este turno. Si hay que reabrir, pídeselo a Admin.
      </AlertBanner>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [r, s, c, sum] = await Promise.all([
        fetch("/api/store/reservations/today", { cache: "no-store" }),
        fetch(`/api/store/payments/today-summary?origin=STORE&date=${todayLocalYMD()}`, { cache: "no-store" }),
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
  }, [handleActionError]);

  useLiveRefresh(load, { intervalMs: 45_000 });

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

  function openCancelReservation(reservation: ReservationRow, method: PayMethod) {
    setError(null);
    setCancelPreview(null);
    setCancelPreviewError(null);
    setCancelDraft({
      reservation,
      method,
      refundMode: defaultCancelRefundMode(reservation),
      reason: "",
    });
  }

  useEffect(() => {
    if (!cancelDraft) {
      setCancelPreview(null);
      setCancelPreviewError(null);
      setCancelPreviewLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setCancelPreviewLoading(true);
      setCancelPreviewError(null);
      try {
        const refundSubmit = resolveCancelRefundSubmit({
          selectedRefundMode: cancelDraft.refundMode,
          ...refundableCancelAmountsFromReservation(cancelDraft.reservation),
        });
        const r = await fetch(`/api/store/reservations/${cancelDraft.reservation.id}/commercial-adjustment/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newTotalCents: 0,
            newDepositCents: 0,
            operationType: "CANCEL",
            requestedRefundMode: refundSubmit.requestedRefundMode,
            refundScope: refundSubmit.refundScope,
            reason: cancelDraft.reason,
          }),
        });

        if (!r.ok) throw new Error(await responseErrorMessage(r, "No se pudo preparar la cancelacion"));
        const preview = (await r.json()) as CancelPreview;
        if (!active) return;
        setCancelPreview(preview);
      } catch (e: unknown) {
        if (!active) return;
        setCancelPreview(null);
        setCancelPreviewError(errorMessage(e, "No se pudo preparar la cancelacion"));
      } finally {
        if (active) setCancelPreviewLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cancelDraft]);

  async function commitCancelReservation() {
    if (!cancelDraft) return;
    const reason = cancelDraft.reason.trim();
    const fallbackAmounts = refundableCancelAmountsFromReservation(cancelDraft.reservation);
    const refundSubmit = resolveCancelRefundSubmit({
      selectedRefundMode: cancelDraft.refundMode,
      refundableServiceCents: Math.max(
        0,
        Number(
          cancelPreview?.refundableServiceCents ??
            cancelPreview?.overpaidServiceCents ??
            fallbackAmounts.refundableServiceCents
        )
      ),
      refundableDepositCents: Math.max(
        0,
        Number(cancelPreview?.refundableDepositCents ?? fallbackAmounts.refundableDepositCents)
      ),
    });
    const { requestedRefundMode, refundScope } = refundSubmit;
    if (!reason) {
      setCancelPreviewError("Indica el motivo de la cancelacion.");
      return;
    }
    if (requestedRefundMode === "refundNow" && isCashClosed) {
      setCancelPreviewError("Caja cerrada: no se puede devolver ahora.");
      return;
    }

    setError(null);
    setCancelCommitting(true);
    try {
      const r = await fetch(`/api/store/reservations/${cancelDraft.reservation.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedRefundMode,
          refundScope,
          refundMethod: cancelDraft.method,
          refundOrigin: "STORE",
          reason,
        }),
      });

      if (!r.ok) throw new Error(await responseErrorMessage(r, "No se pudo cancelar la reserva"));
      setCancelDraft(null);
      await load();
    } catch (e: unknown) {
      const message = errorMessage(e, "No se pudo cancelar la reserva");
      setCancelPreviewError(message);
      handleActionError("cancel reservation", e, message);
    } finally {
      setCancelCommitting(false);
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
        const aTotal = Number(a.totalToChargeCents ?? 0);
        const bTotal = Number(b.totalToChargeCents ?? 0);
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
          r.storeFlowStage !== "RETURN_PENDING_CLOSE"
      ),
    [rowsSorted],
  );
  const rowsRight = useMemo(() => rowsSorted.filter((r) => RIGHT_STATUSES.has(r.status)), [rowsSorted]);
  const rowsReturned = useMemo(
    () =>
      rowsSorted
        .filter((r) => r.storeFlowStage === "RETURN_PENDING_CLOSE")
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
          const totalToCharge = Number(r.totalToChargeCents ?? 0);
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
        eyebrow="SeaRiders Store"
        eyebrowColor="#58708f"
        background="linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)"
        actions={
          <>
            <ActionButton href={cashClosureHref} variant={cashClosureSummary?.isClosed ? "secondary" : "primary"}>
              {cashClosureLabel}
            </ActionButton>
            <ActionButton href="/store/history" variant="secondary">Histórico</ActionButton>
            <ActionButton href="/store/booth" variant="secondary">Carpa</ActionButton>
            <ActionButton href="/operations" variant="secondary">Operaciones</ActionButton>
            <ActionButton href="/store/gifts" variant="secondary">Regalos</ActionButton>
            <ActionButton href="/store/bonos" variant="secondary">Bonos</ActionButton>
            <ActionButton href="/store/calendar" variant="secondary">Calendario</ActionButton>
            <ActionButton href="/store/create" variant="primary">
              + Crear reserva
            </ActionButton>
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
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#51627b" }}>Consulta rápida de pendientes y acceso directo al calendario operativo.</div>
            <div>
              <StatusBadge tone={pendingCount > 0 ? "warning" : "success"}>
                {pendingCount > 0 ? `${pendingCount} pendientes de formalizar` : "Formalización al día"}
              </StatusBadge>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <ActionButton onClick={loadPending} variant="secondary" disabled={pendingLoading}>
              {pendingLoading ? "Actualizando..." : "Refrescar"}
            </ActionButton>
            <ActionButton
              href={`/store/calendar?day=${todayLocalYMD()}`}
              variant={pendingCount > 0 ? "primary" : "secondary"}
              style={{ opacity: pendingLoading ? 0.8 : 1 }}
            >
              Ver en calendario
            </ActionButton>
          </div>
        </div>
      </StoreHero>

      {error ? <AlertBanner tone="danger" title="Error operativo">{error}</AlertBanner> : null}
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
                      nowMs={nowMs}
                      cancelReservation={openCancelReservation}
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
                  completeReturn={completeReturn}
                  cancelReservation={openCancelReservation}
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
                  showReturnedBanner
                  showReturnedActions
                  completeReturn={completeReturn}
                  cancelReservation={openCancelReservation}
                />
              );
            })}
          </StoreReservationColumnSection>
        </div>
      </section>

      {cancelDraft ? (
        <CancelReservationModal
          draft={cancelDraft}
          preview={cancelPreview}
          previewLoading={cancelPreviewLoading}
          previewError={cancelPreviewError}
          isCashClosed={isCashClosed}
          committing={cancelCommitting}
          onClose={() => {
            if (cancelCommitting) return;
            setCancelDraft(null);
          }}
          onChange={(patch) => setCancelDraft((current) => (current ? { ...current, ...patch } : current))}
          onConfirm={() => void commitCancelReservation()}
        />
      ) : null}
    </div>
  );
}

function cancelBlockerLabel(blocker: string) {
  switch (blocker) {
    case "CANCEL_REASON_REQUIRED":
      return "Indica el motivo de la cancelacion.";
    case "REFUND_MODE_REQUIRED":
      return "Elige devolver ahora o dejar la devolucion pendiente.";
    case "REFUND_SCOPE_INCOMPATIBLE":
      return "El alcance de devolucion debe incluir servicio.";
    case "REFUND_REASON_REQUIRED":
      return "La devolucion requiere motivo.";
    case "PAID_COMMISSION":
      return "Comision pagada: requiere flujo admin.";
    case "ADVANCED_RESERVATION_STATUS":
      return "El estado operativo no permite cancelar desde tienda.";
    case "VOUCHER_OR_PASS_OR_GIFT":
      return "Reserva con bono, regalo o voucher: requiere revision.";
    default:
      return blocker;
  }
}

function CancelReservationModal({
  draft,
  preview,
  previewLoading,
  previewError,
  isCashClosed,
  committing,
  onClose,
  onChange,
  onConfirm,
}: {
  draft: CancelDraft;
  preview: CancelPreview | null;
  previewLoading: boolean;
  previewError: string | null;
  isCashClosed: boolean;
  committing: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CancelDraft>) => void;
  onConfirm: () => void;
}) {
  const paidServiceFallback = Math.max(
    0,
    Number(draft.reservation.paidServiceCents ?? draft.reservation.paidCents ?? 0)
  );
  const paidDepositFallback = Math.max(0, Number(draft.reservation.paidDepositCents ?? 0));
  const refundableServiceCents = Math.max(
    0,
    Number(preview?.refundableServiceCents ?? preview?.overpaidServiceCents ?? paidServiceFallback)
  );
  const refundableDepositCents = Math.max(
    0,
    Number(preview?.refundableDepositCents ?? paidDepositFallback)
  );
  const hasRefundableAmount = refundableServiceCents + refundableDepositCents > 0;
  const canConfirm =
    Boolean(draft.reason.trim()) &&
    Boolean(preview?.canCommit) &&
    !previewLoading &&
    !committing &&
    !(draft.refundMode === "refundNow" && isCashClosed);
  const oldTotalCents = Number(preview?.oldTotalCents ?? draft.reservation.finalTotalCents ?? draft.reservation.totalPriceCents ?? 0);
  const paidServiceCents = Number(preview?.paidServiceCents ?? paidServiceFallback);
  const paidDepositCents = Number(preview?.paidDepositCents ?? paidDepositFallback);
  const refundNowCents = Number(preview?.refundNowCents ?? 0);
  const pendingRefundCents = Number(preview?.pendingRefundCents ?? 0);
  const depositRefundHeldCents = Number(preview?.depositRefundHeldCents ?? 0);

  return (
    <div style={modalBackdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-reservation-title" style={modalPanel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div id="cancel-reservation-title" style={{ fontWeight: 950, fontSize: 20 }}>
              Cancelar reserva
            </div>
            <div style={{ color: "#475569", fontSize: 13 }}>
              {draft.reservation.customerName || "Sin nombre"} - {draft.reservation.serviceName ?? "Servicio"}
            </div>
          </div>
          <ActionButton type="button" variant="secondary" onClick={onClose} disabled={committing}>
            Cerrar
          </ActionButton>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Modo de devolucion</div>
          {hasRefundableAmount ? (
            <div style={{ display: "grid", gap: 8 }}>
              <label style={radioRowStyle}>
                <input
                  type="radio"
                  checked={draft.refundMode === "refundNow"}
                  disabled={isCashClosed}
                  onChange={() => onChange({ refundMode: "refundNow" })}
                />
                <span>Devolver ahora</span>
              </label>
              <label style={radioRowStyle}>
                <input
                  type="radio"
                  checked={draft.refundMode === "leavePendingRefund"}
                  onChange={() => onChange({ refundMode: "leavePendingRefund" })}
                />
                <span>Dejar devolucion pendiente</span>
              </label>
              {isCashClosed ? (
                <AlertBanner tone="warning" title="Caja cerrada">
                  No se puede registrar una devolucion ahora en este turno.
                </AlertBanner>
              ) : null}
            </div>
          ) : (
            <label style={radioRowStyle}>
              <input
                type="radio"
                checked={!hasRefundableAmount || draft.refundMode === "none"}
                onChange={() => onChange({ refundMode: "none" })}
              />
              <span>Sin devolucion</span>
            </label>
          )}
        </div>

        {draft.refundMode === "refundNow" && hasRefundableAmount ? (
          <div style={{ display: "grid", gap: 6 }}>
            <label htmlFor="cancel-refund-method" style={{ fontWeight: 900 }}>
              Metodo
            </label>
            <select
              id="cancel-refund-method"
              value={draft.method}
              onChange={(event) => onChange({ method: event.target.value as PayMethod })}
              style={fieldStyle}
            >
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BIZUM">Bizum</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 6 }}>
          <label htmlFor="cancel-reason" style={{ fontWeight: 900 }}>
            Motivo obligatorio
          </label>
          <textarea
            id="cancel-reason"
            value={draft.reason}
            onChange={(event) => onChange({ reason: event.target.value })}
            rows={3}
            maxLength={500}
            placeholder="Ej: cliente cancela, climatologia, cambio operativo..."
            style={{ ...fieldStyle, resize: "vertical" }}
          />
        </div>

        <div style={summaryGridStyle}>
          <div>
            <div style={summaryLabelStyle}>oldTotal</div>
            <div style={summaryValueStyle}>{euros(oldTotalCents)}</div>
          </div>
          <div>
            <div style={summaryLabelStyle}>paidServiceCents</div>
            <div style={summaryValueStyle}>{euros(paidServiceCents)}</div>
          </div>
          <div>
            <div style={summaryLabelStyle}>paidDepositCents</div>
            <div style={summaryValueStyle}>{euros(paidDepositCents)}</div>
          </div>
          <div>
            <div style={summaryLabelStyle}>refundNowCents</div>
            <div style={summaryValueStyle}>{euros(refundNowCents)}</div>
          </div>
          <div>
            <div style={summaryLabelStyle}>pendingRefundCents</div>
            <div style={summaryValueStyle}>{euros(pendingRefundCents)}</div>
          </div>
        </div>

        {previewLoading ? <StatusBadge tone="info">Calculando preview</StatusBadge> : null}
        {previewError ? (
          <AlertBanner tone="danger" title="No se pudo preparar">
            {previewError}
          </AlertBanner>
        ) : null}
        {preview?.blockers.length ? (
          <AlertBanner tone="danger" title="Bloqueos">
            {preview.blockers.map(cancelBlockerLabel).join(" ")}
          </AlertBanner>
        ) : null}
        {preview?.warnings.includes("SIGNED_CONTRACT_HISTORY_PRESERVED") ? (
          <AlertBanner tone="info" title="Contrato firmado">
            Los contratos firmados se conservan intactos como historico legal.
          </AlertBanner>
        ) : null}
        {preview?.warnings.includes("DEPOSIT_HELD_NOT_REFUNDED") ? (
          <AlertBanner tone="warning" title="Fianza retenida">
            La fianza retenida ({euros(depositRefundHeldCents)}) no se devuelve en la cancelacion.
          </AlertBanner>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <ActionButton type="button" variant="secondary" onClick={onClose} disabled={committing}>
            Volver
          </ActionButton>
          <ActionButton
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{ opacity: canConfirm ? 1 : 0.55, cursor: canConfirm ? "pointer" : "not-allowed" }}
          >
            {committing ? "Cancelando..." : "Confirmar cancelacion"}
          </ActionButton>
        </div>
      </div>
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

const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(15, 23, 42, 0.48)",
};

const modalPanel: CSSProperties = {
  width: "min(640px, 100%)",
  maxHeight: "min(92vh, 820px)",
  overflow: "auto",
  display: "grid",
  gap: 16,
  padding: 18,
  borderRadius: 16,
  border: "1px solid #dbe4ef",
  background: "#fff",
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.26)",
};

const radioRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ef",
  background: "#f8fafc",
  fontWeight: 800,
};

const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  background: "#fff",
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbe4ef",
  background: "#f8fafc",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 800,
};

const summaryValueStyle: CSSProperties = {
  marginTop: 4,
  fontWeight: 950,
  color: "#0f172a",
};

