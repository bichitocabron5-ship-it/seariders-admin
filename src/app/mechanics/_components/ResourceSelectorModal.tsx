"use client";

type MaintenanceEntityType = "JETSKI" | "ASSET";
type MaintenanceEventType =
  | "SERVICE"
  | "OIL_CHANGE"
  | "REPAIR"
  | "INSPECTION"
  | "INCIDENT_REVIEW"
  | "HOUR_ADJUSTMENT";

type JetskiOption = {
  id: string;
  number: number;
  plate: string | null;
  chassisNumber: string | null;
  model: string | null;
};

type AssetOption = {
  id: string;
  name: string;
  type: string;
  plate: string | null;
  chassisNumber: string | null;
  model: string | null;
};

export default function ResourceSelectorModal({
  open,
  entityType,
  entityId,
  eventType,
  jetskis,
  assets,
  eventTypeOptions,
  onClose,
  onEntityTypeChange,
  onEntityIdChange,
  onEventTypeChange,
  onOpenDetail,
}: {
  open: boolean;
  entityType: MaintenanceEntityType;
  entityId: string;
  eventType: MaintenanceEventType;
  jetskis: JetskiOption[];
  assets: AssetOption[];
  eventTypeOptions: Array<{ value: MaintenanceEventType; label: string }>;
  onClose: () => void;
  onEntityTypeChange: (value: MaintenanceEntityType) => void;
  onEntityIdChange: (value: string) => void;
  onEventTypeChange: (value: MaintenanceEventType) => void;
  onOpenDetail: () => void;
}) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        display: "grid",
        placeItems: "center",
        padding: 14,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          borderRadius: 18,
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          border: "1px solid #dbe4ea",
          padding: 14,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Seleccionar recurso</div>
          <button
            onClick={onClose}
            style={{ border: "1px solid #d0d9e4", background: "#fff", borderRadius: 12, padding: "8px 10px", fontWeight: 900 }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo de entidad
            <select
              value={entityType}
              onChange={(e) => onEntityTypeChange(e.target.value as MaintenanceEntityType)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
            >
              <option value="JETSKI">Jetski</option>
              <option value="ASSET">Asset</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Recurso
            {entityType === "JETSKI" ? (
              <select
                value={entityId}
                onChange={(e) => onEntityIdChange(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              >
                <option value="">Selecciona jetski...</option>
                {jetskis.map((jetski) => (
                  <option key={jetski.id} value={jetski.id}>
                    Moto {jetski.number}
                    {jetski.plate ? ` · ${jetski.plate}` : ""}
                    {jetski.chassisNumber ? ` · Bastidor ${jetski.chassisNumber}` : ""}
                    {jetski.model ? ` · ${jetski.model}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={entityId}
                onChange={(e) => onEntityIdChange(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
              >
                <option value="">Selecciona asset...</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name} · {asset.type}
                    {asset.plate ? ` · ${asset.plate}` : ""}
                    {asset.chassisNumber ? ` · Bastidor ${asset.chassisNumber}` : ""}
                    {asset.model ? ` · ${asset.model}` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo de evento
            <select
              value={eventType}
              onChange={(e) => onEventTypeChange(e.target.value as MaintenanceEventType)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #d0d9e4" }}
            >
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              gridColumn: "1 / -1",
              padding: 12,
              borderRadius: 14,
              border: "1px solid #d0d9e4",
              background: "#f9fafb",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            El formulario completo de evento se abrirá en la ficha técnica del recurso seleccionado.
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onOpenDetail}
            disabled={!entityId}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: !entityId ? "#9ca3af" : "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            Abrir ficha
          </button>
        </div>
      </div>
    </div>
  );
}
