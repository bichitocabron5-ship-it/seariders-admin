// src/app/store/create/components/contract-signature-modal.tsx
"use client";

import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

export function ContractSignatureModal({
  defaultSignerName,
  onClose,
  onSave,
}: {
  defaultSignerName: string;
  onClose: () => void;
  onSave: (args: { signerName: string; imageDataUrl: string }) => Promise<void>;
}) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    try {
      setError(null);

      if (!signerName.trim()) {
        setError("Nombre del firmante requerido");
        return;
      }

      if (!sigRef.current || sigRef.current.isEmpty()) {
        setError("La firma está vacía");
        return;
      }

      setBusy(true);

      const imageDataUrl = sigRef.current
        .getTrimmedCanvas()
        .toDataURL("image/png");

      await onSave({
        signerName: signerName.trim(),
        imageDataUrl,
      });

      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la firma");
    } finally {
      setBusy(false);
    }
  }

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
          width: "min(760px, 96vw)",
          background: "#fff",
          borderRadius: 16,
          padding: 16,
          display: "grid",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 900 }}>Firma del contrato</div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Nombre del firmante
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
        </label>

        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              width: 700,
              height: 220,
              style: {
                width: "100%",
                height: 220,
                display: "block",
                background: "#fff",
              },
            }}
          />
        </div>

        {error ? (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => sigRef.current?.clear()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {busy ? "Guardando..." : "Guardar firma"}
          </button>
        </div>
      </div>
    </div>
  );
}
