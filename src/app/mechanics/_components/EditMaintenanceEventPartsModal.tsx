"use client";

import { useEffect, useMemo, useState } from "react";
import EditMaintenanceEventPartsEditorSection from "@/app/mechanics/_components/EditMaintenanceEventPartsEditorSection";

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
          row.partUsages.map((partUsage) => ({
            sparePartId: partUsage.sparePart?.id ?? "",
            label: partUsage.sparePart
              ? `${partUsage.sparePart.name}${partUsage.sparePart.sku ? ` · ${partUsage.sparePart.sku}` : ""}`
              : "Recambio",
            qty: String(partUsage.qty),
            unitCostCents: partUsage.unitCostCents != null ? String(partUsage.unitCostCents) : "",
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

    return options.filter((part) => {
      const hay = [part.name, part.sku ?? "", part.brand ?? "", part.model ?? "", part.supplierName ?? ""]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [options, partQuery]);

  const totalCostPreview = useMemo(() => {
    return parts.reduce((acc, part) => {
      const qty = Number(part.qty || 0);
      const unit = Number(part.unitCostCents || 0);
      if (!Number.isFinite(qty) || !Number.isFinite(unit)) return acc;
      return acc + qty * unit;
    }, 0);
  }, [parts]);

  function addPart(sparePart: SparePartOption) {
    setParts((prev) => {
      const existing = prev.find((part) => part.sparePartId === sparePart.id);
      if (existing) {
        return prev.map((part) =>
          part.sparePartId === sparePart.id
            ? {
                ...part,
                qty: String(Number(part.qty || 0) + 1),
              }
            : part
        );
      }

      return [
        ...prev,
        {
          sparePartId: sparePart.id,
          label: `${sparePart.name}${sparePart.sku ? ` · ${sparePart.sku}` : ""}`,
          qty: "1",
          unitCostCents: sparePart.costPerUnitCents != null ? String(sparePart.costPerUnitCents) : "",
        },
      ];
    });
  }

  function updatePart(index: number, patch: Partial<EditablePart>) {
    setParts((prev) => prev.map((part, i) => (i === index ? { ...part, ...patch } : part)));
  }

  function removePart(index: number) {
    setParts((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    try {
      setBusy(true);
      setError(null);

      const payload = {
        partsUsed: parts.map((part) => ({
          sparePartId: part.sparePartId,
          qty: Number(part.qty),
          unitCostCents: part.unitCostCents.trim() ? Number(part.unitCostCents) : null,
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
          <EditMaintenanceEventPartsEditorSection
            inputStyle={inputStyle}
            ghostBtn={ghostBtn}
            sectionCard={sectionCard}
            partQuery={partQuery}
            filteredOptions={filteredOptions}
            parts={parts}
            totalCostPreview={totalCostPreview}
            onPartQueryChange={setPartQuery}
            onAddPart={addPart}
            onUpdatePart={updatePart}
            onRemovePart={removePart}
          />

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
