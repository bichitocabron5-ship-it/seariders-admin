// src/app/store/dashboard/components/LeftReservationCard.tsx
"use client";

import { useRouter } from "next/navigation";
import type React from "react";
import { ReservationOpsPanel } from "./ReservationOpsPanel";
import type { ExtraUiMap, PayLine, PayMethod, ReservationRow, Service } from "../types";
import { euros, getStoreFormalizedWaitMeta, hhmm, statusColor } from "../utils";

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: color,
        color: "#111",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

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

  const serviceTotal = Number(r.serviceTotalCents ?? 0);
  const extrasTotal = Number(r.extrasTotalCents ?? 0);
  const total = Number(r.soldTotalCents ?? 0);
  const deposit = Number(r.depositCents ?? 0);
  const totalToChargeCents = total + deposit;
  const timeLabel = hhmm(r.scheduledTime) || "sin hora";
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong>{r.customerName || "Sin nombre"}</strong>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{timeLabel}</span>
          <Badge label={r.status} color={statusColor(r.status)} />

          {showContracts ? (
            <div
              title={`Contratos listos: ${readyCount}/${requiredUnits}`}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border:
                  contractsState === "OK"
                    ? "1px solid #bbf7d0"
                    : contractsState === "PARTIAL"
                      ? "1px solid #fde68a"
                      : "1px solid #fecaca",
                background:
                  contractsState === "OK"
                    ? "#ecfdf5"
                    : contractsState === "PARTIAL"
                      ? "#fffbeb"
                      : "#fff1f2",
                color:
                  contractsState === "OK"
                    ? "#065f46"
                    : contractsState === "PARTIAL"
                      ? "#92400e"
                      : "#991b1b",
                fontWeight: 900,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Contratos {readyCount}/{requiredUnits}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => router.push(`/store/create?editFrom=${r.id}`)} style={btnSecondary}>
            Reagendar
          </button>
          <button
            type="button"
            onClick={async () => {
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
            style={{ ...btnSecondary, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b" }}
          >
            Cancelar
          </button>
          {needsContracts ? (
            <button type="button" onClick={() => router.push(`/store/create?migrateFrom=${r.id}#contracts`)} style={btnSecondary}>
              Completar contratos
            </button>
          ) : null}
          {isFullyPaid ? (
            <button
              type="button"
              onClick={() => passToReadyForPlatform(r.id)}
              disabled={needsContracts}
              title={needsContracts ? "Faltan contratos por completar" : ""}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                fontWeight: 900,
                opacity: needsContracts ? 0.6 : 1,
                cursor: needsContracts ? "not-allowed" : "pointer",
              }}
            >
              Pasar a Ready
            </button>
          ) : null}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900 }}>{euros(finalTotal)}</div>
          {autoDisc > 0 || manualDisc > 0 ? (
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
              <span style={{ textDecoration: "line-through", opacity: 0.7 }}>{euros(pvpTotal)}</span>
              {autoDisc > 0 ? <span style={{ marginLeft: 8 }}>Auto: −{euros(autoDisc)}</span> : null}
              {manualDisc > 0 ? <span style={{ marginLeft: 8 }}>Manual: −{euros(manualDisc)}</span> : null}
              {r.manualDiscountReason ? <div style={{ marginTop: 2, opacity: 0.75 }}>Motivo: {r.manualDiscountReason}</div> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
        {r.serviceName ? r.serviceName : "Servicio"}
        {r.durationMinutes ? ` · ${r.durationMinutes} min` : ""}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <Badge label={`Servicio ${euros(servicePaid)}`} color="#e0f2fe" />
        <Badge label={`Fianza ${euros(depositPaid)}`} color="#fef9c3" />
        <Badge
          label={
            depositStatus === "PENDIENTE"
              ? "Fianza pendiente"
              : depositStatus === "LIBERABLE"
                ? "Fianza liberable"
                : depositStatus === "DEVUELTA"
                  ? "Fianza devuelta"
                   : "⚠ Fianza retenida"
                  
          }
          color={
            depositStatus === "PENDIENTE"
              ? "#fee2e2"
              : depositStatus === "LIBERABLE"
                ? "#fef9c3"
                : depositStatus === "DEVUELTA"
                  ? "#dcfce7"
                  : "#fecaca"
          }
        />
        {pendingCents > 0 ? <Badge label={`Pendiente ${euros(pendingCents)}`} color="#fee2e2" /> : <Badge label="Todo cobrado" color="#dcfce7" />}
        {waitMeta ? <Badge label={waitMeta.label} color={waitMeta.bg} /> : null}
      </div>

      <div style={{ opacity: 0.85, marginTop: 6 }}>
        <div>Total (final): {euros(finalTotal)}</div>
        <div style={{ opacity: 0.8 }}>PVP: {euros(pvpTotal)}</div>
        <div>Servicio: {euros(serviceTotal)}</div>
        <div>Extras: {euros(extrasTotal)}</div>
        <div>Fianza: {euros(deposit)}</div>
        <div>
          <strong>Total a cobrar hoy:</strong> {euros(totalToChargeCents)}
        </div>
      </div>

        {r.depositHeld ? (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              display: "grid",
              gap: 4,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 800 }}>Incidencia registrada</div>
            <div>{r.depositHoldReason || "Fianza retenida por incidencia de plataforma."}</div>
          </div>
        ) : null}

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
          {isFullyPaid ? <div style={{ alignSelf: "center", fontWeight: 700 }}>✅ Pagado</div> : null}
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

        {r.taxiboatTrip ? (
          <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#e0e7ff" }}>
            🚤 {r.taxiboatTrip.boat}
            {r.taxiboatTrip.departedAt ? ` · salió ${new Date(r.taxiboatTrip.departedAt).toLocaleTimeString()}` : " · preparando"}
          </span>
        ) : null}

        {r.payments && r.payments.length > 0 ? (
          <div style={{ marginTop: 10, borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Historial de pagos</div>
            <div style={{ display: "grid", gap: 8 }}>
              {r.payments.map((p, i: number) => {
                const isOut = p.direction === "OUT";
                const sign = isOut ? "−" : "+";
                const color = isOut ? "#dc2626" : "#16a34a";
                const label = p.isDeposit ? "Fianza" : "Servicio";
                const time = new Date(p.createdAt ?? "").toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                const Chip = ({ text, bg }: { text: string; bg: string }) => (
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: bg, whiteSpace: "nowrap" }}>{text}</span>
                );
                return (
                  <div
                    key={i}
                    style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 10 }}
                  >
                    <div style={{ color, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {sign} {euros(p.amountCents)}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Chip text={label} bg={p.isDeposit ? "#fff7cc" : "#eaf2ff"} />
                      <Chip text={p.method ?? "-"} bg="#f3f4f6" />
                      <Chip text={p.origin ?? "-"} bg="#f3f4f6" />
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>{time}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
