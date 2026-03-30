"use client";

import { Alert, Button, Card, styles } from "@/components/ui";

import type { PendingTask } from "../services/bar";

type BarPendingReturnsSectionProps = {
  returnTasks: PendingTask[];
  actionBusy: string | null;
  hhmm: (value?: string | Date | null) => string;
  onIncidentTask: (taskId: string) => void;
  onReturnTask: (taskId: string) => void;
};

export function BarPendingReturnsSection({
  returnTasks,
  actionBusy,
  hhmm,
  onIncidentTask,
  onReturnTask,
}: BarPendingReturnsSectionProps) {
  return (
    <Card title="Pendientes de devolución">
      <div style={{ display: "grid", gap: 12 }}>
        {returnTasks.length === 0 ? (
          <Alert kind="info">No hay extras pendientes de devolución.</Alert>
        ) : (
          returnTasks.map((task) => {
            const hasUnmappedItems = task.items.some((item) => !item.barProductId);
            const returnBusy = actionBusy === `return-${task.id}`;
            const incidentBusy = actionBusy === `incident-${task.id}`;

            return (
              <div key={task.id} style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ ...styles.pill, background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", fontWeight: 900 }}>
                        Devolución
                      </span>
                      <span style={{ fontWeight: 900 }}>{task.reservationLabel}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{task.customerName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Hora {hhmm(task.time)} - {task.paid ? "Pagado" : "Pendiente de pago"}</div>
                    {hasUnmappedItems ? (
                      <div style={{ fontSize: 12, color: "#b45309", fontWeight: 800 }}>
                        Hay ítems heredados sin mapping. No se puede registrar la devolución automática.
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => onIncidentTask(task.id)} disabled={incidentBusy}>
                      {incidentBusy ? "Guardando..." : "Incidencia"}
                    </Button>
                    <Button variant="primary" onClick={() => onReturnTask(task.id)} disabled={returnBusy || hasUnmappedItems}>
                      {returnBusy ? "Registrando..." : "Devuelto"}
                    </Button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {task.items.map((item, idx) => (
                    <span
                      key={`${task.id}-${idx}`}
                      style={{
                        ...styles.pill,
                        background: item.barProductId ? "#f8fafc" : "#fff7ed",
                        border: `1px solid ${item.barProductId ? "#e2e8f0" : "#fed7aa"}`,
                        color: "#0f172a",
                      }}
                    >
                      {item.name} - {item.quantity}
                      {!item.barProductId ? " - sin mapping" : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
