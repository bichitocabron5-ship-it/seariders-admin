"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { MonitorRunKind, RunOpen } from "../types/types";

type IncidentLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type IncidentType = "ACCIDENT" | "DAMAGE" | "MECHANICAL" | "OTHER";
type IncidentOperabilityStatus = "" | "OPERATIONAL" | "MAINTENANCE" | "DAMAGED" | "OUT_OF_SERVICE";

type Assignment = RunOpen["assignments"][0];

export default function PlatformIncidentModal({
  open,
  busy,
  error,
  kind,
  assignment,
  incidentType,
  incidentLevel,
  incidentTitle,
  incidentDescription,
  incidentNotes,
  incidentAffectsOperability,
  incidentOperabilityStatus,
  incidentRetainDeposit,
  incidentRetainDepositCents,
  incidentCreateMaintenanceEvent,
  onClose,
  onSubmit,
  onIncidentTypeChange,
  onIncidentLevelChange,
  onIncidentTitleChange,
  onIncidentDescriptionChange,
  onIncidentNotesChange,
  onIncidentAffectsOperabilityChange,
  onIncidentOperabilityStatusChange,
  onIncidentRetainDepositChange,
  onIncidentRetainDepositCentsChange,
  onIncidentCreateMaintenanceEventChange,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  kind: MonitorRunKind;
  assignment: Assignment | null;
  incidentType: IncidentType;
  incidentLevel: IncidentLevel;
  incidentTitle: string;
  incidentDescription: string;
  incidentNotes: string;
  incidentAffectsOperability: boolean;
  incidentOperabilityStatus: IncidentOperabilityStatus;
  incidentRetainDeposit: boolean;
  incidentRetainDepositCents: string;
  incidentCreateMaintenanceEvent: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onIncidentTypeChange: (value: IncidentType) => void;
  onIncidentLevelChange: (value: IncidentLevel) => void;
  onIncidentTitleChange: (value: string) => void;
  onIncidentDescriptionChange: (value: string) => void;
  onIncidentNotesChange: (value: string) => void;
  onIncidentAffectsOperabilityChange: (value: boolean) => void;
  onIncidentOperabilityStatusChange: (value: IncidentOperabilityStatus) => void;
  onIncidentRetainDepositChange: (value: boolean) => void;
  onIncidentRetainDepositCentsChange: (value: string) => void;
  onIncidentCreateMaintenanceEventChange: (value: boolean) => void;
}) {
  if (!open || !assignment) {
    return null;
  }

  return (
    <div style={modalOverlayStyle} onClick={() => (busy ? null : onClose())}>
      <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={modalTitleStyle}>Registrar incidencia</div>
          <button type="button" onClick={() => (busy ? null : onClose())} style={modalCloseBtnStyle}>
            Cerrar
          </button>
        </div>

        <div style={detailsGridStyle}>
          <div>
            <b>Assignment:</b> {assignment.id}
          </div>
          <div>
            <b>Cliente:</b> {assignment.reservation?.customerName || "Cliente"}
          </div>
          <div>
            <b>Unidad:</b>{" "}
            {kind === "JETSKI"
              ? assignment.jetski?.number
                ? `Moto ${assignment.jetski.number}`
                : "Moto"
              : assignment.asset?.name || "Recurso"}
          </div>
        </div>

        <div style={twoColumnGridStyle}>
          <label style={fieldGroupStyle}>
            Tipo
            <select value={incidentType} onChange={(e) => onIncidentTypeChange(e.target.value as IncidentType)} style={fieldInputStyle}>
              <option value="ACCIDENT">Accidente</option>
              <option value="DAMAGE">Daño</option>
              <option value="MECHANICAL">Mecánica</option>
              <option value="OTHER">Otra</option>
            </select>
          </label>

          <label style={fieldGroupStyle}>
            Nivel
            <select value={incidentLevel} onChange={(e) => onIncidentLevelChange(e.target.value as IncidentLevel)} style={fieldInputStyle}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="CRITICAL">Crítica</option>
            </select>
          </label>
        </div>

        <label style={fieldGroupStyle}>
          Título corto
          <input
            value={incidentTitle}
            onChange={(e) => onIncidentTitleChange(e.target.value)}
            placeholder="Ej: golpe lateral, pérdida de potencia..."
            style={fieldInputStyle}
          />
        </label>

        <label style={fieldGroupStyle}>
          Descripción
          <textarea
            value={incidentDescription}
            onChange={(e) => onIncidentDescriptionChange(e.target.value)}
            rows={3}
            placeholder="Describe lo ocurrido..."
            style={textAreaStyle}
          />
        </label>

        <label style={fieldGroupStyle}>
          Notas operativas
          <textarea
            value={incidentNotes}
            onChange={(e) => onIncidentNotesChange(e.target.value)}
            rows={3}
            placeholder="Observaciones del monitor o de plataforma..."
            style={textAreaStyle}
          />
        </label>

        <div style={softPanelStyle}>
          <div style={panelTitleStyle}>Operatividad</div>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={incidentAffectsOperability}
              onChange={(e) => onIncidentAffectsOperabilityChange(e.target.checked)}
            />
            Esta incidencia afecta a la operatividad
          </label>

          <label style={fieldGroupStyle}>
            Estado tras incidencia
            <select
              value={incidentOperabilityStatus}
              onChange={(e) => onIncidentOperabilityStatusChange(e.target.value as IncidentOperabilityStatus)}
              disabled={!incidentAffectsOperability}
              style={fieldInputStyle}
            >
              <option value="">Selecciona...</option>
              <option value="OPERATIONAL">Operativa</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="DAMAGED">Dañada</option>
              <option value="OUT_OF_SERVICE">Fuera de servicio</option>
            </select>
          </label>
        </div>

        <div style={softPanelStyle}>
          <div style={panelTitleStyle}>Fianza</div>

          <label style={checkboxRowStyle}>
            <input type="checkbox" checked={incidentRetainDeposit} onChange={(e) => onIncidentRetainDepositChange(e.target.checked)} />
            Retener fianza
          </label>

          <label style={fieldGroupStyle}>
            Importe retenido (céntimos)
            <input
              value={incidentRetainDepositCents}
              onChange={(e) => onIncidentRetainDepositCentsChange(e.target.value)}
              disabled={!incidentRetainDeposit}
              inputMode="numeric"
              placeholder="Ej: 15000"
              style={fieldInputStyle}
            />
          </label>
        </div>

        <div style={softPanelStyle}>
          <div style={panelTitleStyle}>Mecánica</div>

          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={incidentCreateMaintenanceEvent}
              onChange={(e) => onIncidentCreateMaintenanceEventChange(e.target.checked)}
            />
            Crear evento técnico automáticamente
          </label>
        </div>

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        <div style={actionGridStyle}>
          <button type="button" onClick={() => (busy ? null : onClose())} style={secondaryActionBtnStyle}>
            Cancelar
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            style={{ ...primaryActionBtnStyle, background: busy ? "#9ca3af" : primaryActionBtnStyle.background }}
          >
            {busy ? "Guardando..." : "Finalizar con incidencia"}
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
  zIndex: 60,
};

const modalCardStyle: CSSProperties = {
  width: "min(900px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  padding: 16,
  display: "grid",
  gap: 12,
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const modalTitleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
};

const modalCloseBtnStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 10,
  padding: "6px 10px",
  fontWeight: 900,
};

const detailsGridStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  opacity: 0.85,
};

const twoColumnGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
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

const textAreaStyle: CSSProperties = {
  ...fieldInputStyle,
  resize: "vertical",
};

const softPanelStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fafafa",
  display: "grid",
  gap: 10,
};

const panelTitleStyle: CSSProperties = {
  fontWeight: 900,
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontSize: 13,
};

const errorBoxStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
};

const secondaryActionBtnStyle: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  fontWeight: 950,
  width: "100%",
};

const primaryActionBtnStyle: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
  width: "100%",
};
