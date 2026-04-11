// src/app/store/bonos/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { StoreHero, StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import { getCountryOptionsEs, type CountryOption } from "@/lib/countries";

type PassProductDto = {
  id: string;
  code: string;
  name: string;
  totalMinutes: number;
  priceCents: number;
  validDays: number | null;
  service: { id: string; name: string; category: string | null };
};

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

function euroInputToCents(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function centsToEuroInput(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2).replace(".", ",");
}

function todayMadridYMD() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hhmmNowRounded(step = 5) {
  const d = new Date();
  const m = Math.round(d.getMinutes() / step) * step;
  d.setMinutes(m, 0, 0);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function parseMinutesOption(v: string): MinutesOption {
  const n = Number(v);
  if (n === 20 || n === 30 || n === 60 || n === 120 || n === 180) return n;
  return 30;
}

type PassVoucherDto = {
  id: string;
  code: string;
  soldAt: string;
  expiresAt: string | null;
  salePriceCents: number;
  paidCents: number;
  pendingCents: number;
  isFullyPaid: boolean;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  minutesTotal: number;
  minutesRemaining: number;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  customerCountry: string | null;
  customerAddress: string | null;
  customerDocType: string | null;
  customerDocNumber: string | null;
  product: {
    id: string;
    code: string;
    name: string;
    totalMinutes: number;
    priceCents: number;
    service: { id: string; name: string; category: string | null };
    option: { id: string; durationMinutes: number | null } | null;
  };
  salePayments: Array<{
    id: string;
    amountCents: number;
    method: PassMethod;
    direction: "IN" | "OUT";
    createdAt: string;
  }>;
  consumes: Array<{
    id: string;
    consumedAt: string;
    minutesUsed: number;
    reservationId: string | null;
  }>;
};

type PassSummaryRow = {
  id: string;
  code: string;
  soldAt: string;
  expiresAt: string | null;
  salePriceCents: number;
  paidCents: number;
  pendingCents: number;
  buyerName?: string | null;
  buyerPhone?: string | null;
  minutesRemaining: number;
  minutesTotal: number;
  product?: { name?: string | null } | null;
};

type PassMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";
type MinutesOption = 20 | 30 | 60 | 120 | 180;
type SellPaymentMode = "FULL" | "PARTIAL";

const shellStyle: React.CSSProperties = storeStyles.shell;
const panelStyle: React.CSSProperties = storeStyles.panel;
const labelTitleStyle: React.CSSProperties = { fontSize: 12, opacity: 0.75, fontWeight: 800 };
const inputStyle: React.CSSProperties = { ...storeStyles.input, padding: 12 };
const primaryButtonStyle: React.CSSProperties = { ...storeStyles.primaryButton, padding: "12px 14px", fontWeight: 900 };
const secondaryButtonStyle: React.CSSProperties = { ...storeStyles.secondaryButton, padding: "12px 14px", fontWeight: 800 };

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={labelTitleStyle}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function SummaryCard({
  row,
  onSelect,
  subtitle,
}: {
  row: PassSummaryRow;
  onSelect: (code: string) => void;
  subtitle: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.code)}
      style={{
        textAlign: "left",
        padding: 14,
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        background: "#fff",
        cursor: "pointer",
        display: "grid",
        gap: 6,
      }}
      title="Cargar este bono"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>{row.product?.name ?? "Bono"}</div>
        <div style={{ fontWeight: 900 }}>{row.code}</div>
      </div>
      <div style={{ fontSize: 13, color: "#475569" }}>
        {row.buyerName ? `Nombre: ${row.buyerName}` : "Sin nombre"} | {row.buyerPhone ? `Tel: ${row.buyerPhone}` : "Sin teléfono"}
      </div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{subtitle}</div>
    </button>
  );
}

