"use client";

import { useRouter } from "next/navigation";
import type React from "react";

import { ReservationOpsPanel } from "./ReservationOpsPanel";
import { StoreReservationCardSummary } from "./StoreReservationCardSummary";
import { StoreReservationPaymentsHistory } from "./StoreReservationPaymentsHistory";
import type { ExtraUiMap, PayLine, PayMethod, ReservationRow, Service } from "../types";
import { euros, getStoreFormalizedWaitMeta } from "../utils";

type LeftReservationCardProps = {
  r: ReservationRow;
  isCashClosed: boolean;
  method: PayMethod;
  setMethod: (m: PayMethod) => void;
  passToReadyForPlatform: (reservationId: string) => Promise<void>;
  createPayment: (
    input: {
      reservationId: string;
      amountCents: number;
      method: PayMethod;
      origin: "STORE" | "BOOTH" | "BAR" | "WEB";
      isDeposit: boolean;
      direction?: "IN" | "OUT";
    },
    opts?: { reload?: boolean }
  ) => Promise<void>;
  load: () => Promise<void>;
  setError: (msg: string | null) => void;
  servicesExtra: Service[];
  extraUi: ExtraUiMap;
  setExtraUi: React.Dispatch<React.SetStateAction<ExtraUiMap>>;
  getExtraState: (reservationId: string, servicesExtra: Service[], extraUi: ExtraUiMap) => { extraServiceId: string; qty: number };
  addExtraToReservation: (reservationId: string) => Promise<void>;
  servicePayLines: PayLine[];
  addServicePayLine: () => void;
  removeServicePayLine: (idx: number) => void;
  updateServicePayLine: (idx: number, patch: Partial<PayLine>) => void;
  chargeServiceSplit: (reservationId: string, maxServiceCents: number) => Promise<void>;
  btnSecondary: React.CSSProperties;
  nowMs: number;
  cancelReservation: (reservationId: string, opts: { refund: boolean; method: PayMethod }) => Promise<void>;
};

