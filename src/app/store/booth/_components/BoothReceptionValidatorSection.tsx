"use client";

type Props = {
  code: string;
  marking: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: () => void;
};

export default function BoothReceptionValidatorSection({
  code,
  marking,
  onCodeChange,
  onSubmit,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div style={sectionTitle}>Validar código de carpa</div>
          <div style={sectionSubtitle}>
            Al marcar recibido, el cliente se abre en tienda o migra al flujo de formalización.
          </div>
        </div>
      </div>

      <div style={validatorGrid}>
        <label style={fieldStyle}>
          Código
          <input
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="PO-1234-567"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
        </label>

        <button type="button" onClick={onSubmit} disabled={marking} style={primaryBtn}>
          {marking ? "Marcando..." : "Marcar recibido"}
        </button>
      </div>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 24,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  display: "grid",
  gap: 16,
  padding: 18,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 21,
  fontWeight: 950,
  color: "#0f172a",
};

const sectionSubtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#64748b",
};

const validatorGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) auto",
  gap: 12,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #d7dee6",
  background: "#fff",
  color: "#0f172a",
  font: "inherit",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};
