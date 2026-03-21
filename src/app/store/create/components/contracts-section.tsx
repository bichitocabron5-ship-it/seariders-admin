// src/app/store/create/components/contracts-section.tsx
"use client";

import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { ContractDraftState, ContractDto, ContractsState } from "../types";

type ContractsSectionProps = {
  reservationId: string | null;
  contracts: ContractDto[];
  contractsMeta: {
    reservationId: string;
    requiredUnits: number;
    readyCount: number;
    needsContracts: boolean;
    contractsState: ContractsState;
  } | null;
  contractDrafts: ContractDraftState;
  setContractDrafts: Dispatch<SetStateAction<ContractDraftState>>;
  contractsLoading: boolean;
  contractsBusy: boolean;
  contractsError: string | null;
  onRefresh: (reservationId: string) => Promise<void>;
  onSave: (contractId: string, reservationId: string) => Promise<void>;
  onReady: (contractId: string, reservationId: string) => Promise<void>;
  onDraft: (contractId: string, reservationId: string) => Promise<void>;
};

function badgeStyle(status: string): CSSProperties {
  if (status === "SIGNED") {
    return {
      padding: "4px 8px",
      borderRadius: 999,
      background: "#dcfce7",
      color: "#166534",
      fontSize: 12,
      fontWeight: 900,
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "READY") {
    return {
      padding: "4px 8px",
      borderRadius: 999,
      background: "#dbeafe",
      color: "#1d4ed8",
      fontSize: 12,
      fontWeight: 900,
      border: "1px solid #bfdbfe",
    };
  }

  if (status === "VOID") {
    return {
      padding: "4px 8px",
      borderRadius: 999,
      background: "#f3f4f6",
      color: "#4b5563",
      fontSize: 12,
      fontWeight: 900,
      border: "1px solid #e5e7eb",
    };
  }

  return {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #fed7aa",
  };
}

function stateLabel(state: ContractsState | null | undefined) {
  if (state === "OK") return "Completos";
  if (state === "PARTIAL") return "Parcial";
  if (state === "MISSING") return "Faltan";
  return "Sin contratos";
}

export function ContractsSection(props: ContractsSectionProps) {
  const {
    reservationId,
    contracts,
    contractsMeta,
    contractDrafts,
    setContractDrafts,
    contractsLoading,
    contractsBusy,
    contractsError,
    onRefresh,
    onSave,
    onReady,
    onDraft,
  } = props;

  const canUse = Boolean(reservationId);

  return (
    <section
      id="contracts"
      style={{
        border: "1px solid #dde4ee",
        borderRadius: 18,
        background: "#fff",
        padding: 16,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 950, fontSize: 22 }}>Contratos</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Edición por contrato, estado y preparación para firma.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!canUse || contractsBusy || contractsLoading}
            onClick={() => reservationId ? onRefresh(reservationId) : undefined}
            style={secondaryBtn}
          >
            {contractsBusy || contractsLoading ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {!reservationId ? (
        <div style={warnBox}>
          Guarda o formaliza la reserva para gestionar contratos.
        </div>
      ) : null}

      {contractsMeta ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <div style={miniCard}>
            <div style={miniLabel}>Contratos requeridos</div>
            <div style={miniValue}>{contractsMeta.requiredUnits}</div>
          </div>

          <div style={miniCard}>
            <div style={miniLabel}>Listos / firmados</div>
            <div style={miniValue}>
              {contractsMeta.readyCount}/{contractsMeta.requiredUnits}
            </div>
          </div>

          <div style={miniCard}>
            <div style={miniLabel}>Estado global</div>
            <div style={miniValue}>{stateLabel(contractsMeta.contractsState)}</div>
          </div>
        </div>
      ) : null}

      {contractsError ? (
        <div style={errorBox}>{contractsError}</div>
      ) : null}

      {canUse && contracts.length === 0 && !contractsLoading ? (
        <div style={warnBox}>No hay contratos para esta reserva todavía.</div>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {contracts.map((contract) => {
          const d = contractDrafts[contract.id];
          if (!d) return null;

          return (
            <div
              key={contract.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#fafafa",
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    Contrato #{contract.unitIndex}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    ID: {contract.id}
                  </div>
                </div>

                <div style={badgeStyle(contract.status)}>
                  {contract.status}
                </div>
              </div>

              <div style={grid2}>
                <Field label="Nombre conductor">
                  <input
                    value={d.driverName}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverName: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Teléfono">
                  <input
                    value={d.driverPhone}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverPhone: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Email">
                  <input
                    value={d.driverEmail}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverEmail: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="País">
                  <input
                    value={d.driverCountry}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverCountry: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Documento tipo">
                  <input
                    value={d.driverDocType}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverDocType: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Documento número">
                  <input
                    value={d.driverDocNumber}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverDocNumber: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Fecha nacimiento">
                  <input
                    type="date"
                    value={d.driverBirthDate}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverBirthDate: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Código postal">
                  <input
                    value={d.driverPostalCode}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverPostalCode: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Dirección" full>
                  <input
                    value={d.driverAddress}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], driverAddress: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Escuela licencia">
                  <input
                    value={d.licenseSchool}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], licenseSchool: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Tipo licencia">
                  <input
                    value={d.licenseType}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], licenseType: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Número licencia">
                  <input
                    value={d.licenseNumber}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: { ...prev[contract.id], licenseNumber: e.target.value },
                      }))
                    }
                    style={inputStyle}
                  />
                </Field>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    marginTop: 22,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={d.minorAuthorizationProvided}
                    onChange={(e) =>
                      setContractDrafts((prev) => ({
                        ...prev,
                        [contract.id]: {
                          ...prev[contract.id],
                          minorAuthorizationProvided: e.target.checked,
                        },
                      }))
                    }
                  />
                  Autorización de menor aportada
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={!reservationId || contractsBusy}
                  onClick={() => reservationId ? onSave(contract.id, reservationId) : undefined}
                  style={secondaryBtn}
                >
                  Guardar
                </button>

                {contract.status !== "READY" ? (
                  <button
                    type="button"
                    disabled={!reservationId || contractsBusy}
                    onClick={() => reservationId ? onReady(contract.id, reservationId) : undefined}
                    style={primaryBtn}
                  >
                    Marcar READY
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!reservationId || contractsBusy}
                    onClick={() => reservationId ? onDraft(contract.id, reservationId) : undefined}
                    style={secondaryBtn}
                  >
                    Volver a DRAFT
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  const { label, children, full = false } = props;

  return (
    <label
      style={{
        display: "grid",
        gap: 6,
        fontSize: 13,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <span style={{ fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
}

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const inputStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #d0d9e4",
  background: "#fff",
};

const miniCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

const miniLabel: CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  fontWeight: 800,
};

const miniValue: CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 950,
};

const warnBox: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
};

const secondaryBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};