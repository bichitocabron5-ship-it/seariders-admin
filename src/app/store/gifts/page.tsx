// src/app/store/gifts/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GiftProduct = { id: string; name: string; priceCents: number; isActive: boolean };
type PendingRow = {
  id: string;
  code: string;
  soldAt: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  product: { id: string; name: string };
};
type RedeemedRow = {
  id: string;
  code: string;
  redeemedAt: string;
  buyerName?: string | null;
  buyerPhone?: string | null;
  product: { id: string; name: string };
  redeemedReservationId?: string | null;
};

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

function todayMadridYMD() {
  const tz = "Europe/Madrid";
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

const shellStyle: React.CSSProperties = {
  padding: 24,
  maxWidth: 1200,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const panelStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid #dbe4ea",
  borderRadius: 20,
  background: "#ffffff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const labelStyle: React.CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff" };
const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 800,
};
const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
  fontWeight: 700,
};

export default function StoreGiftsPage() {
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [redeemedToday, setRedeemedToday] = useState<RedeemedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [productId, setProductId] = useState<string>("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [method, setMethod] = useState<"CASH" | "CARD" | "BIZUM" | "TRANSFER">("CARD");
  const [selling, setSelling] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const router = useRouter();

  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const p = await fetch("/api/store/gifts/products", { cache: "no-store" });
      if (!p.ok) throw new Error(await p.text());
      const pj = await p.json();
      const list: GiftProduct[] = pj.products ?? [];
      setProducts(list);
      setProductId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        return list.find((item) => item.isActive)?.id ?? list[0]?.id ?? "";
      });

      const t = await fetch("/api/store/gifts/today", { cache: "no-store" });
      if (!t.ok) throw new Error(await t.text());
      const tj = await t.json();
      setPending(tj.pending ?? []);
      setRedeemedToday(tj.redeemedToday ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando regalos");
    } finally {
      setLoading(false);
    }
  }

  async function sell() {
    if (!productId) return;
    setSelling(true);
    setErr(null);
    try {
      const r = await fetch("/api/store/gifts/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          method,
          buyerName: buyerName.trim() || null,
          buyerPhone: buyerPhone.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setLastCode(j.code ?? null);
      setBuyerName("");
      setBuyerPhone("");
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error vendiendo regalo");
    } finally {
      setSelling(false);
    }
  }

  async function redeem() {
    const c = code.trim().toUpperCase();
    if (!c) return;

    setRedeeming(true);
    setErr(null);

    try {
      const r = await fetch("/api/store/gifts/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });

      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();

      setCode("");
      await load();

      const today = todayMadridYMD();
      router.push(`/store/create?migrateFrom=${j.reservationId}&date=${today}&mode=today&giftCode=${encodeURIComponent(c)}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error canjeando código");
    } finally {
      setRedeeming(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={shellStyle}>
      <section
        style={{
          ...panelStyle,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
          background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#0f766e" }}>Store</div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>Regalos</h1>
          <div style={{ color: "#475569", maxWidth: 640 }}>
            Venta y canje de regalos con acceso directo a la formalización en tienda.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading} style={secondaryButtonStyle}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
          <a href="/store" style={{ ...secondaryButtonStyle, textDecoration: "none", color: "#111827", display: "inline-flex", alignItems: "center" }}>
            Volver a tienda
          </a>
        </div>
      </section>

      {err ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#fff1f2", border: "1px solid #fecdd3", color: "#9f1239", fontWeight: 700 }}>
          {err}
        </div>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={{ ...panelStyle, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Vender regalo</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Selecciona producto, comprador opcional y método de pago.</div>
            </div>
            {selectedProduct ? (
              <div style={{ padding: "8px 12px", borderRadius: 999, background: "#ecfeff", color: "#155e75", fontWeight: 800 }}>
                {euros(selectedProduct.priceCents)}
              </div>
            ) : null}
          </div>

          <label style={labelStyle}>
            <span>Producto</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} style={inputStyle}>
              {products.filter((p) => p.isActive).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} | {euros(p.priceCents)}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={labelStyle}>
              <span>Nombre</span>
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} style={inputStyle} placeholder="Opcional" />
            </label>
            <label style={labelStyle}>
              <span>Teléfono</span>
              <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} style={inputStyle} placeholder="Opcional" />
            </label>
          </div>

          <label style={labelStyle}>
            <span>Método de pago</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as "CASH" | "CARD" | "BIZUM" | "TRANSFER")} style={inputStyle}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BIZUM">Bizum</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </label>

          <button onClick={sell} disabled={selling || !selectedProduct} style={primaryButtonStyle}>
            {selling ? "Vendiendo..." : `Vender regalo${selectedProduct ? ` (${euros(selectedProduct.priceCents)})` : ""}`}
          </button>

          {lastCode ? (
            <div style={{ padding: 14, borderRadius: 16, background: "#ecfccb", border: "1px solid #a3e635", display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#3f6212", textTransform: "uppercase", letterSpacing: 1 }}>Código generado</div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1.4 }}>{lastCode}</div>
            </div>
          ) : null}
        </div>

        <div style={{ ...panelStyle, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Canjear código</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>Al canjear se crea una reserva para hoy y se abre la formalización.</div>
          </div>

          <label style={labelStyle}>
            <span>Código</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="RG-1234-567"
              style={inputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  redeem();
                }
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={redeem} disabled={redeeming} style={primaryButtonStyle}>
              {redeeming ? "Canjeando..." : "Canjear regalo"}
            </button>
            <button onClick={load} disabled={loading} style={secondaryButtonStyle}>
              {loading ? "Actualizando..." : "Actualizar listados"}
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Pendientes de canjear</div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 800 }}>{pending.length}</div>
          </div>

          {pending.length === 0 ? (
            <div style={{ color: "#64748b" }}>No hay regalos pendientes.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {pending.map((r) => (
                <article key={r.id} style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 16, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{r.product?.name}</strong>
                    <span style={{ fontWeight: 900 }}>{r.code}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {r.buyerName ? `Nombre: ${r.buyerName}` : "Sin nombre"} | {r.buyerPhone ? `Tel: ${r.buyerPhone}` : "Sin teléfono"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Vendido: {new Date(r.soldAt).toLocaleString("es-ES")}</div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...panelStyle, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Canjeados hoy</div>
            <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 800 }}>{redeemedToday.length}</div>
          </div>

          {redeemedToday.length === 0 ? (
            <div style={{ color: "#64748b" }}>No hay canjes hoy.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {redeemedToday.map((r) => (
                <article key={r.id} style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 16, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{r.product?.name}</strong>
                    <span style={{ fontWeight: 900 }}>{r.code}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    Canjeado a las <strong>{new Date(r.redeemedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</strong>
                    {r.redeemedReservationId ? ` | Reserva: ${r.redeemedReservationId}` : ""}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
