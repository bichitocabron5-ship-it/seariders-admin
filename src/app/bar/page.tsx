"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import CashChangeHelper from "@/components/cash-change-helper";
import { Alert, Button, Card, Page, Select, styles } from "@/components/ui";
import { BarOverviewSection } from "./_components/BarOverviewSection";
import { BarPendingDeliveriesSection } from "./_components/BarPendingDeliveriesSection";
import { BarPendingReturnsSection } from "./_components/BarPendingReturnsSection";
import { BarQuickSellProductCard } from "./_components/BarQuickSellProductCard";
import { BarRentalIncidentsSection } from "./_components/BarRentalIncidentsSection";
import {
  createBarPayment,
  getBarStaffOptions,
  createRentalAssetIncident,
  deliverBarFulfillmentTask,
  getAvailableAssetsForTask,
  getBarCashSummary,
  getBarProducts,
  getBarRentalAssets,
  getBarReturnFulfillmentTasks,
  getPendingBarStaffSales,
  getPendingBarFulfillmentTasks,
  reactivateRentalAsset,
  reportBarFulfillmentIncident,
  returnBarFulfillmentTask,
  settlePendingBarStaffSale,
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
  pendingStaff?: { count?: number; totalCents?: number };
};

type StaffOption = {
  id: string;
  fullName: string;
  code: string | null;
  kind: string;
  jobTitle: string | null;
};

type PendingStaffSale = {
  id: string;
  soldAt: string;
  totalRevenueCents: number;
  note: string | null;
  employee: { id: string; fullName: string; code: string | null } | null;
  employeeName: string;
  soldByUser: { id: string; fullName: string | null; username: string | null } | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    revenueCents: number;
  }>;
};

type CartItem = {
  productId: string;
  quantity: number;
};

function businessDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

