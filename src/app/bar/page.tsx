"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Page, Select, Stat, styles } from "@/components/ui";
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
import { calculateBarLineTotal, getBarPromotionBadge } from "@/lib/bar-pricing";

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
      return "Danado";
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
      // El error ya se mostrara al intentar entregar.
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
        note: `BAR - Venta rapida${staffMode ? " - STAFF" : ""} - ${product.name} - x${quantity}`,
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
      setError(e instanceof Error ? e.message : "No se pudo registrar la devolucion");
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
        <option value="MORNING">Manana</option>
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

      <Card>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div
            style={{
              borderRadius: 24,
              padding: 22,
              color: "#e2e8f0",
              background:
                "radial-gradient(circle at top left, rgba(134, 239, 172, 0.18), transparent 34%), linear-gradient(135deg, #052e2b 0%, #0f766e 50%, #082f49 100%)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#a7f3d0" }}>
                Operativa de punto
              </span>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#fff", lineHeight: 1.05 }}>Bar</div>
              <div style={{ fontSize: 14, color: "#d1fae5", maxWidth: 620 }}>
                Ventas rapidas y seguimiento de entregas del punto BAR durante el turno.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Origen: BAR
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Fecha: {today}
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Ventana: {summary?.ok ? `${hhmm(summary.computed?.meta?.windowFrom)} - ${hhmm(summary.computed?.meta?.windowTo)}` : "--"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <Stat label="Sistema neto" value={euros(systemNet)} />
            <Stat label="Pendientes de entrega" value={pendingTasks.length} />
            <Stat label="Cierre" value={summary?.isClosed ? "Cerrado" : "Abierto"} />
          </div>
        </div>
      </Card>

      <div style={styles.grid3}>
        <Stat label="Catering pendiente" value={cateringCount} />
        <Stat label="Extras pendientes" value={extrasCount} />
        <Stat label="Extras pendientes de devolucion" value={returnTasks.length} />
        <Stat label="Ventas del turno" value={euros(systemNet)} />
      </div>
      <Card
        title="TPV rapido"
        right={<div style={{ fontSize: 12, color: "#64748b" }}>Cada venta entra en BAR y en el cierre comun.</div>}
      >
        {loading ? (
          <Alert kind="info">Cargando resumen y catalogo del turno...</Alert>
        ) : catalog.length === 0 ? (
          <Alert kind="info">No hay categorias o productos activos en BAR.</Alert>
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
                  <Alert kind="info">No hay productos activos en esta categoria.</Alert>
                ) : (
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                    {category.products.map((product) => {
                      const quantity = getQuantity(product.id);
                      const stockValue = Number(product.currentStock ?? 0);
                      const minStockValue = Number(product.minStock ?? 0);
                      const lowStock = product.controlsStock && stockValue <= minStockValue;
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
                      const promoBadge = !staffMode && product.promotions?.length ? getBarPromotionBadge(product.promotions) : null;

                      return (
                        <div key={product.id} style={{ display: "grid", gap: 12, border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: lowStock ? "#fff7ed" : "#f8fafc" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            {promoBadge ? (
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ ...styles.pill, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontWeight: 900 }}>
                                  {promoBadge}
                                </span>
                              </div>
                            ) : null}
                            <div style={{ fontSize: 17, fontWeight: 900 }}>{product.name}</div>
                            <div style={{ fontSize: 13, color: "#64748b" }}>
                              {(unitPriceCents / 100).toFixed(2)} EUR - IVA {String(product.vatRate)}%
                              {staffMode && product.staffEligible ? " - STAFF" : ""}
                            </div>
                            {!staffMode && pricing.appliedPromotion ? (
                              <div style={{ fontSize: 12, fontWeight: 900, color: "#166534" }}>{pricing.label}</div>
                            ) : null}
                            {product.controlsStock ? (
                              <div style={{ fontSize: 12, color: lowStock ? "#c2410c" : "#475569", fontWeight: lowStock ? 800 : 500 }}>
                                Stock: {String(product.currentStock)} {product.unitLabel ?? "ud"}
                                {lowStock ? " - stock bajo" : ""}
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#475569" }}>Sin control de stock</div>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Cantidad</div>
                            <button type="button" onClick={() => setQuantities((prev) => ({ ...prev, [product.id]: Math.max(1, quantity - 1) }))} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}>-</button>
                            <input value={String(quantity)} onChange={(e) => {
                              const raw = Number(e.target.value);
                              setQuantities((prev) => ({ ...prev, [product.id]: Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1 }));
                            }} style={{ width: 70, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, textAlign: "center" }} />
                            <button type="button" onClick={() => setQuantities((prev) => ({ ...prev, [product.id]: quantity + 1 }))} style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}>+</button>
                            <div style={{ display: "grid", gap: 2 }}>
                              {!staffMode && pricing.appliedPromotion ? (
                                <div style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700 }}>
                                  Normal: {((unitPriceCents * quantity) / 100).toFixed(2)} EUR
                                </div>
                              ) : null}
                              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                                Total: {(pricing.totalCents / 100).toFixed(2)} EUR
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(["CASH", "CARD", "BIZUM", "TRANSFER"] as BarMethod[]).map((method) => {
                              const busy = actionBusy === `${product.id}-${method}`;
                              return (
                                <button key={method} type="button" onClick={() => void handleQuickSell(product, method)} disabled={busy} style={{ padding: "10px 14px", borderRadius: 12, cursor: "pointer", ...methodPill(method) }}>
                                  {busy ? "Guardando..." : `${method} - ${(pricing.totalCents / 100).toFixed(2)} EUR`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Pendientes de entrega">
        <div style={{ display: "grid", gap: 12 }}>
          {pendingTasks.length === 0 ? (
            <Alert kind="info">No hay pendientes de entrega.</Alert>
          ) : (
            pendingTasks.map((task) => {
              const hasUnmappedItems = task.items.some((item) => !item.barProductId);
              const deliverBusy = actionBusy === `deliver-${task.id}`;
              const incidentBusy = actionBusy === `incident-${task.id}`;

              return (
                <div key={task.id} style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...styles.pill, background: task.kind === "CATERING" ? "#eff6ff" : "#f5f3ff", border: `1px solid ${task.kind === "CATERING" ? "#bfdbfe" : "#ddd6fe"}`, color: task.kind === "CATERING" ? "#1d4ed8" : "#6d28d9", fontWeight: 900 }}>
                          {labelTaskKind(task.kind)}
                        </span>
                        <span style={{ fontWeight: 900 }}>{task.reservationLabel}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{task.customerName}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Hora {hhmm(task.time)} - {task.paid ? "Pagado" : "Pendiente de pago"}</div>
                      {hasUnmappedItems ? <div style={{ fontSize: 12, color: "#b45309", fontWeight: 800 }}>Hay items sin producto BAR vinculado. Revisa catalogo antes de entregar.</div> : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={() => void handleIncidentTask(task.id)} disabled={incidentBusy}>{incidentBusy ? "Guardando..." : "Incidencia"}</Button>
                      <Button variant="primary" onClick={() => void handleDeliverTask(task)} disabled={deliverBusy || hasUnmappedItems}>{deliverBusy ? "Entregando..." : "Entregado"}</Button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {task.items.map((item, idx) => (
                      <span key={`${task.id}-${idx}`} style={{ ...styles.pill, background: item.barProductId ? "#f8fafc" : "#fff7ed", border: `1px solid ${item.barProductId ? "#e2e8f0" : "#fed7aa"}`, color: "#0f172a" }}>
                        {item.name} - {item.quantity}
                        {!item.barProductId ? " - sin mapping" : ""}
                      </span>
                    ))}
                  </div>

                  {task.kind === "EXTRA" ? (
                    <div style={{ display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>Asignacion de unidad fisica</div>
                      {(taskAssets[task.id] ?? []).map((group) => (
                        <div key={group.taskItemId} style={{ display: "grid", gap: 6, gridTemplateColumns: "1.2fr 1fr", alignItems: "center" }}>
                          <div style={{ fontSize: 13, color: "#334155", fontWeight: 700 }}>{group.itemName} - {group.quantity}</div>
                          <Select value={taskSelections[task.id]?.[group.taskItemId] ?? ""} onChange={(e) => {
                            const value = e.target.value;
                            setTaskSelections((prev) => ({ ...prev, [task.id]: { ...(prev[task.id] ?? {}), [group.taskItemId]: value } }));
                          }}>
                            <option value="">Selecciona unidad</option>
                            {group.assets.map((asset) => (
                              <option key={asset.id} value={asset.id}>{asset.code ?? asset.name}{asset.size ? ` - ${asset.size}` : ""}</option>
                            ))}
                          </Select>
                        </div>
                      ))}
                      {(taskAssets[task.id] ?? []).length === 0 ? <div style={{ fontSize: 12, color: "#64748b" }}>No hay unidades disponibles para esta tarea.</div> : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Card>
      <Card title="Incidencias de equipos reutilizables">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Unidad</div>
              <Select value={incidentAssetId} onChange={(e) => setIncidentAssetId(e.target.value)}>
                <option value="">Selecciona unidad</option>
                {rentalAssets.filter((asset) => asset.status === "AVAILABLE" || asset.status === "DELIVERED").map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.code ?? asset.name}{asset.size ? ` - ${asset.size}` : ""}{asset.status ? ` - ${labelAssetStatus(asset.status)}` : ""}</option>
                ))}
              </Select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Tipo de incidencia</div>
              <Select value={incidentType} onChange={(e) => setIncidentType(e.target.value as "DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER")}>
                <option value="DAMAGED">Danado</option>
                <option value="MAINTENANCE">Mantenimiento</option>
                <option value="LOST">Perdido</option>
                <option value="OTHER">Otro</option>
              </Select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Nota</div>
              <Input value={incidentNote} onChange={(e) => setIncidentNote(e.target.value)} placeholder="Describe la incidencia" />
            </label>

            <Button variant="primary" onClick={() => void handleCreateIncident()} disabled={!incidentAssetId || actionBusy === `asset-incident-${incidentAssetId}`}>
              {actionBusy === `asset-incident-${incidentAssetId}` ? "Guardando..." : "Registrar incidencia"}
            </Button>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Nota al reactivar (opcional)</div>
            <Input value={reactivateNote} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReactivateNote(e.target.value)} placeholder="Ej: neopreno lavado y revisado / GoPro probada OK" />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            {rentalAssets.length === 0 ? (
              <Alert kind="info">No hay unidades registradas.</Alert>
            ) : (
              rentalAssets.map((asset) => (
                <div key={asset.id} style={{ display: "grid", gap: 8, border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: asset.status === "DAMAGED" ? "#fff1f2" : asset.status === "MAINTENANCE" ? "#fff7ed" : asset.status === "LOST" ? "#f8fafc" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 900 }}>{asset.code ?? asset.name}{asset.size ? ` - ${asset.size}` : ""}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{labelAssetType(asset.type)} - {labelAssetStatus(asset.status)}</div>
                    </div>

                    {asset.assignments?.[0]?.task?.reservation ? (
                      <div style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>
                        Asignada a reserva #{asset.assignments[0].task.reservation.id.slice(-6)}
                        {asset.assignments[0].task.reservation.customerName ? ` - ${asset.assignments[0].task.reservation.customerName}` : ""}
                      </div>
                    ) : null}
                  </div>

                  {asset.notes ? <div style={{ fontSize: 12, color: "#475569" }}>Nota: {asset.notes}</div> : null}

                  {asset.status !== "AVAILABLE" && asset.status !== "DELIVERED" && asset.status !== "INACTIVE" ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Button onClick={() => void handleReactivateAsset(asset.id)} disabled={actionBusy === `reactivate-${asset.id}`}>{actionBusy === `reactivate-${asset.id}` ? "Reactivando..." : "Reactivar"}</Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card title="Pendientes de devolucion">
        <div style={{ display: "grid", gap: 12 }}>
          {returnTasks.length === 0 ? (
            <Alert kind="info">No hay extras pendientes de devolucion.</Alert>
          ) : (
            returnTasks.map((task) => {
              const hasUnmappedItems = task.items.some((item) => !item.barProductId);
              const returnBusy = actionBusy === `return-${task.id}`;
              const incidentBusy = actionBusy === `incident-${task.id}`;

              return (
                <div key={task.id} style={{ display: "grid", gap: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ ...styles.pill, background: "#fef3c7", border: "1px solid #fcd34d", color: "#92400e", fontWeight: 900 }}>Devolucion</span>
                        <span style={{ fontWeight: 900 }}>{task.reservationLabel}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{task.customerName}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>Hora {hhmm(task.time)} - {task.paid ? "Pagado" : "Pendiente de pago"}</div>
                      {hasUnmappedItems ? <div style={{ fontSize: 12, color: "#b45309", fontWeight: 800 }}>Hay items heredados sin mapping. No se puede registrar la devolucion automatica.</div> : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={() => void handleIncidentTask(task.id)} disabled={incidentBusy}>{incidentBusy ? "Guardando..." : "Incidencia"}</Button>
                      <Button variant="primary" onClick={() => void handleReturnTask(task.id)} disabled={returnBusy || hasUnmappedItems}>{returnBusy ? "Registrando..." : "Devuelto"}</Button>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {task.items.map((item, idx) => (
                      <span key={`${task.id}-${idx}`} style={{ ...styles.pill, background: item.barProductId ? "#f8fafc" : "#fff7ed", border: `1px solid ${item.barProductId ? "#e2e8f0" : "#fed7aa"}`, color: "#0f172a" }}>
                        {item.name} - {item.quantity}
                        {!item.barProductId ? " - sin mapping" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </Page>
  );
}
