"use client";

import type { CSSProperties } from "react";

type GiftProductRow = {
  id: string;
  name: string;
  isActive: boolean;
  priceCents: number;
  validDays: number | null;
  service: { id: string; name: string; category: string };
  option: { id: string; name?: string | null; durationMinutes?: number | null; pax?: number | null };
  createdAt: string;
};

type Props = {
  panelStyle: CSSProperties;
  inputStyle: CSSProperties;
  lightBtn: CSSProperties;
  products: GiftProductRow[];
  editingId: string | null;
  eName: string;
  ePriceEuros: string;
  eValidDays: string;
  euros: (cents: number) => string;
  optLabel: (option: GiftProductRow["option"]) => string;
  onStartEdit: (product: GiftProductRow) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void | Promise<void>;
  onToggleProduct: (id: string, isActive: boolean) => void | Promise<void>;
  onEditNameChange: (value: string) => void;
  onEditPriceChange: (value: string) => void;
  onEditValidDaysChange: (value: string) => void;
};

export default function GiftProductsListSection({
  panelStyle,
  inputStyle,
  lightBtn,
  products,
  editingId,
  eName,
  ePriceEuros,
  eValidDays,
  euros,
  optLabel,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleProduct,
  onEditNameChange,
  onEditPriceChange,
  onEditValidDaysChange,
}: Props) {
  return (
    <div style={panelStyle}>
      <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Productos</div>

      {products.length === 0 ? (
        <div style={{ padding: 12, opacity: 0.7 }}>No hay productos.</div>
      ) : (
        <div style={{ display: "grid" }}>
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                padding: 12,
                borderTop: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {editingId === product.id ? (
                <>
                  <div style={{ flex: 1, display: "grid", gap: 8 }}>
                    <input
                      value={eName}
                      onChange={(e) => onEditNameChange(e.target.value)}
                      placeholder="Nombre visible"
                      style={{ ...inputStyle, padding: 8 }}
                    />

                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={ePriceEuros}
                        onChange={(e) => onEditPriceChange(e.target.value)}
                        placeholder="PVP EUR"
                        style={{ ...inputStyle, padding: 8, width: 120 }}
                      />
                      <input
                        value={eValidDays}
                        onChange={(e) => onEditValidDaysChange(e.target.value)}
                        placeholder="Validez días"
                        style={{ ...inputStyle, padding: 8, width: 140 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => void onSaveEdit(product.id)} style={lightBtn}>
                      Guardar
                    </button>
                    <button onClick={onCancelEdit} style={lightBtn}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {product.name}
                      {!product.isActive ? <span style={{ fontSize: 12, opacity: 0.7 }}> · INACTIVO</span> : null}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      {product.service.category} · {product.service.name} · {optLabel(product.option)}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      PVP: <b>{euros(product.priceCents)}</b>
                      {product.validDays ? (
                        <>
                          {" "}
                          · Validez: <b>{product.validDays} días</b>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => onStartEdit(product)} style={lightBtn}>
                      Editar
                    </button>
                    <button onClick={() => void onToggleProduct(product.id, !product.isActive)} style={lightBtn}>
                      {product.isActive ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
