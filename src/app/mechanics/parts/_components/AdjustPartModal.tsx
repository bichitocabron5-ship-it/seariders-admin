// src/app/mechanics/parts/_components/AdjustPartModal.tsx
"use client";

import { useState } from "react";
import type { PartRow } from "./types";
import {
  errorBox,
  ghostBtn,
  modalGrid2,
  ModalShell,
  primaryBtn,
  Field,
  inputStyle,
  sectionCard,
} from "./ui";

export default function AdjustPartModal({
  part,
  onClose,
  onSaved,
}: {
  part: PartRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      const parsedQty = Number(qty);

      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        throw new Error("La cantidad debe ser mayor que 0.");
      }

      if (!note.trim()) {
        throw new Error("Debes indicar el motivo del ajuste.");
      }

      const res = await fetch("/api/mechanics/parts/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sparePartId: part.id,
          direction,
          qty: parsedQty,
          note: note || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error ajustando stock");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Ajustar · ${part.name}`} onClose={onClose}>
      <div style={sectionCard}>
        <div style={modalGrid2}>
          <Field label="Dirección">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}
              style={inputStyle}
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
            </select>
          </Field>

          <Field label="Cantidad">
            <input value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle} />
          </Field>
        </div>
      </div>

      <Field label="Motivo / nota">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={inputStyle} />
      </Field>

      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={ghostBtn}>
          Cerrar
        </button>
        <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
          {busy ? "Guardando..." : "Guardar ajuste"}
        </button>
      </div>
    </ModalShell>
  );
}
