"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { MonitorRunKind } from "../types/types";

type AssignRunOption = {
  id: string;
  label: string;
};

type AssignResourceOption = {
  id: string;
  label: string;
};

type AssignTarget = {
  customerName: string | null;
  serviceName: string | null;
};

export default function PlatformAssignModal({
  open,
  busy,
  error,
  kind,
  target,
  runId,
  resourceId,
  runOptions,
  resourceOptions,
  onClose,
  onRunChange,
  onResourceChange,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  kind: MonitorRunKind;
  target: AssignTarget | null;
  runId: string;
  resourceId: string;
  runOptions: AssignRunOption[];
  resourceOptions: AssignResourceOption[];
  onClose: () => void;
  onRunChange: (value: string) => void;
  onResourceChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={() => (busy ? null : onClose())}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={modalTitleStyle}>Asignar a salida</div>
          <button type="button" onClick={() => (busy ? null : onClose())} style={modalCloseBtnStyle}>
            Cerrar
          </button>
        </div>

        <div style={metaTextStyle}>
          {target?.customerName || "Cliente"} | {target?.serviceName || "Servicio"}
        </div>

        <div style={fieldsGridStyle}>
          <label style={fieldGroupStyle}>
            Monitor / Salida
            <select value={runId} onChange={(e) => onRunChange(e.target.value)} style={fieldInputStyle}>
              <option value="">Selecciona...</option>
              {runOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldGroupStyle}>
            {kind === "JETSKI" ? "Moto" : "Recurso"}
            <select value={resourceId} onChange={(e) => onResourceChange(e.target.value)} style={fieldInputStyle}>
              <option value="">Selecciona...</option>
              {resourceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        <div style={actionGridStyle}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            style={{ ...primaryActionBtnStyle, background: busy ? "#9ca3af" : primaryActionBtnStyle.background }}
          >
            {busy ? "Asignando..." : "Asignar"}
          </button>
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

const metaTextStyle: CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  opacity: 0.8,
};

const fieldsGridStyle: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const fieldGroupStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
};

const fieldInputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
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
