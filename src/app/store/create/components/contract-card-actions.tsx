"use client";

import type React from "react";

type ContractCardActionsProps = {
  saving: boolean;
  isUnder16: boolean;
  previewBusy: boolean;
  pdfBusy: boolean;
  canDownloadFinalPdf: boolean;
  actionRowStyle: React.CSSProperties;
  secondaryButtonStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  secondaryBtnStyle: React.CSSProperties;
  onSave: () => void;
  onMarkReady: () => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onDownloadFinalPdf: () => void;
};

export function ContractCardActions({
  saving,
  isUnder16,
  previewBusy,
  pdfBusy,
  canDownloadFinalPdf,
  actionRowStyle,
  secondaryButtonStyle,
  primaryButtonStyle,
  secondaryBtnStyle,
  onSave,
  onMarkReady,
  onPreview,
  onGeneratePdf,
  onDownloadFinalPdf,
}: ContractCardActionsProps) {
  return (
    <div style={actionRowStyle}>
      <button type="button" onClick={onSave} disabled={saving} style={{ ...secondaryButtonStyle, width: "100%" }}>
        {saving ? "Guardando..." : "Guardar"}
      </button>
      <button type="button" onClick={onMarkReady} disabled={saving || isUnder16} style={{ ...primaryButtonStyle, width: "100%", opacity: saving || isUnder16 ? 0.6 : 1 }} title={isUnder16 ? "No permitido <16" : ""}>
        Marcar READY
      </button>
      <button
        type="button"
        onClick={onPreview}
        style={{ ...secondaryBtnStyle, width: "100%" }}
        disabled={previewBusy || saving}
      >
        {previewBusy ? "Generando..." : "Vista previa"}
      </button>
      <button
        type="button"
        onClick={onGeneratePdf}
        style={{ ...secondaryBtnStyle, width: "100%" }}
        disabled={pdfBusy || saving}
      >
        {pdfBusy ? "Generando PDF..." : "Generar PDF"}
      </button>

      {canDownloadFinalPdf ? (
        <button type="button" onClick={onDownloadFinalPdf} style={{ ...secondaryBtnStyle, width: "100%" }}>
          Descargar PDF final
        </button>
      ) : (
        <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", minHeight: 42 }}>
          La descarga final se habilita cuando el contrato está firmado.
        </div>
      )}
    </div>
  );
}
