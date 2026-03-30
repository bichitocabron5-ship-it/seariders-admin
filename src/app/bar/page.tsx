"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Page, Select, styles } from "@/components/ui";
import { BarOverviewSection } from "./_components/BarOverviewSection";
import { BarPendingDeliveriesSection } from "./_components/BarPendingDeliveriesSection";
import { BarPendingReturnsSection } from "./_components/BarPendingReturnsSection";
import { BarQuickSellProductCard } from "./_components/BarQuickSellProductCard";
import { BarRentalIncidentsSection } from "./_components/BarRentalIncidentsSection";
import {
  createBarPayment,
  createRentalAssetIncident,
  deliverBarFulfillmentTask,
  getAvailableAssetsForTask,
  getBarCashSummary,
  getBarProducts,
  getBarRentalAssets,
  getBarReturnFulfillmentTasks,
  getPendingBarFulfillmentTasks,
  reactivateRentalAsset,
  reportBarFulfillmentIncident,
  returnBarFulfillmentTask,
  type AvailableAssetsByTaskItem,
  type BarCategoryWithProducts,
  type BarMethod,
  type BarRentalAsset,
  type PendingTask,
} from "./services/bar";
import { calculateBarLineTotal } from "@/lib/bar-pricing";

type Method = "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";

type Summary = {
  ok: boolean;
  error?: string;
  computed?: {
    service?: { NET?: { byMethod?: Partial<Record<Method, number>> } };
    all?: { NET?: number };
    meta?: { windowFrom?: string | null; windowTo?: string | null };
  };
  isClosed?: boolean;
  closure?: { id: string; closedAt: string } | null;
};

function businessDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

