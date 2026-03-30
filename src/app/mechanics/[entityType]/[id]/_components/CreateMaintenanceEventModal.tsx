"use client";

import type { Dispatch, SetStateAction } from "react";

type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type EventSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type EventStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED";

type FaultCodeRow = {
  id: string;
  code: string;
  system: string | null;
  titleEs: string;
  descriptionEs: string | null;
  likelyCausesEs: string | null;
  recommendedActionEs: string | null;
  severityHint: string | null;
  source: string | null;
};

type SparePartRow = {
  id: string;
  name: string;
  unit: string | null;
  stockQty: number;
  costPerUnitCents: number | null;
};

type PartUsageDraft = {
  sparePartId: string;
  qty: string;
  unitCostCents: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  modalError: string | null;
  eventType: MaintenanceEventType;
  setEventType: Dispatch<SetStateAction<MaintenanceEventType>>;
  eventTypeLabel: Record<MaintenanceEventType, string>;
  hoursAtService: string;
  setHoursAtService: Dispatch<SetStateAction<string>>;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  severity: EventSeverity;
  setSeverity: Dispatch<SetStateAction<EventSeverity>>;
  severityLabel: Record<EventSeverity, string>;
  eventStatus: EventStatus;
  setEventStatus: Dispatch<SetStateAction<EventStatus>>;
  statusLabel: Record<EventStatus, string>;
  supplierName: string;
  setSupplierName: Dispatch<SetStateAction<string>>;
  externalWorkshop: boolean;
  setExternalWorkshop: Dispatch<SetStateAction<boolean>>;
  costCents: string;
  setCostCents: Dispatch<SetStateAction<string>>;
  laborCostCents: string;
  setLaborCostCents: Dispatch<SetStateAction<string>>;
  partsCostCents: string;
  setPartsCostCents: Dispatch<SetStateAction<string>>;
  faultCode: string;
  setFaultCode: Dispatch<SetStateAction<string>>;
  faultCodeOptions: FaultCodeRow[];
  faultCodeLoading: boolean;
  faultCodeLookupError: string | null;
  selectedFaultCode: FaultCodeRow | null;
  normalizedFaultCode: string;
  exactFaultCodeMatch: FaultCodeRow | null;
  resolvedAt: string;
  setResolvedAt: Dispatch<SetStateAction<string>>;
  parts: SparePartRow[];
  partsUsed: PartUsageDraft[];
  setPartsUsed: Dispatch<SetStateAction<PartUsageDraft[]>>;
  applyToEntity: boolean;
  setApplyToEntity: Dispatch<SetStateAction<boolean>>;
  affectsOperability: boolean;
  setAffectsOperability: Dispatch<SetStateAction<boolean>>;
  operabilityOnOpen: string;
  setOperabilityOnOpen: Dispatch<SetStateAction<string>>;
  operabilityOnResolved: string;
  setOperabilityOnResolved: Dispatch<SetStateAction<string>>;
  onClose: () => void;
  onSubmit: () => void;
};

