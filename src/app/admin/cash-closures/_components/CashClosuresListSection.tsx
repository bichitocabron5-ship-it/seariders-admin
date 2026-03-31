"use client";

type Row = {
  id: string;
  origin: "STORE" | "BOOTH" | "BAR";
  shift: string;
  businessDate: string;
  closedAt: string;
  isVoided: boolean;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  closedByUser?: { fullName?: string | null; username?: string | null } | null;
  reviewedByUser?: { fullName?: string | null; username?: string | null } | null;
};

type Props = {
  panelStyle: React.CSSProperties;
  lightBtn: React.CSSProperties;
  loading: boolean;
  rows: Row[];
  selectedId: string;
  yyyyMmDd: (iso: string) => string;
  onSelect: (id: string) => void;
  onToggleReviewed: (row: Row) => void;
};

export default function CashClosuresListSection({
  panelStyle,
  lightBtn,
  loading,
  rows,
  selectedId,
  yyyyMmDd,
  onSelect,
  onToggleReviewed,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Lista</div>

      {loading ? (
        <div style={{ padding: 12, opacity: 0.7 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.7 }}>Sin cierres.</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.id}
            onClick={() => onSelect(row.id)}
            style={{
              borderTop: "1px solid #eee",
              padding: 14,
              cursor: "pointer",
              background:
                selectedId === row.id ? "linear-gradient(180deg, #f0f9ff 0%, #ecfeff 100%)" : "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 900,
                      background: row.isVoided ? "#fee2e2" : "#ecfeff",
                      color: row.isVoided ? "#991b1b" : "#155e75",
                      border: `1px solid ${row.isVoided ? "#fecaca" : "#bae6fd"}`,
                    }}
                  >
                    {row.origin}
                  </span>
                  {row.origin} · {row.shift} · {yyyyMmDd(row.businessDate)}
                  {row.isVoided ? " · ANULADO" : ""}
                </div>

                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  Cerró: {row.closedByUser?.fullName ?? row.closedByUser?.username ?? "—"} ·{" "}
                  {new Date(row.closedAt).toLocaleString()}
                </div>

                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                  {row.reviewedAt ? `✅ Revisado por ${row.reviewedByUser?.username ?? "admin"}` : "⏳ Pendiente de revisión"}
                  {row.reviewNote ? ` · ${row.reviewNote}` : ""}
                </div>
              </div>

              {!row.isVoided ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleReviewed(row);
                  }}
                  style={lightBtn}
                >
                  {row.reviewedAt ? "Quitar revisado" : "Marcar revisado"}
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
