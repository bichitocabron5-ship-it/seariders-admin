"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

const DIRECTORY_VISIBILITY_KEY = "admin-expenses-directory-open";

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

type DirectoryStats = {
  expenseCount: number;
  totalCents: number;
};

export default function ExpensesDirectorySection({
  categories,
  vendors,
  activeCategoryCount,
  activeVendorCount,
  categoryStats,
  vendorStats,
  onEditCategory,
  onEditVendor,
}: {
  categories: CategoryRow[];
  vendors: VendorRow[];
  activeCategoryCount: number;
  activeVendorCount: number;
  categoryStats: Record<string, DirectoryStats>;
  vendorStats: Record<string, DirectoryStats>;
  onEditCategory: (category: CategoryRow) => void;
  onEditVendor: (vendor: VendorRow) => void;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;

    try {
      return window.localStorage.getItem(DIRECTORY_VISIBILITY_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(DIRECTORY_VISIBILITY_KEY, String(isOpen));
    } catch {
      // Ignore storage write issues so the UI keeps working.
    }
  }, [isOpen]);

  return (
    <section style={sectionShell}>
      <div style={sectionCard}>
        <div style={sectionTopRow}>
          <div style={sectionIntro}>
            <div style={sectionEyebrow}>Directorio maestro</div>
            <div style={sectionLead}>
              Estas columnas gestionan catalogos de categorias y proveedores. La actividad se calcula sobre la vista filtrada actual, no sobre todo el historico.
            </div>
          </div>

          <button type="button" onClick={() => setIsOpen((value) => !value)} style={toggleBtn}>
            {isOpen ? "Ocultar directorio" : "Mostrar directorio"}
          </button>
        </div>

        {!isOpen ? (
          <div style={collapsedHint}>
            Directorio plegado para priorizar el libro de gastos. Categorias activas: {activeCategoryCount}. Proveedores activos: {activeVendorCount}.
          </div>
        ) : (
          <div style={directoryGrid}>
            <div style={directoryCard}>
              <div style={directoryHeader}>
                <div style={directoryHeaderColumn}>
                  <div style={sectionTitle}>Categorias</div>
                  <div style={sectionCaption}>Catalogo contable para agrupar y analizar gasto.</div>
                </div>
                <div style={pillCounter}>{activeCategoryCount} activas</div>
              </div>

              {categories.length === 0 ? (
                <div style={emptyText}>No hay categorias todavia.</div>
              ) : (
                <div style={directoryListStyle}>
                  {categories.map((category) => (
                    <div key={category.id} style={directoryRow}>
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {category.name}
                          {category.code ? ` (${category.code})` : ""}
                        </div>
                        <div style={rowCaption}>{category.description || "Sin descripcion"}</div>
                        <div style={metaGrid}>
                          <span style={metaChipNeutral}>{category._count?.expenses ?? 0} gasto(s) historicos</span>
                          <span style={metaChipAccent}>{formatStats(categoryStats[category.id])}</span>
                        </div>
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
                  <div style={sectionCaption}>Base maestra de terceros para trazabilidad y pagos.</div>
                </div>
                <div style={pillCounter}>{activeVendorCount} activos</div>
              </div>

              {vendors.length === 0 ? (
                <div style={emptyText}>No hay proveedores todavia.</div>
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
                        <div style={metaGrid}>
                          <span style={metaChipNeutral}>{vendor._count?.expenses ?? 0} gasto(s) historicos</span>
                          <span style={metaChipAccent}>{formatStats(vendorStats[vendor.id])}</span>
                        </div>
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
        )}
      </div>
    </section>
  );
}

function formatStats(stats?: DirectoryStats) {
  if (!stats || stats.expenseCount === 0) return "Vista actual: sin gastos";
  return `Vista actual: ${stats.expenseCount} gasto(s) - ${formatEur(stats.totalCents)}`;
}

function formatEur(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const sectionShell: CSSProperties = {
  display: "grid",
};

const sectionCard: CSSProperties = {
  ...opsStyles.sectionCard,
  gap: 14,
};

const sectionTopRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sectionIntro: CSSProperties = {
  display: "grid",
  gap: 4,
  maxWidth: 760,
};

const sectionEyebrow: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f766e",
};

const sectionLead: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.5,
};

const toggleBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  whiteSpace: "nowrap",
};

const collapsedHint: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 14,
  background: "#f8fafc",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
};

const directoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const directoryCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 10,
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

const metaGrid: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 6,
};

const metaChipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const metaChipNeutral: CSSProperties = {
  ...metaChipBase,
  background: "#f1f5f9",
  color: "#475569",
};

const metaChipAccent: CSSProperties = {
  ...metaChipBase,
  background: "#ecfeff",
  color: "#155e75",
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  whiteSpace: "nowrap",
};
