"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";

type ExpenseRow = {
  id: string;
  description: string;
};

type BarProductLookup = {
  id: string;
  name: string;
  unitLabel: string | null;
  costPriceCents?: number | null;
};

type BarProductsResponse = {
  rows?: Array<{
    products?: BarProductLookup[];
  }>;
};

type BarRestockLine = {
  productId: string;
  quantity: string;
  unitCostEuros: string;
};

export default function ApplyBarRestockModal({
  expense,
  onClose,
  onSaved,
}: {
  expense: ExpenseRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<BarProductLookup[]>([]);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<BarRestockLine[]>([{ productId: "", quantity: "1", unitCostEuros: "0" }]);

  function cents(value: string) {
    const n = Number((value ?? "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/admin/bar/products", { cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const json = (await res.json()) as BarProductsResponse;

    const flat =
      (json.rows ?? []).flatMap((category) =>
        (category.products ?? []).map((product) => ({
          id: product.id,
          name: product.name,
          unitLabel: product.unitLabel ?? "ud",
          costPriceCents: product.costPriceCents ?? null,
        }))
      ) ?? [];

    setProducts(flat);
  }, []);

  useEffect(() => {
    loadProducts().catch((e) =>
      setError(e instanceof Error ? e.message : "Error cargando productos Bar")
    );
  }, [loadProducts]);

  function updateLine(index: number, patch: Partial<BarRestockLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1", unitCostEuros: "0" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit() {
    try {
      setBusy(true);
      setError(null);

      const items = lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        unitCostCents: cents(line.unitCostEuros),
      }));

      const res = await fetch(`/api/admin/expenses/${expense.id}/apply-bar-restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || null,
          items,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error aplicando reposición");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={titleStyle}>Aplicar a stock Bar</div>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Cerrar
          </button>
        </div>

        <div style={infoTextStyle}>
          Gasto: <strong>{expense.description}</strong>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional" style={inputStyle} />

        <div style={{ display: "grid", gap: 10 }}>
          {lines.map((line, index) => (
            <div key={index} style={lineRowStyle}>
              <select
                value={line.productId}
                onChange={(e) => {
                  const productId = e.target.value;
                  const selected = products.find((p) => p.id === productId);
                  updateLine(index, {
                    productId,
                    unitCostEuros:
                      selected?.costPriceCents != null
                        ? (Number(selected.costPriceCents) / 100).toFixed(2)
                        : line.unitCostEuros,
                  });
                }}
                style={inputStyle}
              >
                <option value="">Producto Bar</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>

              <input
                value={line.quantity}
                onChange={(e) => updateLine(index, { quantity: e.target.value })}
                placeholder="Cantidad"
                style={inputStyle}
              />

              <input
                value={line.unitCostEuros}
                onChange={(e) => updateLine(index, { unitCostEuros: e.target.value })}
                placeholder="Coste unitario €"
                style={inputStyle}
              />

              <button type="button" onClick={() => removeLine(index)} style={ghostBtn}>
                Quitar
              </button>
            </div>
          ))}
        </div>

        {error ? <div style={errorBox}>{error}</div> : null}

        <div style={footerStyle}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={addLine} style={ghostBtn}>
              Añadir línea
            </button>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={ghostBtn}>
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={busy} style={primaryBtn}>
              {busy ? "Aplicando..." : "Aplicar a stock Bar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 1000,
};

const modalStyle: CSSProperties = {
  width: "min(1100px, 96vw)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 24,
  padding: 20,
  border: "1px solid #dbe4ea",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
  display: "grid",
  gap: 12,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
};

const infoTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#475569",
};

const lineRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr auto",
  gap: 10,
  alignItems: "center",
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 12,
  borderRadius: 12,
};

const primaryBtn: CSSProperties = {
  ...opsStyles.primaryButton,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
};

const errorBox: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
