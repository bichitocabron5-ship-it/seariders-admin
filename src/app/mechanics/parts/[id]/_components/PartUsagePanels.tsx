"use client";

import type { CSSProperties } from "react";

type MovementType =
  | "PURCHASE"
  | "CONSUMPTION"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "INITIAL_STOCK"
  | "RETURN";

type PartDetail = {
  sku: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  supplierName: string | null;
  createdAt: string;
  updatedAt: string;
  movements: Array<{
    id: string;
    type: MovementType;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    note: string | null;
    createdAt: string;
    vendor: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    expense: {
      id: string;
      status: string;
      totalCents: number | null;
      expenseDate: string;
    } | null;
    maintenanceEvent: {
      id: string;
      entityType: "JETSKI" | "ASSET";
      type: string;
      faultCode: string | null;
      createdAt: string;
      jetski: { id: string; number: number } | null;
      asset: { id: string; name: string; code: string | null } | null;
    } | null;
    createdByUser: {
      id: string;
      username: string | null;
      fullName: string | null;
      email: string | null;
    } | null;
  }>;
  maintenanceUsages: Array<{
    id: string;
    qty: number;
    unitCostCents: number | null;
    totalCostCents: number | null;
    createdAt: string;
    maintenanceEvent: {
      id: string;
      entityType: "JETSKI" | "ASSET";
      type: string;
      faultCode: string | null;
      createdAt: string;
      jetski: { id: string; number: number } | null;
      asset: { id: string; name: string; code: string | null } | null;
    };
  }>;
};

function eur(cents: number | null) {
  if (cents === null || cents === undefined) return "—";
  return `${(cents / 100).toFixed(2)} EUR`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function movementLabel(type: MovementType) {
  switch (type) {
    case "PURCHASE":
      return "Compra";
    case "CONSUMPTION":
      return "Consumo";
    case "ADJUSTMENT_IN":
      return "Ajuste +";
    case "ADJUSTMENT_OUT":
      return "Ajuste -";
    case "INITIAL_STOCK":
      return "Stock inicial";
    case "RETURN":
      return "Devolución";
    default:
      return type;
  }
}

function movementStyle(type: MovementType): CSSProperties {
  const base: CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
  };

  if (type === "PURCHASE" || type === "ADJUSTMENT_IN" || type === "INITIAL_STOCK" || type === "RETURN") {
    return { ...base, borderColor: "#bbf7d0", background: "#f0fdf4", color: "#166534" };
  }

  if (type === "CONSUMPTION" || type === "ADJUSTMENT_OUT") {
    return { ...base, borderColor: "#fecaca", background: "#fff1f2", color: "#b91c1c" };
  }

  return base;
}

function movementSign(type: MovementType) {
  if (type === "PURCHASE" || type === "ADJUSTMENT_IN" || type === "INITIAL_STOCK" || type === "RETURN") {
    return "+";
  }
  return "-";
}

function actorLabel(
  user: { username: string | null; fullName: string | null; email: string | null } | null
) {
  if (!user) return "—";
  return user.fullName || user.username || user.email || "—";
}

function usageEntityLabel(
  maintenanceEvent:
    | {
        entityType: "JETSKI" | "ASSET";
        jetski: { number: number } | null;
        asset: { name: string; code: string | null } | null;
      }
    | null
) {
  if (!maintenanceEvent) return "—";
  if (maintenanceEvent.entityType === "JETSKI") {
    return maintenanceEvent.jetski ? `Jetski ${maintenanceEvent.jetski.number}` : "Jetski";
  }
  if (maintenanceEvent.asset) {
    return maintenanceEvent.asset.code
      ? `${maintenanceEvent.asset.name} (${maintenanceEvent.asset.code})`
      : maintenanceEvent.asset.name;
  }
  return "Asset";
}

export default function PartUsagePanels({ row }: { row: PartDetail }) {
  return (
    <div style={gridStyle}>
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Historial de movimientos</div>

        {row.movements.length === 0 ? (
          <div style={{ opacity: 0.72 }}>Sin movimientos todavía.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {row.movements.map((movement) => (
              <div key={movement.id} style={itemStyle}>
                <div style={itemHeaderStyle}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={movementStyle(movement.type)}>{movementLabel(movement.type)}</div>
                    <div style={{ fontWeight: 900 }}>
                      {movementSign(movement.type)}
                      {movement.qty}
                    </div>
                    {movement.unitCostCents != null ? <div style={{ opacity: 0.85 }}>Unitario: {eur(movement.unitCostCents)}</div> : null}
                    {movement.totalCostCents != null ? <div style={{ opacity: 0.85 }}>Total: {eur(movement.totalCostCents)}</div> : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{fmtDateTime(movement.createdAt)}</div>
                </div>

                <div style={textRowStyle}>
                  Usuario: <b>{actorLabel(movement.createdByUser)}</b>
                  {movement.vendor ? ` · Proveedor movimiento: ${movement.vendor.name}` : ""}
                  {movement.expense ? ` · Gasto: ${movement.expense.status}` : ""}
                  {movement.maintenanceEvent ? ` · Evento: ${movement.maintenanceEvent.type} · ${usageEntityLabel(movement.maintenanceEvent)}` : ""}
                </div>

                {movement.note ? <div style={noteStyle}>Nota: {movement.note}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={panelStyle}>
          <div style={panelTitleStyle}>Ficha</div>

          <Metric label="SKU" value={row.sku ?? "—"} />
          <Metric label="Categoría" value={row.category ?? "—"} />
          <Metric label="Marca" value={row.brand ?? "—"} />
          <Metric label="Modelo" value={row.model ?? "—"} />
          <Metric label="Unidad" value={row.unit ?? "—"} />
          <Metric label="Proveedor" value={row.supplierName ?? "—"} />
          <Metric label="Creado" value={fmtDateTime(row.createdAt)} />
          <Metric label="Actualizado" value={fmtDateTime(row.updatedAt)} />
        </div>

        <div style={panelStyle}>
          <div style={panelTitleStyle}>Uso en mantenimiento</div>

          {row.maintenanceUsages.length === 0 ? (
            <div style={{ opacity: 0.72 }}>Este recambio todavía no tiene consumos registrados en eventos.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {row.maintenanceUsages.map((usage) => (
                <div key={usage.id} style={itemStyle}>
                  <div style={{ fontWeight: 900 }}>
                    {usageEntityLabel(usage.maintenanceEvent)} · {usage.maintenanceEvent.type}
                  </div>
                  <div style={textRowStyle}>
                    Cantidad: {usage.qty}
                    {usage.unitCostCents != null ? ` · Unitario: ${eur(usage.unitCostCents)}` : ""}
                    {usage.totalCostCents != null ? ` · Total: ${eur(usage.totalCostCents)}` : ""}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                    {fmtDateTime(usage.createdAt)}
                    {usage.maintenanceEvent.faultCode ? ` · Código de avería: ${usage.maintenanceEvent.faultCode}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.72 }}>{label}</div>
      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 16,
  alignItems: "start",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  padding: 16,
  display: "grid",
  gap: 12,
};

const panelTitleStyle: CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
};

const itemStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 12,
  background: "#fafafa",
};

const itemHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const textRowStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  opacity: 0.9,
};

const noteStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  opacity: 0.88,
};
