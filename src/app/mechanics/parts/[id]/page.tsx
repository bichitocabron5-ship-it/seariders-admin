// src/app/mechanics/parts/[id]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PartModal from "../_components/PartModal";
import PurchasePartModal from "../_components/PurchasePartModal";
import ConsumePartModal from "../_components/ConsumePartModal";
import AdjustPartModal from "../_components/AdjustPartModal";
import type { PartRow } from "../_components/types";
import PartHistoryModal from "../_components/PartHistoryModal";

type MovementType =
  | "PURCHASE"
  | "CONSUMPTION"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "INITIAL_STOCK"
  | "RETURN";

type PartDetailResponse = {
  ok: true;
  row: PartDetail;
  lowStock: boolean;
  summary: {
    totalIn: number;
    totalOut: number;
    movementsCount: number;
    totalMovementCostCents: number;
  };
  maintenanceUsageSummary: {
    totalQty: number;
    totalCostCents: number;
    count: number;
  };
};

type PartDetail = {
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

const pageShell: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
  padding: 28,
  display: "grid",
  gap: 18,
  fontFamily: "system-ui",
};

const softCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #d0d9e4",
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

function movementStyle(type: MovementType): React.CSSProperties {
  const base: React.CSSProperties = {
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

export default function MechanicsPartDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [row, setRow] = useState<PartDetail | null>(null);
  const [lowStock, setLowStock] = useState(false);
  const [summary, setSummary] = useState<PartDetailResponse["summary"] | null>(null);
  const [maintenanceUsageSummary, setMaintenanceUsageSummary] =
    useState<PartDetailResponse["maintenanceUsageSummary"] | null>(null);

  const [openEdit, setOpenEdit] = useState(false);
  const [openPurchase, setOpenPurchase] = useState(false);
  const [openConsume, setOpenConsume] = useState(false);
  const [openAdjust, setOpenAdjust] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  const modalPart: PartRow | null = row
    ? {
        id: row.id,
        sku: row.sku,
        name: row.name,
        category: row.category,
        brand: row.brand,
        model: row.model,
        unit: row.unit,
        stockQty: row.stockQty,
        minStockQty: row.minStockQty,
        costPerUnitCents: row.costPerUnitCents,
        supplierName: row.supplierName,
        note: row.note,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;

  const load = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mechanics/parts/${id}/detail`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());

      const json = (await res.json()) as PartDetailResponse;
      setRow(json.row ?? null);
      setLowStock(Boolean(json.lowStock));
      setSummary(json.summary ?? null);
      setMaintenanceUsageSummary(json.maintenanceUsageSummary ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando recambio");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const stockStateLabel = useMemo(() => {
    if (!row) return "—";
    if (Number(row.stockQty) <= 0) return "Sin stock";
    if (Number(row.stockQty) <= Number(row.minStockQty)) return "Stock bajo";
    return "Correcto";
  }, [row]);

  return (
    <div style={pageShell}>
      <div
        style={{
          ...softCard,
          padding: 16,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => router.push("/mechanics/parts")}
            style={{
              border: "1px solid #d0d9e4",
              background: "#fff",
              borderRadius: 12,
              padding: "8px 10px",
              fontWeight: 900,
              marginBottom: 10,
            }}
          >
            Volver
          </button>

          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0f766e" }}>Recambio</div>
          <div style={{ fontWeight: 950, fontSize: 34, lineHeight: 1.02 }}>{row?.name ?? "Recambio"}</div>
          <div style={{ opacity: 0.76, fontSize: 14 }}>
            Ficha tecnica, movimientos de stock y trazabilidad de uso en mantenimiento.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
          <button type="button" onClick={() => load()} style={ghostBtn}>
            Refrescar
          </button>

          <button type="button" onClick={() => setOpenEdit(true)} style={ghostBtn} disabled={!row}>
            Editar
          </button>

          <button type="button" onClick={() => setOpenPurchase(true)} style={ghostBtn} disabled={!row}>
            Comprar
          </button>

          <button type="button" onClick={() => setOpenConsume(true)} style={ghostBtn} disabled={!row}>
            Consumir
          </button>

          <button type="button" onClick={() => setOpenAdjust(true)} style={primaryBtn} disabled={!row}>
            Ajustar
          </button>

          <button type="button" onClick={() => setOpenHistory(true)} style={ghostBtn} disabled={!row}>
            Historial
          </button>
        </div>
      </div>

      {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && row ? (
        <>
          <div
            style={{
              ...softCard,
              border: lowStock ? "1px solid #fde68a" : "1px solid #dbe4ea",
              background: lowStock ? "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)" : "#fff",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 22 }}>{row.name}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {row.sku ? `SKU ${row.sku}` : "Sin SKU"}
                  {row.category ? ` · ${row.category}` : ""}
                  {row.brand ? ` · ${row.brand}` : ""}
                  {row.model ? ` · ${row.model}` : ""}
                  {row.unit ? ` · ${row.unit}` : ""}
                </div>
              </div>

              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 900,
                  fontSize: 12,
                  border: lowStock ? "1px solid #fde68a" : "1px solid #bbf7d0",
                  background: lowStock ? "#fffbeb" : "#f0fdf4",
                  color: lowStock ? "#92400e" : "#166534",
                }}
              >
                {stockStateLabel}
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Proveedor: <b>{row.supplierName ?? "—"}</b>
              {row.note ? ` · Nota: ${row.note}` : ""}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <Kpi title="Stock actual" value={row.stockQty} danger={lowStock} />
            <Kpi title="Stock mínimo" value={row.minStockQty} />
            <Kpi title="Coste unitario" value={eur(row.costPerUnitCents)} />
            <Kpi title="Entradas acumuladas" value={summary?.totalIn ?? 0} />
            <Kpi title="Salidas acumuladas" value={summary?.totalOut ?? 0} />
            <Kpi title="Movimientos" value={summary?.movementsCount ?? 0} />
            <Kpi title="Usos en mantenimiento" value={maintenanceUsageSummary?.count ?? 0} />
            <Kpi title="Activo" value={row.isActive ? "Sí" : "No"} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            <div
              style={{
                ...softCard,
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: 20 }}>Historial de movimientos</div>

              {row.movements.length === 0 ? (
                <div style={{ opacity: 0.72 }}>Sin movimientos todavía.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {row.movements.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 14,
                        padding: 12,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={movementStyle(m.type)}>{movementLabel(m.type)}</div>
                          <div style={{ fontWeight: 900 }}>
                            {movementSign(m.type)}
                            {m.qty}
                          </div>
                          {m.unitCostCents != null ? (
                            <div style={{ opacity: 0.85 }}>Unitario: {eur(m.unitCostCents)}</div>
                          ) : null}
                          {m.totalCostCents != null ? (
                            <div style={{ opacity: 0.85 }}>Total: {eur(m.totalCostCents)}</div>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{fmtDateTime(m.createdAt)}</div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                        Usuario: <b>{actorLabel(m.createdByUser)}</b>
                        {m.vendor ? ` · Proveedor movimiento: ${m.vendor.name}` : ""}
                        {m.expense ? ` · Gasto: ${m.expense.status}` : ""}
                        {m.maintenanceEvent
                          ? ` · Evento: ${m.maintenanceEvent.type} · ${usageEntityLabel(m.maintenanceEvent)}`
                          : ""}
                      </div>

                      {m.note ? (
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.88 }}>
                          Nota: {m.note}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  ...softCard,
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 20 }}>Ficha</div>

                <Metric label="SKU" value={row.sku ?? "—"} />
                <Metric label="Categoría" value={row.category ?? "—"} />
                <Metric label="Marca" value={row.brand ?? "—"} />
                <Metric label="Modelo" value={row.model ?? "—"} />
                <Metric label="Unidad" value={row.unit ?? "—"} />
                <Metric label="Proveedor" value={row.supplierName ?? "—"} />
                <Metric label="Creado" value={fmtDateTime(row.createdAt)} />
                <Metric label="Actualizado" value={fmtDateTime(row.updatedAt)} />
              </div>

              <div
                style={{
                  ...softCard,
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 20 }}>Uso en mantenimiento</div>

                {row.maintenanceUsages.length === 0 ? (
                  <div style={{ opacity: 0.72 }}>Este recambio todavía no tiene consumos registrados en eventos.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {row.maintenanceUsages.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 14,
                          padding: 12,
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {usageEntityLabel(u.maintenanceEvent)} · {u.maintenanceEvent.type}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>
                          Cantidad: {u.qty}
                          {u.unitCostCents != null ? ` · Unitario: ${eur(u.unitCostCents)}` : ""}
                          {u.totalCostCents != null ? ` · Total: ${eur(u.totalCostCents)}` : ""}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                          {fmtDateTime(u.createdAt)}
                          {u.maintenanceEvent.faultCode ? ` · Código de avería: ${u.maintenanceEvent.faultCode}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {openEdit && modalPart ? (
        <PartModal
          initial={modalPart}
          onClose={() => setOpenEdit(false)}
          onSaved={async () => {
            setOpenEdit(false);
            await load();
          }}
        />
      ) : null}

      {openPurchase && modalPart ? (
        <PurchasePartModal
          part={modalPart}
          onClose={() => setOpenPurchase(false)}
          onSaved={async () => {
            setOpenPurchase(false);
            await load();
          }}
        />
      ) : null}

      {openConsume && modalPart ? (
        <ConsumePartModal
          part={modalPart}
          onClose={() => setOpenConsume(false)}
          onSaved={async () => {
            setOpenConsume(false);
            await load();
          }}
        />
      ) : null}

      {openAdjust && modalPart ? (
        <AdjustPartModal
          part={modalPart}
          onClose={() => setOpenAdjust(false)}
          onSaved={async () => {
            setOpenAdjust(false);
            await load();
          }}
        />
      ) : null}

      {openHistory && modalPart ? (
        <PartHistoryModal
          part={modalPart}
          onClose={() => setOpenHistory(false)}
        />
      ) : null}
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

function Kpi({
  title,
  value,
  danger = false,
}: {
  title: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        border: danger ? "1px solid #fde68a" : "1px solid #e5e7eb",
        background: danger ? "#fffbeb" : "#fff",
        borderRadius: 12,
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ marginTop: 4, fontWeight: 950, fontSize: 20 }}>{value}</div>
    </div>
  );
}


