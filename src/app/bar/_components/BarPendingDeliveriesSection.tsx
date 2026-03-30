"use client";

import { Alert, Button, Card, Select, styles } from "@/components/ui";

import type { AvailableAssetsByTaskItem, PendingTask } from "../services/bar";

type BarPendingDeliveriesSectionProps = {
  pendingTasks: PendingTask[];
  taskAssets: Record<string, AvailableAssetsByTaskItem[]>;
  taskSelections: Record<string, Record<string, string>>;
  actionBusy: string | null;
  hhmm: (value?: string | Date | null) => string;
  labelTaskKind: (kind: PendingTask["kind"]) => string;
  onIncidentTask: (taskId: string) => void;
  onDeliverTask: (task: PendingTask) => void;
  onSelectTaskAsset: (taskId: string, taskItemId: string, rentalAssetId: string) => void;
};

export function BarPendingDeliveriesSection({
  pendingTasks,
  taskAssets,
  taskSelections,
  actionBusy,
  hhmm,
  labelTaskKind,
  onIncidentTask,
  onDeliverTask,
  onSelectTaskAsset,
}: BarPendingDeliveriesSectionProps) {
  return (
    <Card title="Pendientes de entrega">
      <div style={{ display: "grid", gap: 12 }}>
        {pendingTasks.length === 0 ? (
          <Alert kind="info">No hay pendientes de entrega.</Alert>
        ) : (
          pendingTasks.map((task) => {
            const hasUnmappedItems = task.items.some((item) => !item.barProductId);
            const deliverBusy = actionBusy === `deliver-${task.id}`;
            const incidentBusy = actionBusy === `incident-${task.id}`;

            return (
              <div key={task.id} style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          ...styles.pill,
                          background: task.kind === "CATERING" ? "#eff6ff" : "#f5f3ff",
                          border: `1px solid ${task.kind === "CATERING" ? "#bfdbfe" : "#ddd6fe"}`,
                          color: task.kind === "CATERING" ? "#1d4ed8" : "#6d28d9",
                          fontWeight: 900,
                        }}
                      >
                        {labelTaskKind(task.kind)}
                      </span>
                      <span style={{ fontWeight: 900 }}>{task.reservationLabel}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{task.customerName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Hora {hhmm(task.time)} - {task.paid ? "Pagado" : "Pendiente de pago"}</div>
                    {hasUnmappedItems ? (
                      <div style={{ fontSize: 12, color: "#b45309", fontWeight: 800 }}>
                        Hay ítems sin producto BAR vinculado. Revisa catálogo antes de entregar.
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Button onClick={() => onIncidentTask(task.id)} disabled={incidentBusy}>
                      {incidentBusy ? "Guardando..." : "Incidencia"}
                    </Button>
                    <Button variant="primary" onClick={() => onDeliverTask(task)} disabled={deliverBusy || hasUnmappedItems}>
                      {deliverBusy ? "Entregando..." : "Entregado"}
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

                {task.kind === "EXTRA" ? (
                  <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Asignación de unidad física</div>
                    {(taskAssets[task.id] ?? []).map((group) => (
                      <div key={group.taskItemId} style={{ display: "grid", gap: 6, gridTemplateColumns: "1.2fr 1fr", alignItems: "center" }}>
                        <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>
                          {group.itemName} - {group.quantity}
                        </div>
                        <Select
                          value={taskSelections[task.id]?.[group.taskItemId] ?? ""}
                          onChange={(e) => onSelectTaskAsset(task.id, group.taskItemId, e.target.value)}
                        >
                          <option value="">Selecciona unidad</option>
                          {group.assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.code ?? asset.name}
                              {asset.size ? ` - ${asset.size}` : ""}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ))}
                    {(taskAssets[task.id] ?? []).length === 0 ? (
                      <div style={{ fontSize: 12, color: "#64748b" }}>No hay unidades disponibles para esta tarea.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