export default function CreateMaintenanceEventModal({
  open,
  busy,
  modalError,
  eventType,
  setEventType,
  eventTypeLabel,
  hoursAtService,
  setHoursAtService,
  note,
  setNote,
  severity,
  setSeverity,
  severityLabel,
  eventStatus,
  setEventStatus,
  statusLabel,
  supplierName,
  setSupplierName,
  externalWorkshop,
  setExternalWorkshop,
  costCents,
  setCostCents,
  laborCostCents,
  setLaborCostCents,
  partsCostCents,
  setPartsCostCents,
  faultCode,
  setFaultCode,
  faultCodeOptions,
  faultCodeLoading,
  faultCodeLookupError,
  selectedFaultCode,
  normalizedFaultCode,
  exactFaultCodeMatch,
  resolvedAt,
  setResolvedAt,
  parts,
  partsUsed,
  setPartsUsed,
  applyToEntity,
  setApplyToEntity,
  affectsOperability,
  setAffectsOperability,
  operabilityOnOpen,
  setOperabilityOnOpen,
  operabilityOnResolved,
  setOperabilityOnResolved,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
      onClick={() => (busy ? null : onClose())}
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: 18,
          border: "1px solid #dbe4ea",
          padding: 14,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Crear evento técnico</div>
          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 900,
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo de evento
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as MaintenanceEventType)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              {Object.entries(eventTypeLabel).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Horas en el momento del evento
            <input
              value={hoursAtService}
              onChange={(e) => setHoursAtService(e.target.value)}
              placeholder="Vacío = currentHours"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: "1 / -1" }}>
            Nota
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Severidad
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as EventSeverity)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              >
                {Object.entries(severityLabel).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Estado
              <select
                value={eventStatus}
                onChange={(e) => setEventStatus(e.target.value as EventStatus)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              >
                {Object.entries(statusLabel).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Proveedor / taller
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej: Mecánico Escala"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={externalWorkshop}
                onChange={(e) => setExternalWorkshop(e.target.checked)}
              />
              Taller externo
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Coste total (céntimos)
              <input
                value={costCents}
                onChange={(e) => setCostCents(e.target.value)}
                placeholder="Ej: 13800"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Mano de obra (céntimos)
              <input
                value={laborCostCents}
                onChange={(e) => setLaborCostCents(e.target.value)}
                placeholder="Ej: 12000"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Coste piezas (céntimos)
              <input
                value={partsCostCents}
                onChange={(e) => setPartsCostCents(e.target.value)}
                placeholder="Ej: 1800"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Código de avería
              <input
                value={faultCode}
                onChange={(e) => setFaultCode(e.target.value.toUpperCase())}
                placeholder="Ej: P0562 / P0122 / U0129"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>Ayuda de código de avería</div>

              {!faultCode.trim() ? (
                <div style={{ fontSize: 13, opacity: 0.72 }}>
                  Escribe un código para ver su descripción, causas probables y acción recomendada.
                </div>
              ) : faultCodeLoading ? (
                <div style={{ fontSize: 13, opacity: 0.72 }}>Buscando código...</div>
              ) : faultCodeLookupError ? (
                <div style={{ fontSize: 13, color: "#991b1b", fontWeight: 900 }}>
                  {faultCodeLookupError}
                </div>
              ) : selectedFaultCode ? (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ fontWeight: 950 }}>{selectedFaultCode.code}</div>
                    {selectedFaultCode.system ? (
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {selectedFaultCode.system}
                      </div>
                    ) : null}
                    {selectedFaultCode.severityHint ? (
                      <div
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Severidad sugerida: {selectedFaultCode.severityHint}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ fontSize: 13 }}>
                    <b>{selectedFaultCode.titleEs}</b>
                  </div>

                  {selectedFaultCode.descriptionEs ? (
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      <b>Descripción:</b> {selectedFaultCode.descriptionEs}
                    </div>
                  ) : null}

                  {selectedFaultCode.likelyCausesEs ? (
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      <b>Causas probables:</b> {selectedFaultCode.likelyCausesEs}
                    </div>
                  ) : null}

                  {selectedFaultCode.recommendedActionEs ? (
                    <div style={{ fontSize: 13, opacity: 0.9 }}>
                      <b>Acción recomendada:</b> {selectedFaultCode.recommendedActionEs}
                    </div>
                  ) : null}

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {selectedFaultCode.source ? `Fuente: ${selectedFaultCode.source}` : "Fuente no indicada"}
                  </div>

                  {faultCodeOptions.length > 1 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 900 }}>Coincidencias</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {faultCodeOptions.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setFaultCode(row.code)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              border:
                                row.code === selectedFaultCode.code
                                  ? "1px solid #111"
                                  : "1px solid #e5e7eb",
                              background: row.code === selectedFaultCode.code ? "#111" : "#fff",
                              color: row.code === selectedFaultCode.code ? "#fff" : "#111",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {row.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ fontSize: 13, opacity: 0.72 }}>
                  No hay coincidencias en el catálogo para este código.
                </div>
              )}
            </div>

            {normalizedFaultCode ? (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 10,
                  border: exactFaultCodeMatch ? "1px solid #bbf7d0" : "1px solid #fde68a",
                  background: exactFaultCodeMatch ? "#f0fdf4" : "#fffbeb",
                  color: exactFaultCodeMatch ? "#166534" : "#92400e",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {exactFaultCodeMatch
                  ? "Código reconocido en catálogo."
                  : "Código no encontrado en catálogo. Se guardará como código libre."}
              </div>
            ) : null}

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Resuelto el
              <input
                type="datetime-local"
                value={resolvedAt}
                onChange={(e) => setResolvedAt(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
              />
            </label>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 8, overflow: "auto" }}>
            <div style={{ fontWeight: 900, fontSize: 13 }}>Piezas usadas</div>

            {partsUsed.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 2fr) minmax(90px, 110px) minmax(120px, 150px) auto",
                  gap: 8,
                  alignItems: "end",
                }}
              >
                <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  Recambio
                  <select
                    value={p.sparePartId}
                    onChange={(e) => {
                      const next = [...partsUsed];
                      next[idx].sparePartId = e.target.value;
                      const selected = parts.find((x) => x.id === e.target.value);
                      if (selected && !next[idx].unitCostCents) {
                        next[idx].unitCostCents =
                          selected.costPerUnitCents != null ? String(selected.costPerUnitCents) : "";
                      }
                      setPartsUsed(next);
                    }}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  >
                    <option value="">Selecciona recambio...</option>
                    {parts.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name} {sp.unit ? `· ${sp.unit}` : ""} · stock {sp.stockQty}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  Qty
                  <input
                    value={p.qty}
                    onChange={(e) => {
                      const next = [...partsUsed];
                      next[idx].qty = e.target.value;
                      setPartsUsed(next);
                    }}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  Coste unit. cént.
                  <input
                    value={p.unitCostCents}
                    onChange={(e) => {
                      const next = [...partsUsed];
                      next[idx].unitCostCents = e.target.value;
                      setPartsUsed(next);
                    }}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setPartsUsed(partsUsed.filter((_, i) => i !== idx))}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    fontWeight: 900,
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}

            <div>
              <button
                type="button"
                onClick={() =>
                  setPartsUsed([...partsUsed, { sparePartId: "", qty: "", unitCostCents: "" }])
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 900,
                }}
              >
                + Añadir pieza
              </button>
            </div>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={applyToEntity}
              onChange={(e) => setApplyToEntity(e.target.checked)}
            />
            Aplicar a la entidad
          </label>

          <div
            style={{
              border: "1px solid #e5e7eb",
              background: "#fafafa",
              borderRadius: 12,
              padding: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900 }}>Operatividad en Plataforma</div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={affectsOperability}
                onChange={(e) => setAffectsOperability(e.target.checked)}
              />
              Este evento afecta a la operatividad actual
            </label>

            {affectsOperability ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Estado al abrir/reabrir
                  <select
                    value={operabilityOnOpen}
                    onChange={(e) => setOperabilityOnOpen(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  >
                    <option value="">Selecciona...</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                    <option value="OPERATIONAL">OPERATIONAL</option>
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Estado al resolver
                  <select
                    value={operabilityOnResolved}
                    onChange={(e) => setOperabilityOnResolved(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                  >
                    <option value="">Selecciona...</option>
                    <option value="OPERATIONAL">OPERATIONAL</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {modalError ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              fontWeight: 900,
            }}
          >
            {modalError}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: busy ? "#9ca3af" : "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            {busy ? "Guardando..." : "Guardar evento"}
          </button>
        </div>
      </div>
    </div>
  );
}
