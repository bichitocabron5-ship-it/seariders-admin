"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type OperationAlert = {
  id: string;
  customerName: string;
  status: string | null;
  pendingCents: number;
};

type SaturationAlert = {
  reservationId: string;
  customerName: string;
  serviceName: string | null;
  message: string;
};

type AlertsPayload = {
  waitingTooLong: OperationAlert[];
  missingAssignment: OperationAlert[];
  unformalized: OperationAlert[];
  pendingPayments: OperationAlert[];
  completeOrSaturated: SaturationAlert[];
  startingSoonNotReady: OperationAlert[];
  overdueOperations: OperationAlert[];
  criticalPendingPayments: OperationAlert[];
  criticalContracts: OperationAlert[];
  taxiboatBlocked: OperationAlert[];
};

export default function OperationsAlertsSection({
  alerts,
  formatEur,
}: {
  alerts: AlertsPayload;
  formatEur: (cents: number | null | undefined) => string;
}) {
  const hasOperationalAlerts =
    alerts.waitingTooLong.length > 0 ||
    alerts.missingAssignment.length > 0 ||
    alerts.unformalized.length > 0 ||
    alerts.pendingPayments.length > 0 ||
    alerts.completeOrSaturated.length > 0;

  const hasCriticalAlerts =
    alerts.startingSoonNotReady.length > 0 ||
    alerts.overdueOperations.length > 0 ||
    alerts.criticalPendingPayments.length > 0 ||
    alerts.criticalContracts.length > 0 ||
    alerts.taxiboatBlocked.length > 0;

  if (!hasOperationalAlerts && !hasCriticalAlerts) {
    return null;
  }

  return (
    <>
      {hasOperationalAlerts ? (
        <section style={sectionCard}>
          <div style={sectionHeaderRow}>
            <div>
              <div style={sectionEyebrow}>Seguimiento</div>
              <div style={sectionTitle}>Alertas operativas</div>
            </div>
          </div>

          <div style={alertGrid}>
            {alerts.waitingTooLong.map((reservation) => (
              <div key={`wtl-${reservation.id}`} style={alertWarn}>
                <strong>{reservation.customerName}</strong> lleva demasiado tiempo en WAITING.
              </div>
            ))}

            {alerts.missingAssignment.map((reservation) => (
              <div key={`ma-${reservation.id}`} style={alertWarn}>
                <strong>{reservation.customerName}</strong> tiene asignación pendiente de taxiboat o plataforma.
              </div>
            ))}

            {alerts.unformalized.map((reservation) => (
              <div key={`uf-${reservation.id}`} style={alertInfo}>
                <strong>{reservation.customerName}</strong> sigue sin formalizar.
              </div>
            ))}

            {alerts.pendingPayments.map((reservation) => (
              <div key={`pp-${reservation.id}`} style={alertInfo}>
                <strong>{reservation.customerName}</strong> mantiene pendiente{" "}
                <strong>{formatEur(reservation.pendingCents)}</strong>.
              </div>
            ))}

            {alerts.completeOrSaturated.map((reservation) => (
              <div key={`cs-${reservation.reservationId}`} style={alertWarn}>
                <strong>{reservation.customerName}</strong> | {reservation.serviceName ?? "Servicio"} |{" "}
                {reservation.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {hasCriticalAlerts ? (
        <section style={criticalCard}>
          <div style={sectionHeaderRow}>
            <div>
              <div style={sectionEyebrow}>Prioridad alta</div>
              <div style={criticalTitle}>Alertas críticas</div>
            </div>
          </div>

          <div style={alertGrid}>
            {alerts.startingSoonNotReady.map((reservation) => (
              <div key={`ssnr-${reservation.id}`} style={criticalBox}>
                <strong>{reservation.customerName}</strong> empieza pronto y sigue en{" "}
                <strong>{reservation.status}</strong>.
              </div>
            ))}

            {alerts.overdueOperations.map((reservation) => (
              <div key={`ovr-${reservation.id}`} style={criticalBox}>
                <strong>{reservation.customerName}</strong> ya debería haber empezado y sigue en{" "}
                <strong>{reservation.status}</strong>.
              </div>
            ))}

            {alerts.criticalPendingPayments.map((reservation) => (
              <div key={`cpp-${reservation.id}`} style={criticalBox}>
                <strong>{reservation.customerName}</strong> tiene un cobro pendiente crítico:{" "}
                <strong>{formatEur(reservation.pendingCents)}</strong>.
              </div>
            ))}

            {alerts.criticalContracts.map((reservation) => (
              <div key={`cc-${reservation.id}`} style={criticalBox}>
                <strong>{reservation.customerName}</strong> tiene contratos incompletos y la salida está próxima.
              </div>
            ))}

            {alerts.taxiboatBlocked.map((reservation) => (
              <div key={`tb-${reservation.id}`} style={criticalBox}>
                <strong>{reservation.customerName}</strong> tiene taxiboat asignado pero aún no ha salido.
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

const sectionCard: CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #d9dee8",
  background: "rgba(255, 255, 255, 0.92)",
  display: "grid",
  gap: 16,
  boxShadow: "0 14px 34px rgba(20, 32, 51, 0.05)",
};

const criticalCard: CSSProperties = {
  ...sectionCard,
  border: "1px solid #fecaca",
  background: "linear-gradient(180deg, #fff4f4 0%, #fff 100%)",
};

const sectionHeaderRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#6c819d",
};

const sectionTitle: CSSProperties = {
  marginTop: 4,
  fontSize: 24,
  fontWeight: 950,
  color: "#142033",
};

const criticalTitle: CSSProperties = {
  ...sectionTitle,
  color: "#8f1d1d",
};

const alertGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 10,
};

const alertWarn: CSSProperties = {
  border: "1px solid #f7d58d",
  background: "#fff8e8",
  borderRadius: 14,
  padding: 12,
};

const alertInfo: CSSProperties = {
  border: "1px solid #cfe0ff",
  background: "#f2f7ff",
  borderRadius: 14,
  padding: 12,
};

const criticalBox: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff",
  borderRadius: 14,
  padding: 12,
};
