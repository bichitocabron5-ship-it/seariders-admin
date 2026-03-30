"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { RunOpen } from "../types/types";

type Assignment = RunOpen["assignments"][0];

export default function PlatformAssignmentActionsModal({
  open,
  busy,
  error,
  assignment,
  expectedEndLabel,
  onClose,
  onFinishWithoutIncident,
  onFinishWithIncident,
  onExtend,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  assignment: Assignment | null;
  expectedEndLabel: string;
  onClose: () => void;
  onFinishWithoutIncident: () => void;
  onFinishWithIncident: () => void;
  onExtend: (extraMinutes: number, serviceCode: string) => void;
}) {
  if (!open || !assignment) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={() => (busy ? null : onClose())}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={modalTitleStyle}>Acciones</div>
          <button type="button" onClick={() => (busy ? null : onClose())} style={modalCloseBtnStyle}>
            Cerrar
          </button>
        </div>

        <div style={metaGridStyle}>
          <div>
            <b>Assignment:</b> {assignment.id}
          </div>
          <div>
            <b>Fin previsto:</b> {expectedEndLabel}
          </div>
        </div>

        <div style={actionGridStyle}>
          <button type="button" disabled={busy} onClick={onFinishWithoutIncident} style={primaryActionBtnStyle}>
            Finalizar (sin incidencia)
          </button>

          <button type="button" disabled={busy} onClick={onFinishWithIncident} style={secondaryActionBtnStyle}>
            Finalizar (con incidencia)
          </button>

          <button type="button" disabled={busy} onClick={() => onExtend(20, "JETSKI_EXTRA_20")} style={secondaryActionBtnStyle}>
            +20 (jetski)
          </button>

          <button type="button" disabled={busy} onClick={() => onExtend(40, "JETSKI_EXTRA_40")} style={secondaryActionBtnStyle}>
            +40 (jetski)
          </button>

          <button type="button" disabled={busy} onClick={() => onExtend(60, "BOAT_EXTRA_60")} style={secondaryActionBtnStyle}>
            +60 (boat)
          </button>

          <button type="button" disabled={busy} onClick={() => onExtend(120, "BOAT_EXTRA_120")} style={secondaryActionBtnStyle}>
            +120 (boat)
          </button>
        </div>

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        <div style={helpTextStyle}>
          Nota: &quot;Finalizar con incidencia&quot; usa OTHER/LOW por defecto. Luego se puede ampliar a checklist completo.
        </div>
      </div>
    </div>
  );
}

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
};

const modalCardStyle: CSSProperties = {
  width: "min(720px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 14,
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
};

const modalTitleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 18,
};

const modalCloseBtnStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 10,
  padding: "6px 10px",
  fontWeight: 900,
};

const metaGridStyle: CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
  fontSize: 13,
  opacity: 0.85,
};

const actionGridStyle: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
};

const primaryActionBtnStyle: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
  width: "100%",
};

const secondaryActionBtnStyle: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  fontWeight: 950,
  width: "100%",
};

const errorBoxStyle: CSSProperties = {
  marginTop: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const helpTextStyle: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.7,
};
