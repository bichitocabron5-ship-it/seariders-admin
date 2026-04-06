"use client";

import QRCode from "react-qr-code";

export function ContractSignerLinkModal({
  url,
  expiresInMinutes,
  onClose,
}: {
  url: string;
  expiresInMinutes: number;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 96vw)",
          background: "#fff",
          borderRadius: 18,
          padding: 18,
          display: "grid",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>
            Firma en tablet
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Escanea este QR desde el móvil o tablet</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            El enlace de firma caduca en {expiresInMinutes} minutos.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            placeItems: "center",
            padding: 18,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
            <QRCode value={url} size={256} />
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          Enlace de firma
          <input
            readOnly
            value={url}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#fff",
            }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(url)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Copiar enlace
          </button>
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Abrir firma
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