export function LeftReservationCard(props: LeftReservationCardProps) {
  const {
    r,
    isCashClosed,
    method,
    setMethod,
    passToReadyForPlatform,
    createPayment,
    load,
    setError,
    servicesExtra,
    extraUi,
    setExtraUi,
    getExtraState,
    addExtraToReservation,
    servicePayLines,
    addServicePayLine,
    removeServicePayLine,
    updateServicePayLine,
    chargeServiceSplit,
    btnSecondary,
    nowMs,
    cancelReservation,
  } = props;

  const router = useRouter();
  const reservationHref =
    r.source === "BOOTH" && !r.formalizedAt
      ? `/store/create?migrateFrom=${r.id}`
      : `/store/create?editFrom=${r.id}`;

  const serviceTotal = Number(r.serviceTotalCents ?? 0);
  const extrasTotal = Number(r.extrasTotalCents ?? 0);
  const total = Number(r.soldTotalCents ?? 0);
  const deposit = Number(r.depositCents ?? 0);
  const totalToChargeCents = total + deposit;
  const pvpTotal = Number(r.soldTotalCents ?? total);
  const autoDisc = Number(r.autoDiscountCents ?? 0);
  const manualDisc = Number(r.manualDiscountCents ?? 0);
  const finalTotal = Number(r.finalTotalCents ?? r.totalPriceCents ?? Math.max(0, pvpTotal - autoDisc - manualDisc));
  const paid = Number(r.paidCents ?? 0);
  const paidDepositCents = Number(r.paidDepositCents ?? 0);
  const hasDepositIn = (r.payments ?? []).some((p) => p.isDeposit && p.direction !== "OUT");
  const hasDepositOut = (r.payments ?? []).some((p) => p.isDeposit && p.direction === "OUT");
  const depositStatus = r.depositHeld
    ? "RETENIDA"
    : paidDepositCents <= 0
      ? hasDepositIn && hasDepositOut
        ? "DEVUELTA"
        : "PENDIENTE"
      : "LIBERABLE";
  const pendingService = Number(r.pendingServiceCents ?? 0);
  const pendingDeposit = Number(r.pendingDepositCents ?? 0);
  const pendingCents = Number(r.pendingCents ?? 0);
  const pendingTotal = pendingService + pendingDeposit;
  const waitMeta = getStoreFormalizedWaitMeta({ formalizedAt: r.formalizedAt, status: r.status, pendingTotal, nowMs });
  const isFullyPaid = pendingTotal === 0;
  const servicePaid = Math.max(0, Number(r.paidServiceCents ?? 0));
  const depositPaid = Math.min(paid, deposit);
  const hasRefundableAmount = paid > 0;
  const requiredUnits = Number(r.contractsBadge?.requiredUnits ?? 0);
  const readyCount = Number(r.contractsBadge?.readyCount ?? 0);
  const showContracts = requiredUnits > 0 || readyCount > 0;
  const needsContracts = showContracts && requiredUnits > 0 && readyCount < requiredUnits;
  const contractsState = !showContracts ? null : readyCount >= requiredUnits ? "OK" : readyCount > 0 ? "PARTIAL" : "MISSING";

  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
      <StoreReservationCardSummary
        reservation={r}
        btnSecondary={btnSecondary}
        finalTotal={finalTotal}
        pvpTotal={pvpTotal}
        autoDisc={autoDisc}
        manualDisc={manualDisc}
        servicePaid={servicePaid}
        depositPaid={depositPaid}
        pendingCents={pendingCents}
        depositStatus={depositStatus}
        waitMeta={waitMeta}
        serviceTotal={serviceTotal}
        extrasTotal={extrasTotal}
        deposit={deposit}
        totalToChargeCents={totalToChargeCents}
        showContracts={showContracts}
        requiredUnits={requiredUnits}
        readyCount={readyCount}
        needsContracts={needsContracts}
        contractsState={contractsState}
        isFullyPaid={isFullyPaid}
        onEdit={() => router.push(reservationHref)}
        onCancel={async () => {
          if (!hasRefundableAmount) {
            if (!window.confirm("¿Cancelar esta reserva?")) return;
            await cancelReservation(r.id, { refund: false, method });
            return;
          }

          const refund = window.confirm(
            `La reserva tiene cobros registrados. Aceptar = cancelar y devolver usando ${method}. Cancelar = seguir sin devolución.`
          );
          if (!refund && !window.confirm("¿Confirmas cancelar sin devolución?")) return;
          await cancelReservation(r.id, { refund, method });
        }}
        onCompleteContracts={() => router.push(`/store/create?migrateFrom=${r.id}#contracts`)}
        onPassToReady={() => passToReadyForPlatform(r.id)}
      />

      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #ddd" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Cobrado</div>
            <div style={{ fontWeight: 700 }}>{euros(paid)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Pendiente</div>
            <div style={{ fontWeight: 700 }}>{euros(pendingTotal)}</div>
          </div>
          {isFullyPaid ? <div style={{ alignSelf: "center", fontWeight: 700 }}>Pagado</div> : null}
        </div>

        {r.source === "BOOTH" ? (
          <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#eef2ff" }}>Carpa</span>
            {r.boothCode ? <span style={{ fontWeight: 800 }}>{r.boothCode}</span> : null}
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: r.arrivedStoreAt ? "#dcfce7" : "#fef9c3",
              }}
            >
              {r.arrivedStoreAt ? "Recibido" : "En camino"}
            </span>
          </div>
        ) : null}

        {r.boothNote ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid #dbeafe",
              background: "#f8fbff",
              color: "#1e293b",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: "#0f172a" }}>Nota Booth:</strong> {r.boothNote}
          </div>
        ) : null}

        {r.source === "BOOTH" ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid #a5f3fc",
              background: "#ecfeff",
              color: "#155e75",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            El descuento heredado de carpa solo se conserva al ampliar la misma actividad original. Si añades otra actividad distinta o extras, esas líneas no reciben descuento de Booth.
          </div>
        ) : null}

        {r.taxiboatTrip ? (
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#e0e7ff" }}>
            Taxi boat {r.taxiboatTrip.boat}
            {r.taxiboatTrip.departedAt ? ` · salió ${new Date(r.taxiboatTrip.departedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : " · preparando"}
          </span>
        ) : null}

        <StoreReservationPaymentsHistory payments={r.payments ?? []} />

        {!isFullyPaid ? (
          <div style={{ marginTop: 10 }}>
            <ReservationOpsPanel
              r={r}
              isCashClosed={isCashClosed}
              method={method}
              setMethod={setMethod}
              createPayment={createPayment}
              reloadDashboard={load}
              setError={setError}
              servicesExtra={servicesExtra}
              extraUi={extraUi}
              setExtraUi={setExtraUi}
              getExtraState={getExtraState}
              addExtraToReservation={addExtraToReservation}
              servicePayLines={servicePayLines}
              addServicePayLine={addServicePayLine}
              removeServicePayLine={removeServicePayLine}
              updateServicePayLine={updateServicePayLine}
              chargeServiceSplit={chargeServiceSplit}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, opacity: 0.85 }}>
          <span>Cant: {r.quantity}</span>
          <span>PAX: {r.pax}</span>
          <span>{r.isLicense ? "Licencia" : "Sin licencia"}</span>
          <span>Canal: {r.channelName ?? "-"}</span>
        </div>
      </div>
    </div>
  );
}
