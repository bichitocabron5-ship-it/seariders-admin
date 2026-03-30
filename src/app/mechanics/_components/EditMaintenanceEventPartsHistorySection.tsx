"use client";

import { eurFromCents, fmtDateTime } from "@/lib/mechanics-format";

type EventDetailRow = {
  logs: Array<{
    id: string;
    kind:
      | "CREATED"
      | "STATUS_CHANGED"
      | "REOPENED"
      | "RESOLVED"
      | "PARTS_UPDATED"
      | "COSTS_UPDATED"
      | "NOTE_UPDATED"
      | "FIELD_UPDATE";
    message: string;
    payloadJson: unknown;
    createdAt: string;
    createdByUser: {
      id: string;
      fullName: string | null;
      username: string | null;
      email: string | null;
    } | null;
  }>;
  partUsages: Array<{
    id: string;
    qty: number;
    totalCostCents: number | null;
    sparePart: {
      id: string;
      name: string;
      sku: string | null;
      unit: string | null;
    } | null;
  }>;
};

type Props = {
  row: EventDetailRow;
  realPartsCost: number;
  ghostBtn: React.CSSProperties;
  sectionCard: React.CSSProperties;
  onAdvancedPartsEdit?: () => void;
  logKindStyle: (kind: EventDetailRow["logs"][number]["kind"]) => React.CSSProperties;
  logKindLabel: (kind: EventDetailRow["logs"][number]["kind"]) => string;
  userLabel: (user: EventDetailRow["logs"][number]["createdByUser"] | null) => string;
  renderPayloadSummary: (payload: unknown) => React.ReactNode;
};

export default function EditMaintenanceEventPartsHistorySection({
  row,
  realPartsCost,
  ghostBtn,
  sectionCard,
  onAdvancedPartsEdit,
  logKindStyle,
  logKindLabel,
  userLabel,
  renderPayloadSummary,
}: Props) {
  return (
    <div style={sectionCard}>
      <div style={{ fontWeight: 900 }}>Piezas ya vinculadas</div>

      {row.partUsages.length === 0 ? (
        <div style={{ opacity: 0.72 }}>No hay piezas asociadas todavía.</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {row.partUsages.map((partUsage) => (
            <div
              key={partUsage.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 13,
              }}
            >
              <div>
                {partUsage.sparePart?.name ?? "Recambio"}
                {partUsage.sparePart?.sku ? ` · ${partUsage.sparePart.sku}` : ""}
                {partUsage.sparePart?.unit ? ` · ${partUsage.qty} ${partUsage.sparePart.unit}` : ` · qty ${partUsage.qty}`}
              </div>
              <div style={{ fontWeight: 800 }}>{eurFromCents(partUsage.totalCostCents)}</div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#fff",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 900 }}>Historial del evento</div>

        {!row.logs || row.logs.length === 0 ? (
          <div style={{ opacity: 0.72 }}>No hay entradas de historial todavía.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {row.logs.map((log) => (
              <div
                key={log.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  background: "#fafafa",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={logKindStyle(log.kind)}>{logKindLabel(log.kind)}</div>
                    <div style={{ fontWeight: 800 }}>{log.message}</div>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.72 }}>{fmtDateTime(log.createdAt)}</div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Usuario: <b>{userLabel(log.createdByUser)}</b>
                </div>

                {renderPayloadSummary(log.payloadJson)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Coste real de piezas por consumos: <b>{eurFromCents(realPartsCost)}</b>
      </div>

      {onAdvancedPartsEdit ? (
        <div>
          <button type="button" onClick={onAdvancedPartsEdit} style={ghostBtn}>
            Editar piezas del evento
          </button>
        </div>
      ) : null}
    </div>
  );
}
