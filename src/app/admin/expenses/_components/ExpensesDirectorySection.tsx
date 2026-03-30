"use client";

import type { CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type CategoryRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  _count?: { expenses: number };
};

type VendorRow = {
  id: string;
  name: string;
  code: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  note: string | null;
  isActive: boolean;
  categoryLinks?: Array<{
    id: string;
    isDefault: boolean;
    category: {
      id: string;
      name: string;
      code: string | null;
      isActive: boolean;
    };
  }>;
  _count?: { expenses: number };
};

export default function ExpensesDirectorySection({
  categories,
  vendors,
  activeCategoryCount,
  activeVendorCount,
  onEditCategory,
  onEditVendor,
}: {
  categories: CategoryRow[];
  vendors: VendorRow[];
  activeCategoryCount: number;
  activeVendorCount: number;
  onEditCategory: (category: CategoryRow) => void;
  onEditVendor: (vendor: VendorRow) => void;
}) {
  return (
    <div style={directoryGrid}>
      <div style={directoryCard}>
        <div style={directoryHeader}>
          <div style={directoryHeaderColumn}>
            <div style={sectionTitle}>Categorías</div>
            <div style={sectionCaption}>Clasificación contable para agrupar y analizar gasto.</div>
          </div>
          <div style={pillCounter}>{activeCategoryCount} activas</div>
        </div>

        {categories.length === 0 ? (
          <div style={emptyText}>No hay categorías todavía.</div>
        ) : (
          <div style={directoryListStyle}>
            {categories.map((category) => (
              <div key={category.id} style={directoryRow}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {category.name}
                    {category.code ? ` (${category.code})` : ""}
                  </div>
                  <div style={rowCaption}>{category.description || "Sin descripción"}</div>
                </div>

                <button type="button" onClick={() => onEditCategory(category)} style={ghostBtn}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={directoryCard}>
        <div style={directoryHeader}>
          <div style={directoryHeaderColumn}>
            <div style={sectionTitle}>Proveedores</div>
            <div style={sectionCaption}>Base de terceros para trazabilidad y pagos.</div>
          </div>
          <div style={pillCounter}>{activeVendorCount} activos</div>
        </div>

        {vendors.length === 0 ? (
          <div style={emptyText}>No hay proveedores todavía.</div>
        ) : (
          <div style={directoryListStyle}>
            {vendors.map((vendor) => (
              <div key={vendor.id} style={directoryRow}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {vendor.name}
                    {vendor.code ? ` (${vendor.code})` : ""}
                  </div>
                  <div style={rowCaption}>{vendor.taxId || "Sin NIF/CIF"}</div>
                </div>

                <button type="button" onClick={() => onEditVendor(vendor)} style={ghostBtn}>
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const directoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const directoryCard: CSSProperties = {
  ...opsStyles.sectionCard,
  gap: 8,
};

const directoryHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const directoryHeaderColumn: CSSProperties = {
  display: "grid",
  gap: 4,
};

const sectionTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 950,
  color: "#0f172a",
};

const sectionCaption: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const pillCounter: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "#eef2f7",
  color: "#334155",
  fontWeight: 900,
  fontSize: 12,
};

const emptyText: CSSProperties = {
  opacity: 0.72,
};

const directoryListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const directoryRow: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const rowCaption: CSSProperties = {
  fontSize: 13,
  opacity: 0.75,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  whiteSpace: "nowrap",
};
