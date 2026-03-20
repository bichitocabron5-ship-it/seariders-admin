// src/app/mechanics/_components/EditMaintenanceEventPartsModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { eurFromCents } from "@/lib/mechanics-format";

type EventPartRow = {
  id: string;
  qty: number;
  unitCostCents: number | null;
  totalCostCents: number | null;
  createdAt: string;
  sparePart: {
    id: string;
    name: string;
    sku: string | null;
    unit: string | null;
  } | null;
};

type EventDetailRow = {
  id: string;
  partsCostCents: number | null;
  partUsages: EventPartRow[];
};

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

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 900,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 950,
};

const sectionCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  borderRadius: 16,
  padding: 14,
  display: "grid",
  gap: 8,
  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.06)",
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 90,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(1000px, 100%)",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: 20,
          border: "1px solid #dbe4ea",
          padding: 16,
          display: "grid",
          gap: 14,
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 22px 48px rgba(15, 23, 42, 0.14)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function EditMaintenanceEventPartsModal({
  eventId,
  onClose,
  onSaved,
}: {
  eventId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parts, setParts] = useState<EditablePart[]>([]);
  const [options, setOptions] = useState<SparePartOption[]>([]);
  const [partQuery, setPartQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [eventRes, partsRes] = await Promise.all([
          fetch(`/api/mechanics/events/${eventId}`, { cache: "no-store" }),
          fetch(`/api/mechanics/parts`, { cache: "no-store" }),
        ]);

        if (!eventRes.ok) throw new Error(await eventRes.text());
        if (!partsRes.ok) throw new Error(await partsRes.text());

        const eventJson = await eventRes.json();
        const partsJson = await partsRes.json();

        const row = eventJson.row as EventDetailRow;
        const available = (partsJson.rows ?? []) as SparePartOption[];

        if (cancelled) return;

        setOptions(available);

        setParts(
          row.partUsages.map((p) => ({
            sparePartId: p.sparePart?.id ?? "",
            label: p.sparePart
              ? `${p.sparePart.name}${p.sparePart.sku ? ` · ${p.sparePart.sku}` : ""}`
              : "Recambio",
            qty: String(p.qty),
            unitCostCents:
              p.unitCostCents != null ? String(p.unitCostCents) : "",
          }))
        );
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error cargando piezas del evento");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const filteredOptions = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return options;

    return options.filter((p) => {
      const hay = [
        p.name,
        p.sku ?? "",
        p.brand ?? "",
        p.model ?? "",
        p.supplierName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [options, partQuery]);

  const totalCostPreview = useMemo(() => {
    return parts.reduce((acc, p) => {
      const qty = Number(p.qty || 0);
      const unit = Number(p.unitCostCents || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(unit)) return acc;
      return acc + qty * unit;
    }, 0);
  }, [parts]);

  function addPart(sparePart: SparePartOption) {
    setParts((prev) => {
      const existing = prev.find((p) => p.sparePartId === sparePart.id);
      if (existing) {
        return prev.map((p) =>
          p.sparePartId === sparePart.id
            ? {
                ...p,
                qty: String(Number(p.qty || 0) + 1),
              }
            : p
        );
      }

      return [
        ...prev,
        {
          sparePartId: sparePart.id,
          label: `${sparePart.name}${sparePart.sku ? ` · ${sparePart.sku}` : ""}`,
          qty: "1",
          unitCostCents:
            sparePart.costPerUnitCents != null
              ? String(sparePart.costPerUnitCents)
              : "",
        },
      ];
    });
  }

  function updatePart(index: number, patch: Partial<EditablePart>) {
    setParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  }

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    try {
      setBusy(true);
      setError(null);

      const payload = {
        partsUsed: parts.map((p) => ({
          sparePartId: p.sparePartId,
          qty: Number(p.qty),
          unitCostCents: p.unitCostCents.trim()
            ? Number(p.unitCostCents)
            : null,
        })),
      };

      const res = await fetch(`/api/mechanics/events/${eventId}/parts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando piezas");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Editar piezas del evento" onClose={() => (busy ? null : onClose())}>
      {loading ? <div>Cargando...</div> : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading ? (
        <>
          <div style={sectionCard}>
            <div style={{ fontWeight: 900 }}>Buscar y añadir recambio</div>
            <input
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
              placeholder="Nombre, SKU, marca, modelo, proveedor..."
              style={inputStyle}
            />

            <div style={{ display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}>
              {filteredOptions.map((p) => (
                <div
                  key={p.id}
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
                      {p.name}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </div>
                    <div style={{ opacity: 0.8 }}>
                      Stock: {p.stockQty}
                      {p.unit ? ` ${p.unit}` : ""}
                      {p.costPerUnitCents != null
                        ? ` · ${eurFromCents(p.costPerUnitCents)}`
                        : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addPart(p)}
                    style={ghostBtn}
                  >
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
                {parts.map((p, index) => (
                  <div
                    key={`${p.sparePartId}-${index}`}
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
                      <div style={{ fontWeight: 800 }}>{p.label}</div>
                    </div>

                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Cantidad
                      <input
                        value={p.qty}
                        onChange={(e) => updatePart(index, { qty: e.target.value })}
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Coste unitario
                      <input
                        value={p.unitCostCents}
                        onChange={(e) =>
                          updatePart(index, { unitCostCents: e.target.value })
                        }
                        style={inputStyle}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      style={ghostBtn}
                    >
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={ghostBtn} disabled={busy}>
              Cerrar
            </button>
            <button type="button" onClick={save} style={primaryBtn} disabled={busy}>
              {busy ? "Guardando..." : "Guardar piezas"}
            </button>
          </div>
        </>
      ) : null}
    </ModalShell>
  );
}
