"use client";

import type React from "react";

type ContractCardActionsProps = {
  status: "DRAFT" | "READY" | "SIGNED" | "VOID";
  saving: boolean;
  isUnder16: boolean;
  previewBusy: boolean;
  pdfBusy: boolean;
  canDownloadFinalPdf: boolean;
  signerLinkBusy: boolean;
  actionRowStyle: React.CSSProperties;
  secondaryButtonStyle: React.CSSProperties;
  primaryButtonStyle: React.CSSProperties;
  secondaryBtnStyle: React.CSSProperties;
  onSave: () => void;
  onMarkReady: () => void;
  onPreview: () => void;
  onGeneratePdf: () => void;
  onDownloadFinalPdf: () => void;
  onOpenSignerLink: () => void;
};

export function ContractCardActions({
  status,
  saving,
  isUnder16,
  previewBusy,
  pdfBusy,
  canDownloadFinalPdf,
  signerLinkBusy,
  actionRowStyle,
  secondaryButtonStyle,
  primaryButtonStyle,
  secondaryBtnStyle,
  onSave,
  onMarkReady,
  onPreview,
  onGeneratePdf,
  onDownloadFinalPdf,
  onOpenSignerLink,
}: ContractCardActionsProps) {
  const isReady = status === "READY";

  return (
    <div style={actionRowStyle}>
      <button type="button" onClick={onSave} disabled={saving} style={{ ...secondaryButtonStyle, width: "100%" }}>
        {saving ? "Guardando..." : isReady ? "Actualizar datos" : "Guardar borrador"}
      </button>
      {!isReady ? (
        <button type="button" onClick={onMarkReady} disabled={saving || isUnder16} style={{ ...primaryButtonStyle, width: "100%", opacity: saving || isUnder16 ? 0.6 : 1 }} title={isUnder16 ? "No permitido <16" : ""}>
          Dejar listo para firma
        </button>
      ) : null}
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
      <button
        type="button"
        onClick={onOpenSignerLink}
        style={{ ...primaryButtonStyle, width: "100%" }}
        disabled={signerLinkBusy || saving}
      >
        {signerLinkBusy ? "Abriendo firma..." : isReady ? "Abrir firma" : "Guardar y abrir firma"}
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
