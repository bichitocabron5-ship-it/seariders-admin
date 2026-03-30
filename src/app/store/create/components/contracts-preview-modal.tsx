"use client";

import type React from "react";

import { opsStyles } from "@/components/ops-ui";

import type { ContractDto } from "../types";
import { ContractSignatureModal } from "./contract-signature-modal";

type ContractsPreviewModalProps = {
  previewHtml: string | null;
  previewContractId: string | null;
  previewContract: ContractDto | null;
  signBusy: boolean;
  signatureContract: ContractDto | null;
  customerName: string;
  onClosePreview: () => void;
  onSignPreview: () => Promise<void>;
  onOpenSignature: (contract: ContractDto) => void;
  onCloseSignature: () => void;
  onSaveSignature: (args: { signerName: string; imageDataUrl: string }) => Promise<void>;
};

const secondaryBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
};

const primaryBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
};

const actionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  alignItems: "stretch",
};

export function ContractsPreviewModal({
  previewHtml,
  previewContractId,
  previewContract,
  signBusy,
  signatureContract,
  customerName,
  onClosePreview,
  onSignPreview,
  onOpenSignature,
  onCloseSignature,
  onSaveSignature,
}: ContractsPreviewModalProps) {
  return (
    <>
      {previewHtml ? (
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
          onClick={onClosePreview}
        >
          <div
            style={{
              width: "min(1100px, 96vw)",
              height: "min(90vh, 900px)",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 14,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>Vista previa del contrato</div>

              <div style={{ ...actionRowStyle, width: "min(100%, 560px)" }}>
                <button
                  type="button"
                  onClick={() => void onSignPreview()}
                  style={{ ...primaryBtn, width: "100%" }}
                  disabled={!previewContractId || signBusy || previewContract?.status === "SIGNED"}
                >
                  {signBusy ? "Firmando..." : "Marcar SIGNED"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (previewContract) onOpenSignature(previewContract);
                  }}
                  style={{ ...secondaryBtn, width: "100%" }}
                  disabled={!previewContract}
                >
                  {previewContract?.status === "SIGNED" ? "Reemplazar firma" : "Firmar"}
                </button>

                <button type="button" onClick={onClosePreview} style={{ ...secondaryBtn, width: "100%" }}>
                  Cerrar
                </button>
              </div>
            </div>

            <iframe
              title="Vista previa contrato"
              srcDoc={previewHtml}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "#fff",
              }}
            />
          </div>
        </div>
      ) : null}

      {signatureContract ? (
        <ContractSignatureModal
          defaultSignerName={signatureContract.driverName || customerName || ""}
          onClose={onCloseSignature}
          onSave={onSaveSignature}
        />
      ) : null}
    </>
  );
}