function centsFromEuroInput(value: string) {
  const parsed = Number((value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
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
  const shift = "MORNING" as const;
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<BarCategoryWithProducts[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [staffMode, setStaffMode] = useState(false);
  const [staffEmployeeId, setStaffEmployeeId] = useState("");
  const [manualDiscountEuros, setManualDiscountEuros] = useState("");
  const [manualDiscountReason, setManualDiscountReason] = useState("");
  const [showCashHelper, setShowCashHelper] = useState(false);
  const [cashReceivedEuros, setCashReceivedEuros] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [pendingStaffSales, setPendingStaffSales] = useState<PendingStaffSale[]>([]);

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
      const [summaryData, productsData, pendingData, returnsData, assetsData, staffOptionsData, pendingStaffData] = await Promise.all([
        getBarCashSummary({ date: today, shift }),
        getBarProducts(),
        getPendingBarFulfillmentTasks(),
        getBarReturnFulfillmentTasks(),
        getBarRentalAssets(),
        getBarStaffOptions(),
        getPendingBarStaffSales(),
      ]);

      setSummary(summaryData);
      setCatalog(productsData.rows ?? []);
      setPendingTasks(pendingData.rows ?? []);
      setReturnTasks(returnsData.rows ?? []);
      setRentalAssets(assetsData.rows ?? []);
      setStaffOptions(staffOptionsData.rows ?? []);
      setPendingStaffSales(pendingStaffData.rows ?? []);

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
      setStaffOptions([]);
      setPendingStaffSales([]);
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
  const productsById = useMemo(() => {
    const map = new Map<string, BarCategoryWithProducts["products"][number]>();
    for (const category of catalog) {
      for (const product of category.products) map.set(product.id, product);
    }
    return map;
  }, [catalog]);

  const cartLines = useMemo(() => {
    return cart
      .map((item) => {
        const product = productsById.get(item.productId);
        if (!product) return null;

        const unitPriceCents =
          staffMode && product.staffEligible && product.staffPriceCents != null
            ? Number(product.staffPriceCents)
            : Number(product.salePriceCents);

        const pricing = calculateBarLineTotal({
          unitPriceCents,
          quantity: item.quantity,
          promotions: product.promotions,
          staffMode,
          staffPriceCents: product.staffPriceCents,
        });

        return {
          ...item,
          product,
          pricing,
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      quantity: number;
      product: BarCategoryWithProducts["products"][number];
      pricing: ReturnType<typeof calculateBarLineTotal>;
    }>;
  }, [cart, productsById, staffMode]);

  const cartSubtotalBeforeManualCents = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.pricing.subtotalBeforeManualCents, 0),
    [cartLines]
  );
  const cartBaseTotalCents = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.pricing.baseTotalCents, 0),
    [cartLines]
  );
  const cartAutoDiscountCents = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.pricing.autoDiscountCents, 0),
    [cartLines]
  );
  const canApplyManualDiscount =
    !staffMode && cartLines.length > 0 && cartLines.every((line) => line.product.type === "DRINK");
  const requestedManualDiscountCents = centsFromEuroInput(manualDiscountEuros);
  const appliedManualDiscountCents = canApplyManualDiscount
    ? Math.min(
        Math.max(0, requestedManualDiscountCents),
        Math.max(0, cartSubtotalBeforeManualCents - 1)
      )
    : 0;
  const cartTotalCents = Math.max(0, cartSubtotalBeforeManualCents - appliedManualDiscountCents);

  function getQuantity(productId: string) {
    return Math.max(1, Number(quantities[productId] ?? 1));
  }

  function handleAddToCart(product: BarCategoryWithProducts["products"][number]) {
    const quantity = getQuantity(product.id);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { productId: product.id, quantity }];
    });
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
  }

  function updateCartItemQuantity(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item))
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  async function handleCartCheckout(
    method: BarMethod | null,
    options?: { deferStaffPayment?: boolean }
  ) {
    try {
      setError(null);
      const busyKey = options?.deferStaffPayment ? "cart-STAFF_PENDING" : `cart-${method}`;
      setActionBusy(busyKey);

      if (cartLines.length === 0) {
        throw new Error("Añade productos al carrito antes de cobrar.");
      }

      if (staffMode && !staffEmployeeId) {
        throw new Error("Selecciona el trabajador para la venta STAFF.");
      }

      if (appliedManualDiscountCents > 0 && !manualDiscountReason.trim()) {
        throw new Error("Indica el motivo del descuento manual.");
      }

      await createBarPayment({
        items: cartLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        amountCents: cartTotalCents,
        method,
        date: today,
        shift,
        label: `Venta conjunta BAR (${cartLines.length} líneas)`,
        staffMode,
        staffEmployeeId: staffMode ? staffEmployeeId : null,
        deferStaffPayment: options?.deferStaffPayment ?? false,
        note: `BAR - Venta conjunta${staffMode ? " - STAFF" : ""} - ${cartLines
          .map((line) => `${line.product.name} x${line.quantity}`)
          .join(" · ")}`,
        manualDiscountCents: appliedManualDiscountCents,
        manualDiscountReason: appliedManualDiscountCents > 0 ? manualDiscountReason.trim() : null,
      });

      setCart([]);
      setManualDiscountEuros("");
      setManualDiscountReason("");
      setShowCashHelper(false);
      setCashReceivedEuros("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la venta");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSettlePendingStaffSale(saleId: string, method: BarMethod) {
    try {
      setError(null);
      setActionBusy(`settle-${saleId}-${method}`);
      await settlePendingBarStaffSale({
        saleId,
        method,
        date: today,
        shift,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cobrar la venta staff pendiente");
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
        right={<div style={{ fontSize: 12, color: "#64748b" }}>Venta conjunta con cobro único y cuadre directo en caja.</div>}
      >
        {loading ? (
          <Alert kind="info">Cargando resumen y catálogo del turno...</Alert>
        ) : catalog.length === 0 ? (
          <Alert kind="info">No hay categorías o productos activos en BAR.</Alert>
        ) : (
          <div style={{ display: "grid", gap: 18 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800, color: "#334155" }}>
              <input
                type="checkbox"
                checked={staffMode}
                onChange={(e) => {
                  setStaffMode(e.target.checked);
                  setCart([]);
                  setManualDiscountEuros("");
                  setManualDiscountReason("");
                  setShowCashHelper(false);
                  setCashReceivedEuros("");
                }}
              />
              Modo staff
            </label>

            {staffMode ? (
              <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Trabajador</div>
                <Select value={staffEmployeeId} onChange={(e) => setStaffEmployeeId(e.target.value)}>
                  <option value="">Selecciona trabajador</option>
                  {staffOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                      {employee.code ? ` · ${employee.code}` : ""}
                      {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 14,
                border: "1px solid #cbd5e1",
                borderRadius: 18,
                padding: 16,
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>Carrito actual</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {cartLines.length === 0
                      ? "Sin productos añadidos."
                      : `${cartLines.length} líneas · ${cartLines.reduce((sum, line) => sum + line.quantity, 0)} uds`}
                  </div>
                </div>
                {cartLines.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setManualDiscountEuros("");
                      setManualDiscountReason("");
                      setShowCashHelper(false);
                      setCashReceivedEuros("");
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 800,
                    }}
                  >
                    Vaciar carrito
                  </button>
                ) : null}
              </div>

              {cartLines.length === 0 ? (
                <Alert kind="info">Añade varias bebidas o productos y cobra la venta como una sola operación.</Alert>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {cartLines.map((line) => (
                    <div
                      key={line.productId}
                      style={{
                        display: "grid",
                        gap: 8,
                        gridTemplateColumns: "minmax(220px, 1.4fr) minmax(120px, 0.8fr) minmax(140px, 0.8fr) auto",
                        alignItems: "center",
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        padding: 12,
                        background: "#fff",
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>{line.product.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          {(line.pricing.unitPriceCents / 100).toFixed(2)} EUR/u
                          {line.pricing.autoDiscountCents > 0 ? ` · ${line.pricing.label}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(line.productId, line.quantity - 1)}
                          style={{ width: 30, height: 30, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}
                        >
                          -
                        </button>
                        <input
                          value={String(line.quantity)}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            updateCartItemQuantity(line.productId, Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
                          }}
                          style={{ width: 62, padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, textAlign: "center" }}
                        />
                        <button
                          type="button"
                          onClick={() => updateCartItemQuantity(line.productId, line.quantity + 1)}
                          style={{ width: 30, height: 30, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: 900 }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ display: "grid", gap: 2, justifyItems: "end" }}>
                        {line.pricing.baseTotalCents > line.pricing.subtotalBeforeManualCents ? (
                          <div style={{ fontSize: 12, color: "#94a3b8", textDecoration: "line-through", fontWeight: 700 }}>
                            {euros(line.pricing.baseTotalCents)}
                          </div>
                        ) : null}
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{euros(line.pricing.subtotalBeforeManualCents)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.productId)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #fecaca",
                          background: "#fff1f2",
                          color: "#9f1239",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Base antes de promos</div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{euros(cartBaseTotalCents)}</div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Descuento por promos</div>
                  <div style={{ fontSize: 18, fontWeight: 950, color: cartAutoDiscountCents > 0 ? "#166534" : "#0f172a" }}>
                    {euros(cartAutoDiscountCents)}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Subtotal</div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{euros(cartSubtotalBeforeManualCents)}</div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Descuento manual</div>
                  <div style={{ fontSize: 18, fontWeight: 950, color: appliedManualDiscountCents > 0 ? "#166534" : "#0f172a" }}>
                    {euros(appliedManualDiscountCents)}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Total a cobrar</div>
                  <div style={{ fontSize: 24, fontWeight: 950 }}>{euros(cartTotalCents)}</div>
                </div>
              </div>

              {!staffMode ? (
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Descuento manual total (EUR)</div>
                    <input
                      value={manualDiscountEuros}
                      onChange={(e) => setManualDiscountEuros(e.target.value)}
                      placeholder={canApplyManualDiscount ? "0,00" : "Solo ventas de bebidas"}
                      disabled={!canApplyManualDiscount}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: canApplyManualDiscount ? "#fff" : "#f1f5f9" }}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Motivo del descuento</div>
                    <input
                      value={manualDiscountReason}
                      onChange={(e) => setManualDiscountReason(e.target.value)}
                      placeholder={canApplyManualDiscount ? "Ej: pack manual por varias latas" : "Disponible solo en bebidas"}
                      disabled={!canApplyManualDiscount}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #cbd5e1", background: canApplyManualDiscount ? "#fff" : "#f1f5f9" }}
                    />
                  </label>
                </div>
              ) : null}

              {!staffMode && cartLines.length > 0 && !canApplyManualDiscount ? (
                <Alert kind="info">El descuento manual solo se habilita cuando toda la venta está compuesta por bebidas.</Alert>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["CASH", "CARD", "BIZUM", "TRANSFER"] as BarMethod[]).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      if (method === "CASH") {
                        setShowCashHelper((prev) => !prev);
                        return;
                      }
                      void handleCartCheckout(method);
                    }}
                    disabled={cartLines.length === 0 || actionBusy === `cart-${method}`}
                    style={{ padding: "10px 14px", borderRadius: 12, cursor: "pointer", ...methodPill(method) }}
                  >
                    {actionBusy === `cart-${method}` ? "Guardando..." : `${method} · ${euros(cartTotalCents)}`}
                  </button>
                ))}
                {staffMode ? (
                  <button
                    type="button"
                    onClick={() => void handleCartCheckout(null, { deferStaffPayment: true })}
                    disabled={cartLines.length === 0 || actionBusy === "cart-STAFF_PENDING"}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid #fed7aa",
                      background: "#fff7ed",
                      color: "#9a3412",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {actionBusy === "cart-STAFF_PENDING" ? "Guardando..." : `Pendiente STAFF · ${euros(cartTotalCents)}`}
                  </button>
                ) : null}
              </div>

              {showCashHelper ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #dbe4ea",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                    Cobro en efectivo · total {euros(cartTotalCents)}
                  </div>
                  <CashChangeHelper
                    amountEuros={(cartTotalCents / 100).toFixed(2)}
                    receivedEuros={cashReceivedEuros}
                    onReceivedEurosChange={setCashReceivedEuros}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => void handleCartCheckout("CASH")}
                      disabled={cartLines.length === 0 || actionBusy === "cart-CASH"}
                      style={{ padding: "10px 14px", borderRadius: 12, cursor: "pointer", ...methodPill("CASH") }}
                    >
                      {actionBusy === "cart-CASH" ? "Guardando..." : "Confirmar efectivo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCashHelper(false);
                        setCashReceivedEuros("");
                      }}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 800,
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

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
                          onDecreaseQuantity={() =>
                            setQuantities((prev) => ({ ...prev, [product.id]: Math.max(1, quantity - 1) }))
                          }
                          onSetQuantity={(value) =>
                            setQuantities((prev) => ({ ...prev, [product.id]: value }))
                          }
                          onIncreaseQuantity={() =>
                            setQuantities((prev) => ({ ...prev, [product.id]: quantity + 1 }))
                          }
                          onAddToCart={() => handleAddToCart(product)}
                          addingToCart={false}
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

      <Card
        title="Cobros pendientes staff"
        right={
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Abiertos: {pendingStaffSales.length} · Importe: {euros(pendingStaffSales.reduce((sum, sale) => sum + sale.totalRevenueCents, 0))}
          </div>
        }
      >
        {pendingStaffSales.length === 0 ? (
          <Alert kind="info">No hay ventas staff pendientes de cobro.</Alert>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pendingStaffSales.map((sale) => (
              <div key={sale.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{sale.employeeName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(sale.soldAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {sale.soldByUser?.fullName || sale.soldByUser?.username ? ` · Vendido por ${sale.soldByUser.fullName ?? sale.soldByUser.username}` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      {sale.items.map((item) => `${item.productName} x${item.quantity}`).join(" · ")}
                    </div>
                    {sale.note ? <div style={{ fontSize: 12, color: "#64748b" }}>{sale.note}</div> : null}
                  </div>
                  <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>{euros(sale.totalRevenueCents)}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {(["CASH", "CARD", "BIZUM", "TRANSFER"] as BarMethod[]).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => void handleSettlePendingStaffSale(sale.id, method)}
                          disabled={actionBusy === `settle-${sale.id}-${method}`}
                          style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer", ...methodPill(method) }}
                        >
                          {actionBusy === `settle-${sale.id}-${method}` ? "Guardando..." : `Cobrar ${method}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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
