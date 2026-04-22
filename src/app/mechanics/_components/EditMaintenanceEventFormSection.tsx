"use client";

type MaintenanceStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "EXTERNAL" | "CANCELED";
type MaintenanceSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Props = {
  status: MaintenanceStatus;
  severity: MaintenanceSeverity;
  supplierName: string;
  resolvedAt: string;
  costCents: string;
  laborCostCents: string;
  partsCostCents: string;
  faultCode: string;
  externalWorkshop: boolean;
  affectsOperability: boolean;
  operabilityOnOpen: string;
  operabilityOnResolved: string;
  note: string;
  inputStyle: React.CSSProperties;
  onStatusChange: (value: MaintenanceStatus) => void;
  onSeverityChange: (value: MaintenanceSeverity) => void;
  onSupplierNameChange: (value: string) => void;
  onResolvedAtChange: (value: string) => void;
  onCostCentsChange: (value: string) => void;
  onLaborCostCentsChange: (value: string) => void;
  onPartsCostCentsChange: (value: string) => void;
  onFaultCodeChange: (value: string) => void;
  onExternalWorkshopChange: (value: boolean) => void;
  onAffectsOperabilityChange: (value: boolean) => void;
  onOperabilityOnOpenChange: (value: string) => void;
  onOperabilityOnResolvedChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  statusLabel: (value: MaintenanceStatus) => string;
  severityLabel: (value: MaintenanceSeverity) => string;
};

export default function EditMaintenanceEventFormSection({
  status,
  severity,
  supplierName,
  resolvedAt,
  costCents,
  laborCostCents,
  partsCostCents,
  faultCode,
  externalWorkshop,
  affectsOperability,
  operabilityOnOpen,
  operabilityOnResolved,
  note,
  inputStyle,
  onStatusChange,
  onSeverityChange,
  onSupplierNameChange,
  onResolvedAtChange,
  onCostCentsChange,
  onLaborCostCentsChange,
  onPartsCostCentsChange,
  onFaultCodeChange,
  onExternalWorkshopChange,
  onAffectsOperabilityChange,
  onOperabilityOnOpenChange,
  onOperabilityOnResolvedChange,
  onNoteChange,
  statusLabel,
  severityLabel,
}: Props) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <Field label="Estado">
          <select value={status} onChange={(e) => onStatusChange(e.target.value as MaintenanceStatus)} style={inputStyle}>
            <option value="OPEN">{statusLabel("OPEN")}</option>
            <option value="IN_PROGRESS">{statusLabel("IN_PROGRESS")}</option>
            <option value="RESOLVED">{statusLabel("RESOLVED")}</option>
            <option value="EXTERNAL">{statusLabel("EXTERNAL")}</option>
            <option value="CANCELED">{statusLabel("CANCELED")}</option>
          </select>
        </Field>

        <Field label="Severidad">
          <select value={severity} onChange={(e) => onSeverityChange(e.target.value as MaintenanceSeverity)} style={inputStyle}>
            <option value="LOW">{severityLabel("LOW")}</option>
            <option value="MEDIUM">{severityLabel("MEDIUM")}</option>
            <option value="HIGH">{severityLabel("HIGH")}</option>
            <option value="CRITICAL">{severityLabel("CRITICAL")}</option>
          </select>
        </Field>

        <Field label="Proveedor / taller">
          <input value={supplierName} onChange={(e) => onSupplierNameChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Resuelto el">
          <input type="datetime-local" value={resolvedAt} onChange={(e) => onResolvedAtChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Coste total (céntimos)">
          <input value={costCents} onChange={(e) => onCostCentsChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Mano de obra (céntimos)">
          <input value={laborCostCents} onChange={(e) => onLaborCostCentsChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Piezas (céntimos)">
          <input value={partsCostCents} onChange={(e) => onPartsCostCentsChange(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Códigos de avería">
          <input
            value={faultCode}
            onChange={(e) => onFaultCodeChange(e.target.value)}
            placeholder="Ej: P0562, P0122, U0129"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Taller externo">
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 42 }}>
          <input type="checkbox" checked={externalWorkshop} onChange={(e) => onExternalWorkshopChange(e.target.checked)} />
          <span>Sí</span>
        </label>
      </Field>

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

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={affectsOperability} onChange={(e) => onAffectsOperabilityChange(e.target.checked)} />
          Este evento afecta a la operatividad de la unidad
        </label>

        {affectsOperability ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <Field label="Estado al abrir/reabrir">
              <select value={operabilityOnOpen} onChange={(e) => onOperabilityOnOpenChange(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
                <option value="OPERATIONAL">OPERATIONAL</option>
              </select>
            </Field>

            <Field label="Estado al resolver">
              <select value={operabilityOnResolved} onChange={(e) => onOperabilityOnResolvedChange(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar</option>
                <option value="OPERATIONAL">OPERATIONAL</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
              </select>
            </Field>
          </div>
        ) : null}
      </div>

      <Field label="Nota">
        <textarea value={note} onChange={(e) => onNoteChange(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}
