"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

type ContractView = {
  id: string;
  unitIndex: number;
  status: string;
  driverName: string;
  signatureSignedBy: string;
  signedAt: string | null;
  reservationId: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number | null;
  activityDate: string;
  renderedHtml: string;
};

export function SignContractPageClient({
  token,
  contract,
}: {
  token: string;
  contract: ContractView;
}) {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [signerName, setSignerName] = useState(contract.driverName || contract.customerName || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(contract.status === "SIGNED");
  const [confirmedRead, setConfirmedRead] = useState(contract.status === "SIGNED");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    try {
      setError(null);
      if (!confirmedRead) throw new Error("Debes leer y aceptar el contrato antes de firmar");
      if (!signerName.trim()) throw new Error("Nombre del firmante requerido");
      if (!sigRef.current || sigRef.current.isEmpty()) throw new Error("La firma esta vacia");

      setBusy(true);
      const imageDataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
      const res = await fetch(`/api/sign/contracts/${encodeURIComponent(token)}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          imageDataUrl,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la firma");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <section
        style={{
          width: "min(980px, 100%)",
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #e2e8f0",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>
            Firma digital
          </div>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>Contrato unidad #{contract.unitIndex}</h1>
          <div style={{ fontSize: 14, color: "#475569" }}>
            {contract.serviceName}
            {contract.durationMinutes ? ` · ${contract.durationMinutes} min` : ""}
            {contract.customerName ? ` · ${contract.customerName}` : ""}
          </div>
        </div>

        {done ? (
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 900 }}>
            Contrato firmado correctamente. Puedes descargar la copia en PDF o volver al punto de venta.
          </div>
        ) : (
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>
            Revisa el contrato completo antes de firmar. Cuando lo hayas leido, confirma la lectura y firma al final.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={`/api/sign/contracts/${encodeURIComponent(token)}/pdf`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 900,
              textDecoration: "none",
            }}
          >
            Descargar PDF
          </a>
        </div>

        <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <iframe
            title={`Contrato ${contract.unitIndex}`}
            srcDoc={contract.renderedHtml}
            style={{
              width: "100%",
              height: "min(70vh, 980px)",
              border: 0,
              display: "block",
              background: "#fff",
            }}
          />
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          <input
            type="checkbox"
            checked={confirmedRead}
            onChange={(e) => setConfirmedRead(e.target.checked)}
            disabled={done}
            style={{ marginTop: 2 }}
          />
          <span>He leido el contrato completo y acepto firmarlo electronicamente.</span>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          Nombre del firmante
          <input
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={done}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 16 }}
          />
        </label>

        <div style={{ border: "1px solid #cbd5e1", borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <SignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{
              width: 900,
              height: 280,
              style: {
                width: "100%",
                height: 280,
                display: "block",
                background: "#fff",
                touchAction: "none",
              },
            }}
          />
        </div>

        {error ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 700 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            type="button"
            onClick={() => sigRef.current?.clear()}
            disabled={busy || done}
            style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900 }}
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || done || !confirmedRead}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 900,
              opacity: busy || done || !confirmedRead ? 0.7 : 1,
            }}
          >
            {busy ? "Guardando..." : done ? "Firmado" : "Firmar contrato"}
          </button>
        </div>
      </section>
    </main>
  );
}