function hhmm(d?: string | Date | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function sumMethodMapCents(m: Record<Method, number>) {
  return (["CASH", "CARD", "BIZUM", "TRANSFER", "VOUCHER"] as Method[]).reduce(
    (acc, key) => acc + Number(m[key] ?? 0),
    0
  );
}

function methodPill(method: BarMethod) {
  const map: Record<BarMethod, React.CSSProperties> = {
    CASH: { background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a" },
    CARD: { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" },
    BIZUM: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" },
    TRANSFER: { background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c" },
  };

  return { ...styles.pill, ...map[method], fontWeight: 900 };
}

function labelTaskKind(kind: PendingTask["kind"]) {
  return kind === "CATERING" ? "Catering" : "Extra";
}

function labelAssetType(type: BarRentalAsset["type"]) {
  switch (type) {
    case "GOPRO":
      return "GoPro";
    case "WETSUIT":
      return "Neopreno";
    default:
      return "Otro";
  }
}

function labelAssetStatus(status: BarRentalAsset["status"]) {
  switch (status) {
    case "AVAILABLE":
      return "Disponible";
    case "DELIVERED":
      return "Entregado";
    case "MAINTENANCE":
      return "Mantenimiento";
    case "DAMAGED":
      return "Dañado";
    case "LOST":
      return "Perdido";
    case "INACTIVE":
      return "Inactivo";
    default:
      return status;
  }
}

export default function BarPage() {
  const today = useMemo(() => businessDateToday(), []);
  const [shift, setShift] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<BarCategoryWithProducts[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [staffMode, setStaffMode] = useState(false);

  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [returnTasks, setReturnTasks] = useState<PendingTask[]>([]);
  const [taskAssets, setTaskAssets] = useState<Record<string, AvailableAssetsByTaskItem[]>>({});
  const [taskSelections, setTaskSelections] = useState<Record<string, Record<string, string>>>({});

  const [rentalAssets, setRentalAssets] = useState<BarRentalAsset[]>([]);
  const [incidentAssetId, setIncidentAssetId] = useState("");
  const [incidentType, setIncidentType] = useState<"DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER">("DAMAGED");
  const [incidentNote, setIncidentNote] = useState("");
  const [reactivateNote, setReactivateNote] = useState("");

  async function loadAssetsForTask(taskId: string) {
    try {
      const data = await getAvailableAssetsForTask(taskId);
      setTaskAssets((prev) => ({ ...prev, [taskId]: data.rows ?? [] }));
    } catch {
      // El error ya se mostrará al intentar entregar.
    }
  }

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [summaryData, productsData, pendingData, returnsData, assetsData] = await Promise.all([
        getBarCashSummary({ date: today, shift }),
        getBarProducts(),
        getPendingBarFulfillmentTasks(),
        getBarReturnFulfillmentTasks(),
        getBarRentalAssets(),
      ]);

      setSummary(summaryData);
      setCatalog(productsData.rows ?? []);
      setPendingTasks(pendingData.rows ?? []);
      setReturnTasks(returnsData.rows ?? []);
      setRentalAssets(assetsData.rows ?? []);

      for (const task of pendingData.rows ?? []) {
        if (task.kind === "EXTRA") {
          void loadAssetsForTask(task.id);
        }
      }
    } catch (e: unknown) {
      setSummary(null);
      setCatalog([]);
      setPendingTasks([]);
      setReturnTasks([]);
      setRentalAssets([]);
      setError(e instanceof Error ? e.message : "Error cargando BAR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  const serviceByMethod: Record<Method, number> = useMemo(() => {
    const source = summary?.computed?.service?.NET?.byMethod ?? {};
    return {
      CASH: source.CASH ?? 0,
      CARD: source.CARD ?? 0,
      BIZUM: source.BIZUM ?? 0,
      TRANSFER: source.TRANSFER ?? 0,
      VOUCHER: source.VOUCHER ?? 0,
    };
  }, [summary]);

  const systemNet = useMemo(() => sumMethodMapCents(serviceByMethod), [serviceByMethod]);
  const cateringCount = pendingTasks.filter((task) => task.kind === "CATERING").length;
  const extrasCount = pendingTasks.filter((task) => task.kind === "EXTRA").length;

  function getQuantity(productId: string) {
    return Math.max(1, Number(quantities[productId] ?? 1));
  }
  async function handleQuickSell(product: BarCategoryWithProducts["products"][number], method: BarMethod) {
    try {
      setError(null);
      setActionBusy(`${product.id}-${method}`);

      const quantity = getQuantity(product.id);
      const unitPriceCents =
        staffMode && product.staffEligible && product.staffPriceCents != null
          ? Number(product.staffPriceCents)
          : Number(product.salePriceCents);

      const pricing = calculateBarLineTotal({
        unitPriceCents,
        quantity,
        promotions: product.promotions,
        staffMode,
        staffPriceCents: product.staffPriceCents,
      });

      await createBarPayment({
        productId: product.id,
        quantity,
        amountCents: pricing.totalCents,
        method,
        date: today,
        shift,
        label: product.name,
        staffMode,
        note: `BAR - Venta rápida${staffMode ? " - STAFF" : ""} - ${product.name} - x${quantity}`,
      });

      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la venta");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDeliverTask(task: PendingTask) {
    try {
      setError(null);
      setActionBusy(`deliver-${task.id}`);

      const assignments =
        task.kind === "EXTRA"
          ? (taskAssets[task.id] ?? []).map((group) => ({
              taskItemId: group.taskItemId,
              rentalAssetId: taskSelections[task.id]?.[group.taskItemId],
            }))
          : [];

      await deliverBarFulfillmentTask({ taskId: task.id, assignments });

      setTaskSelections((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      setTaskAssets((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la entrega");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReturnTask(taskId: string) {
    try {
      setError(null);
      setActionBusy(`return-${taskId}`);
      await returnBarFulfillmentTask(taskId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la devolución");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleIncidentTask(taskId: string) {
    const note = prompt("Describe la incidencia");
    if (!note || note.trim().length < 3) return;

    try {
      setError(null);
      setActionBusy(`incident-${taskId}`);
      await reportBarFulfillmentIncident(taskId, note.trim());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la incidencia");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCreateIncident() {
    if (!incidentAssetId) {
      setError("Selecciona una unidad.");
      return;
    }

    try {
      setError(null);
      setActionBusy(`asset-incident-${incidentAssetId}`);
      await createRentalAssetIncident({
        rentalAssetId: incidentAssetId,
        type: incidentType,
        note: incidentNote,
      });
      setIncidentAssetId("");
      setIncidentType("DAMAGED");
      setIncidentNote("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la incidencia");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReactivateAsset(rentalAssetId: string) {
    try {
      setError(null);
      setActionBusy(`reactivate-${rentalAssetId}`);
      await reactivateRentalAsset({ rentalAssetId, note: reactivateNote });
      setReactivateNote("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo reactivar la unidad");
    } finally {
      setActionBusy(null);
    }
  }

  const headerRight = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <Select value={shift} onChange={(e) => setShift(e.target.value as "MORNING" | "AFTERNOON")}>
        <option value="MORNING">Mañana</option>
        <option value="AFTERNOON">Tarde</option>
      </Select>
      <Link href="/bar/cash-closures" style={{ ...styles.btn, textDecoration: "none" }}>
        Cierre de caja
      </Link>
      <Button onClick={() => void load()}>Refrescar</Button>
    </div>
  );

  return (
    <Page title="Bar - Operativa" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <BarOverviewSection
        today={today}
        summary={summary}
        systemNet={euros(systemNet)}
        pendingTasksCount={pendingTasks.length}
        cateringCount={cateringCount}
        extrasCount={extrasCount}
        returnTasksCount={returnTasks.length}
        hhmm={hhmm}
      />
      <Card
        title="TPV rápido"
        right={<div style={{ fontSize: 12, color: "#64748b" }}>Cada venta entra en BAR y en el cierre común.</div>}
      >
        {loading ? (
          <Alert kind="info">Cargando resumen y catálogo del turno...</Alert>
        ) : catalog.length === 0 ? (
          <Alert kind="info">No hay categorías o productos activos en BAR.</Alert>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800, color: "#334155" }}>
              <input type="checkbox" checked={staffMode} onChange={(e) => setStaffMode(e.target.checked)} />
              Modo staff
            </label>

            {catalog.map((category) => (
              <div key={category.id} style={{ display: "grid", gap: 12, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{category.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>{category.products.length} productos activos</div>
                </div>

                {category.products.length === 0 ? (
                  <Alert kind="info">No hay productos activos en esta categoría.</Alert>
                ) : (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {category.products.map((product) => {
                      const quantity = getQuantity(product.id);
                      return (
                        <BarQuickSellProductCard
                          key={product.id}
                          product={product}
                          quantity={quantity}
                          staffMode={staffMode}
                          actionBusy={actionBusy}
                          onDecreaseQuantity={() =>
                            setQuantities((prev) => ({ ...prev, [product.id]: Math.max(1, quantity - 1) }))
                          }
                          onSetQuantity={(value) =>
                            setQuantities((prev) => ({ ...prev, [product.id]: value }))
                          }
                          onIncreaseQuantity={() =>
                            setQuantities((prev) => ({ ...prev, [product.id]: quantity + 1 }))
                          }
                          onQuickSell={(method) => void handleQuickSell(product, method)}
                          methodPill={methodPill}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <BarPendingDeliveriesSection
        pendingTasks={pendingTasks}
        taskAssets={taskAssets}
        taskSelections={taskSelections}
        actionBusy={actionBusy}
        hhmm={hhmm}
        labelTaskKind={labelTaskKind}
        onIncidentTask={(taskId) => void handleIncidentTask(taskId)}
        onDeliverTask={(task) => void handleDeliverTask(task)}
        onSelectTaskAsset={(taskId, taskItemId, rentalAssetId) => {
          setTaskSelections((prev) => ({
            ...prev,
            [taskId]: { ...(prev[taskId] ?? {}), [taskItemId]: rentalAssetId },
          }));
        }}
      />
      <BarRentalIncidentsSection
        rentalAssets={rentalAssets}
        incidentAssetId={incidentAssetId}
        incidentType={incidentType}
        incidentNote={incidentNote}
        reactivateNote={reactivateNote}
        actionBusy={actionBusy}
        labelAssetType={labelAssetType}
        labelAssetStatus={labelAssetStatus}
        onIncidentAssetChange={setIncidentAssetId}
        onIncidentTypeChange={setIncidentType}
        onIncidentNoteChange={setIncidentNote}
        onReactivateNoteChange={setReactivateNote}
        onCreateIncident={() => void handleCreateIncident()}
        onReactivateAsset={(rentalAssetId) => void handleReactivateAsset(rentalAssetId)}
      />

      <BarPendingReturnsSection
        returnTasks={returnTasks}
        actionBusy={actionBusy}
        hhmm={hhmm}
        onIncidentTask={(taskId) => void handleIncidentTask(taskId)}
        onReturnTask={(taskId) => void handleReturnTask(taskId)}
      />
    </Page>
  );
}