export default function StoreBonosPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [voucher, setVoucher] = useState<PassVoucherDto | null>(null);

  const [saving, setSaving] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [customerCountry, setCustomerCountry] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerDocType, setCustomerDocType] = useState("");
  const [customerDocNumber, setCustomerDocNumber] = useState("");

  const [consumeDate, setConsumeDate] = useState(todayMadridYMD());
  const [consumeTime, setConsumeTime] = useState(hhmmNowRounded(5));
  const [minutesToUse, setMinutesToUse] = useState<MinutesOption>(30);
  const [consuming, setConsuming] = useState(false);

  const [products, setProducts] = useState<PassProductDto[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [soldToday, setSoldToday] = useState<PassSummaryRow[]>([]);
  const [pendingTop, setPendingTop] = useState<PassSummaryRow[]>([]);

  const [sellProductId, setSellProductId] = useState<string>("");
  const [sellMethod, setSellMethod] = useState<PassMethod>("CARD");
  const [sellPaymentMode, setSellPaymentMode] = useState<SellPaymentMode>("FULL");
  const [sellAmountNow, setSellAmountNow] = useState("");
  const [selling, setSelling] = useState(false);
  const [lastSold, setLastSold] = useState<{ code: string; expiresAt: string | null; paidCents: number; pendingCents: number } | null>(null);

  const [sellBuyerName, setSellBuyerName] = useState("");
  const [sellBuyerPhone, setSellBuyerPhone] = useState("");
  const [sellBuyerEmail, setSellBuyerEmail] = useState("");

  const [sellCustomerCountry, setSellCustomerCountry] = useState("ES");
  const [sellCustomerAddress, setSellCustomerAddress] = useState("");
  const [sellCustomerDocType, setSellCustomerDocType] = useState("");
  const [sellCustomerDocNumber, setSellCustomerDocNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PassMethod>("CARD");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [payingPending, setPayingPending] = useState(false);

  const countryOptions = useMemo(() => getCountryOptionsEs(), []);
  const selectedSellCountryOpt = useMemo(() => {
    const v = String(sellCustomerCountry ?? "").toUpperCase();
    return countryOptions.find((c) => c.value === v) ?? null;
  }, [sellCustomerCountry, countryOptions]);

  const selectedCountryOpt = useMemo(() => {
    const v = String(customerCountry ?? "").toUpperCase();
    return countryOptions.find((c) => c.value === v) ?? null;
  }, [customerCountry, countryOptions]);

  const selectedSellProduct = useMemo(() => products.find((p) => p.id === sellProductId) ?? null, [products, sellProductId]);
  const initialChargeCents = useMemo(() => {
    if (!selectedSellProduct) return null;
    if (sellPaymentMode === "FULL") return selectedSellProduct.priceCents;
    return euroInputToCents(sellAmountNow);
  }, [selectedSellProduct, sellPaymentMode, sellAmountNow]);

  useEffect(() => {
    loadProducts();
    loadSummary();
  }, []);

  async function loadProducts() {
    setErr(null);
    setProductsLoading(true);
    try {
      const r = await fetch("/api/store/passes/products", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setProducts((j.products ?? []) as PassProductDto[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando productos de bono");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  async function sell() {
    if (!sellProductId) return;

    setErr(null);
    setSelling(true);
    try {
      const r = await fetch("/api/store/passes/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: sellProductId,
          method: sellMethod,
          amountToPayNowCents: initialChargeCents ?? undefined,
          buyerName: sellBuyerName,
          buyerPhone: sellBuyerPhone,
          buyerEmail: sellBuyerEmail,
          customerCountry: sellCustomerCountry,
          customerAddress: sellCustomerAddress,
          customerDocType: sellCustomerDocType,
          customerDocNumber: sellCustomerDocNumber,
        }),
      });

      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const v = j.voucher ?? j.passVoucher ?? null;

      setLastSold({
        code: v?.code ?? "-",
        expiresAt: v?.expiresAt ?? null,
        paidCents: Number(v?.paidCents ?? initialChargeCents ?? 0),
        pendingCents: Math.max(0, Number(v?.salePriceCents ?? selectedSellProduct?.priceCents ?? 0) - Number(v?.paidCents ?? initialChargeCents ?? 0)),
      });
      setSellBuyerName("");
      setSellBuyerPhone("");
      setSellBuyerEmail("");
      setSellPaymentMode("FULL");
      setSellAmountNow("");
      await loadSummary();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error vendiendo bono");
    } finally {
      setSelling(false);
    }
  }

  async function search() {
    const c = code.trim().toUpperCase();
    if (!c) return;

    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/store/passes/voucher?code=${encodeURIComponent(c)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      const v: PassVoucherDto = j.voucher;

      setVoucher(v);
      setBuyerName(v.buyerName ?? "");
      setBuyerPhone(v.buyerPhone ?? "");
      setBuyerEmail(v.buyerEmail ?? "");
      setCustomerCountry(v.customerCountry ?? "ES");
      setCustomerAddress(v.customerAddress ?? "");
      setCustomerDocType(v.customerDocType ?? "");
      setCustomerDocNumber(v.customerDocNumber ?? "");
      setPaymentAmount(centsToEuroInput(v.pendingCents ?? 0));
    } catch (e: unknown) {
      setVoucher(null);
      setErr(e instanceof Error ? e.message : "Error buscando bono");
    } finally {
      setLoading(false);
    }
  }

  async function savePro() {
    if (!voucher) return;
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/store/passes/voucher", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucher.code,
          buyerName,
          buyerPhone,
          buyerEmail,
          customerCountry,
          customerAddress,
          customerDocType,
          customerDocNumber,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      await search();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error guardando datos del bono");
    } finally {
      setSaving(false);
    }
  }

  const canConsume = useMemo(() => {
    if (!voucher) return false;
    if (voucher.isVoided) return false;
    if (voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now()) return false;
    if ((voucher.pendingCents ?? 0) > 0) return false;
    if (voucher.minutesRemaining < minutesToUse) return false;
    return true;
  }, [voucher, minutesToUse]);

  async function payPending() {
    if (!voucher) return;
    const amountCents = euroInputToCents(paymentAmount);
    if (!amountCents || amountCents <= 0) {
      setErr("Importe pendiente inválido");
      return;
    }

    setErr(null);
    setPayingPending(true);
    try {
      const r = await fetch("/api/store/passes/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucher.code,
          method: paymentMethod,
          amountCents,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      await search();
      await loadSummary();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cobrando el pendiente del bono");
    } finally {
      setPayingPending(false);
    }
  }

  async function consumeAndFormalize() {
    if (!voucher) return;
    setErr(null);
    setConsuming(true);
    try {
      const r = await fetch("/api/store/passes/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucher.code,
          minutesToUse,
          activityDate: consumeDate,
          time: consumeTime,
          channelId: null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      router.push(`/store/create?migrateFrom=${j.reservationId}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error consumiendo bono");
    } finally {
      setConsuming(false);
    }
  }

  async function loadSummary() {
    setErr(null);
    setSummaryLoading(true);
    try {
      const r = await fetch("/api/store/passes/summary", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setPendingTop(j.pending ?? []);
      setSoldToday(j.soldToday ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando resumen de bonos");
      setPendingTop([]);
      setSoldToday([]);
    } finally {
      setSummaryLoading(false);
    }
  }

  function loadVoucherCode(nextCode: string) {
    setCode(nextCode);
    setTimeout(() => search(), 0);
  }

  return (
    <div style={shellStyle}>
      <StoreHero
        title="Bonos"
        description="Venta, consulta y consumo de bonos con acceso directo a la formalización en tienda."
        eyebrowColor="#0369a1"
        actions={
          <>
          <button type="button" onClick={loadSummary} disabled={summaryLoading} style={secondaryButtonStyle}>
            {summaryLoading ? "Refrescando..." : "Refrescar resumen"}
          </button>
          <button type="button" onClick={() => router.push("/store")} style={secondaryButtonStyle}>
            Volver a Store
          </button>
          </>
        }
      />

      {err ? (
        <div style={{ padding: 12, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 700 }}>
          {err}
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <div style={{ ...panelStyle, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Vender bono</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Selecciona producto, método de pago y datos opcionales del comprador.</div>
          </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={labelTitleStyle}>Producto</div>
              <select value={sellProductId} onChange={(e) => setSellProductId(e.target.value)} disabled={productsLoading} style={inputStyle}>
                <option value="" disabled>
                  Selecciona...
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} | {Math.round((p.totalMinutes ?? 0) / 60)} h | {euros(p.priceCents)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={labelTitleStyle}>Método de pago</div>
              <select value={sellMethod} onChange={(e) => setSellMethod(e.target.value as PassMethod)} style={inputStyle}>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="BIZUM">Bizum</option>
                <option value="TRANSFER">Transferencia</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={labelTitleStyle}>Modo de cobro</div>
              <select value={sellPaymentMode} onChange={(e) => setSellPaymentMode(e.target.value as SellPaymentMode)} style={inputStyle}>
                <option value="FULL">Cobrar todo</option>
                <option value="PARTIAL">Paga y señal / parte</option>
              </select>
            </label>
            <Field
              label="Importe a cobrar ahora"
              value={sellPaymentMode === "FULL" ? centsToEuroInput(selectedSellProduct?.priceCents ?? 0) : sellAmountNow}
              onChange={setSellAmountNow}
              placeholder="0,00"
            />
          </div>

          <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 900 }}>Comprador y datos contractuales</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Nombre" value={sellBuyerName} onChange={setSellBuyerName} placeholder="Nombre y apellidos" />
              <Field label="Teléfono" value={sellBuyerPhone} onChange={setSellBuyerPhone} placeholder="+34 6xx xxx xxx" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Email" value={sellBuyerEmail} onChange={setSellBuyerEmail} placeholder="cliente@email.com" />
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelTitleStyle}>País</div>
                <Select<CountryOption, false>
                  instanceId="pass-sell-country"
                  inputId="pass-sell-country"
                  options={countryOptions}
                  value={selectedSellCountryOpt}
                  onChange={(opt) => setSellCustomerCountry((opt?.value ?? "").toUpperCase())}
                  placeholder="Escribe para buscar..."
                />
              </div>
            </div>

            <Field label="Dirección" value={sellCustomerAddress} onChange={setSellCustomerAddress} placeholder="Calle, número, ciudad..." />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={labelTitleStyle}>Tipo de documento</div>
                <select value={sellCustomerDocType} onChange={(e) => setSellCustomerDocType(e.target.value)} style={inputStyle}>
                  <option value="">Opcional</option>
                  <option value="DNI">DNI</option>
                  <option value="NIE">NIE</option>
                  <option value="PASSPORT">Pasaporte</option>
                </select>
              </label>
              <Field label="Número de documento" value={sellCustomerDocNumber} onChange={setSellCustomerDocNumber} placeholder="12345678A" />
            </div>
          </div>

          <button
            type="button"
            onClick={sell}
            disabled={
              selling ||
              !sellProductId ||
              initialChargeCents == null ||
              initialChargeCents <= 0 ||
              Number(initialChargeCents) > Number(selectedSellProduct?.priceCents ?? 0)
            }
            style={{ ...primaryButtonStyle, opacity: selling ? 0.7 : 1 }}
          >
            {selling ? "Vendiendo..." : `Crear bono${selectedSellProduct ? ` | total ${euros(selectedSellProduct.priceCents)} | cobra ahora ${euros(initialChargeCents ?? 0)}` : ""}`}
          </button>

          {lastSold ? (
            <div style={{ padding: 12, borderRadius: 14, border: "1px solid #bbf7d0", background: "#f0fdf4", display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 900 }}>Bono vendido</div>
              <div style={{ fontSize: 13, color: "#166534" }}>
                Código: <b>{lastSold.code}</b>
                {` | Cobrado: ${euros(lastSold.paidCents)}`}
                {lastSold.pendingCents > 0 ? ` | Pendiente: ${euros(lastSold.pendingCents)}` : " | Totalmente pagado"}
                {lastSold.expiresAt ? ` | Caduca: ${new Date(lastSold.expiresAt).toLocaleString("es-ES")}` : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ ...panelStyle, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Buscar bono</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Consulta estado, datos guardados y últimos consumos.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 170px", gap: 10, alignItems: "end" }}>
            <Field label="Código" value={code} onChange={setCode} placeholder="BN-1234-567" />
            <button type="button" onClick={search} disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>

          <StoreMetricGrid>
            <StoreMetricCard label="Pendientes" value={pendingTop.length} />
            <StoreMetricCard label="Vendidos hoy" value={soldToday.length} />
            <StoreMetricCard label="Productos" value={products.length} />
          </StoreMetricGrid>
        </div>
      </section>

      {voucher ? (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{voucher.code}</div>
              <div style={{ padding: "6px 10px", borderRadius: 999, background: voucher.isVoided ? "#fee2e2" : voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now() ? "#fef3c7" : "#dcfce7", color: voucher.isVoided ? "#991b1b" : voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now() ? "#92400e" : "#166534", fontWeight: 900 }}>
                {voucher.isVoided ? "ANULADO" : voucher.expiresAt && new Date(voucher.expiresAt).getTime() < Date.now() ? "CADUCADO" : "ACTIVO"}
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#475569" }}>
              Producto: <b>{voucher.product?.name}</b>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Precio del bono</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(voucher.salePriceCents)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Cobrado</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(voucher.paidCents)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: "#fef3c7", border: "1px solid #fcd34d" }}>
                <div style={{ fontSize: 12, color: "#92400e", fontWeight: 800 }}>Pendiente</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: voucher.pendingCents > 0 ? "#92400e" : "#166534" }}>{euros(voucher.pendingCents)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Minutos restantes</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{voucher.minutesRemaining}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Minutos totales</div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{voucher.minutesTotal}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "#475569" }}>
              Caduca: <b>{voucher.expiresAt ? new Date(voucher.expiresAt).toLocaleString("es-ES") : "-"}</b>
            </div>

            <div style={{ fontWeight: 900 }}>Cobros asociados</div>
            {(voucher.salePayments ?? []).length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {voucher.salePayments.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#475569" }}>{new Date(p.createdAt).toLocaleString("es-ES")} | {p.method}</span>
                    <b>{euros(p.amountCents)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>Sin cobros registrados.</div>
            )}

            <div style={{ fontWeight: 900 }}>Últimos consumos</div>
            {(voucher.consumes ?? []).length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {voucher.consumes.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", fontSize: 13, padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#475569" }}>{new Date(c.consumedAt).toLocaleString("es-ES")}</span>
                    <b>-{c.minutesUsed} min</b>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>Sin consumos todavía.</div>
            )}
          </div>

          <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Datos guardados</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Se reutilizan al formalizar una reserva desde el bono.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Nombre" value={buyerName} onChange={setBuyerName} placeholder="Nombre y apellidos" />
              <Field label="Teléfono" value={buyerPhone} onChange={setBuyerPhone} placeholder="+34 6xx xxx xxx" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Email" value={buyerEmail} onChange={setBuyerEmail} placeholder="cliente@email.com" />
              <div style={{ display: "grid", gap: 6 }}>
                <div style={labelTitleStyle}>País</div>
                <Select<CountryOption, false>
                  instanceId="pass-pro-country"
                  inputId="pass-pro-country"
                  options={countryOptions}
                  value={selectedCountryOpt}
                  onChange={(opt) => setCustomerCountry((opt?.value ?? "").toUpperCase())}
                  placeholder="Escribe para buscar..."
                />
              </div>
            </div>

            <Field label="Dirección" value={customerAddress} onChange={setCustomerAddress} placeholder="Calle, número, ciudad..." />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <Field label="Tipo de documento" value={customerDocType} onChange={setCustomerDocType} placeholder="DNI / NIE / PASSPORT" />
              <Field label="Número de documento" value={customerDocNumber} onChange={setCustomerDocNumber} placeholder="12345678A" />
            </div>

            <button type="button" onClick={savePro} disabled={saving} style={{ ...primaryButtonStyle, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </section>
      ) : null}

      {voucher ? (
        <section style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Consumir minutos</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Genera la reserva y abre la formalización manteniendo el bono vinculado. El canje sólo se habilita si el bono está completamente pagado.</div>
          </div>

          {voucher.pendingCents > 0 ? (
            <div style={{ padding: 12, borderRadius: 14, border: "1px solid #fcd34d", background: "#fffbeb", display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 800, color: "#92400e" }}>
                Pendiente de cobro: {euros(voucher.pendingCents)}. Hay que liquidarlo antes de consumir el bono completo.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div style={labelTitleStyle}>Método</div>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PassMethod)} style={inputStyle}>
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="BIZUM">Bizum</option>
                    <option value="TRANSFER">Transferencia</option>
                  </select>
                </label>
                <Field label="Importe a cobrar" value={paymentAmount} onChange={setPaymentAmount} placeholder="0,00" />
              </div>
              <button
                type="button"
                onClick={payPending}
                disabled={payingPending}
                style={{ ...primaryButtonStyle, opacity: payingPending ? 0.7 : 1 }}
              >
                {payingPending ? "Cobrando..." : "Cobrar pendiente"}
              </button>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Field label="Fecha" value={consumeDate} onChange={setConsumeDate} placeholder="YYYY-MM-DD" />
            <Field label="Hora" value={consumeTime} onChange={setConsumeTime} placeholder="HH:mm" />
            <label style={{ display: "grid", gap: 6 }}>
              <div style={labelTitleStyle}>Minutos</div>
              <select value={minutesToUse} onChange={(e) => setMinutesToUse(parseMinutesOption(e.target.value))} style={inputStyle}>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={120}>120 min</option>
                <option value={180}>180 min</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={consumeAndFormalize}
            disabled={!canConsume || consuming}
            style={{ ...primaryButtonStyle, background: canConsume ? "#0f172a" : "#cbd5e1", borderColor: canConsume ? "#0f172a" : "#cbd5e1", color: canConsume ? "#fff" : "#334155", opacity: consuming ? 0.7 : 1 }}
            title={!canConsume ? "No se puede consumir: queda pendiente de pago, faltan minutos o el bono está caducado/anulado." : ""}
          >
            {consuming ? "Consumiendo..." : `Consumir ${minutesToUse} min y formalizar`}
          </button>
        </section>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Pendientes</div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 800 }}>{pendingTop.length}</div>
          </div>

          {pendingTop.length === 0 ? (
            <div style={{ color: "#64748b" }}>No hay bonos pendientes.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pendingTop.map((v) => (
                <SummaryCard
                  key={v.id}
                  row={v}
                  onSelect={loadVoucherCode}
                  subtitle={<span>Restante: <b>{v.minutesRemaining}</b> / {v.minutesTotal} min | Pendiente pago: <b>{euros(v.pendingCents)}</b> | Caduca: {v.expiresAt ? new Date(v.expiresAt).toLocaleDateString("es-ES") : "-"}</span>}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Vendidos hoy</div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 800 }}>{soldToday.length}</div>
          </div>

          {soldToday.length === 0 ? (
            <div style={{ color: "#64748b" }}>No hay ventas hoy.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {soldToday.map((v) => (
                <SummaryCard
                  key={v.id}
                  row={v}
                  onSelect={loadVoucherCode}
                  subtitle={<span>Vendido: <b>{new Date(v.soldAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</b> | Cobrado: <b>{euros(v.paidCents)}</b> | Pendiente: <b>{euros(v.pendingCents)}</b></span>}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
