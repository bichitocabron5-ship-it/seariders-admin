"use client";

import { eurFromCents } from "@/lib/mechanics-format";

type SparePartOption = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  unit: string | null;
  stockQty: number;
  minStockQty: number;
  costPerUnitCents: number | null;
  supplierName: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EditablePart = {
  sparePartId: string;
  label: string;
  qty: string;
  unitCostCents: string;
};

type Props = {
  inputStyle: React.CSSProperties;
  ghostBtn: React.CSSProperties;
  sectionCard: React.CSSProperties;
  partQuery: string;
  filteredOptions: SparePartOption[];
  parts: EditablePart[];
  totalCostPreview: number;
  onPartQueryChange: (value: string) => void;
  onAddPart: (sparePart: SparePartOption) => void;
  onUpdatePart: (index: number, patch: Partial<EditablePart>) => void;
  onRemovePart: (index: number) => void;
};

export default function EditMaintenanceEventPartsEditorSection({
  inputStyle,
  ghostBtn,
  sectionCard,
  partQuery,
  filteredOptions,
  parts,
  totalCostPreview,
  onPartQueryChange,
  onAddPart,
  onUpdatePart,
  onRemovePart,
}: Props) {
  return (
    <>
      <div style={sectionCard}>
        <div style={{ fontWeight: 900 }}>Buscar y añadir recambio</div>
        <input
          value={partQuery}
          onChange={(e) => onPartQueryChange(e.target.value)}
          placeholder="Nombre, SKU, marca, modelo, proveedor..."
          style={inputStyle}
        />

        <div style={{ display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}>
          {filteredOptions.map((part) => (
            <div
              key={part.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
              }}
            >
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 800 }}>
                  {part.name}
                  {part.sku ? ` · ${part.sku}` : ""}
                </div>
                <div style={{ opacity: 0.8 }}>
                  Stock: {part.stockQty}
                  {part.unit ? ` ${part.unit}` : ""}
                  {part.costPerUnitCents != null ? ` · ${eurFromCents(part.costPerUnitCents)}` : ""}
                </div>
              </div>

              <button type="button" onClick={() => onAddPart(part)} style={ghostBtn}>
                Añadir
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionCard}>
        <div style={{ fontWeight: 900 }}>Piezas del evento</div>

        {parts.length === 0 ? (
          <div style={{ opacity: 0.72 }}>No hay piezas seleccionadas.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {parts.map((part, index) => (
              <div
                key={`${part.sparePartId}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 120px 160px 120px",
                  gap: 8,
                  alignItems: "end",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{part.label}</div>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Cantidad
                  <input
                    value={part.qty}
                    onChange={(e) => onUpdatePart(index, { qty: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Coste unitario
                  <input
                    value={part.unitCostCents}
                    onChange={(e) => onUpdatePart(index, { unitCostCents: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <button type="button" onClick={() => onRemovePart(index)} style={ghostBtn}>
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 900 }}>
          Coste estimado piezas: {eurFromCents(totalCostPreview)}
        </div>
      </div>
    </>
  );
}
