"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState, type CSSProperties } from "react";

type GiftProductRow = {
  id: string;
  name: string;
  isActive: boolean;
  priceCents: number;
  validDays: number | null;
  service: { id: string; name: string; category: string };
  option: { id: string; name?: string | null; durationMinutes?: number | null; pax?: number | null };
  createdAt: string;
};

type GiftVoucherRow = {
  id: string;
  code: string;
  origin: "STORE" | "BOOTH" | "BAR";
  soldAt: string;
  expiresAt: string | null;
  isVoided: boolean;
  voidReason: string | null;
  product: { id: string; name: string; priceCents: number };
  soldByUser?: { username?: string | null; fullName?: string | null } | null;
  redeemedAt?: string | null;
};

type ServiceLite = {
  id: string;
  name: string;
  category: string;
  options: Array<{ id: string; name?: string | null; durationMinutes?: number | null; pax?: number | null }>;
};

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

function optLabel(o: { id: string; name?: string | null; durationMinutes?: number | null; pax?: number | null }) {
  const parts: string[] = [];
  if (o?.name) parts.push(o.name);
  if (o?.durationMinutes) parts.push(`${o.durationMinutes} min`);
  if (o?.pax) parts.push(`${o.pax} pax`);
  return parts.join(" · ") || o.id;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const lightBtn: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 900,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
};

const darkBtn: React.CSSProperties = {
  padding: "10px 12px",
  fontWeight: 900,
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

export default function AdminGiftsPage() {
  const [tab, setTab] = useState<"PRODUCTS" | "VOUCHERS">("PRODUCTS");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [products, setProducts] = useState<GiftProductRow[]>([]);
  const [vouchers, setVouchers] = useState<GiftVoucherRow[]>([]);
  const [pServiceId, setPServiceId] = useState<string>("");
  const [pOptionId, setPOptionId] = useState<string>("");
  const [pName, setPName] = useState<string>("");
  const [pPriceEuros, setPPriceEuros] = useState<string>("0");
  const [pValidDays, setPValidDays] = useState<string>("");
  const [pActive, setPActive] = useState(true);
  const [qCode, setQCode] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eName, setEName] = useState<string>("");
  const [ePriceEuros, setEPriceEuros] = useState<string>("0");
  const [eValidDays, setEValidDays] = useState<string>("");

  const selectedService = useMemo(() => services.find((s) => s.id === pServiceId) ?? null, [services, pServiceId]);
  const serviceOptions = useMemo(() => selectedService?.options ?? [], [selectedService]);

  const vouchersFiltered = useMemo(() => {
    const q = qCode.trim().toUpperCase();
    return vouchers.filter((v) => {
      if (!includeVoided && v.isVoided) return false;
      if (onlyPending && (v.isVoided || v.redeemedAt)) return false;
      if (q && !String(v.code ?? "").toUpperCase().includes(q)) return false;
      return true;
    });
  }, [vouchers, qCode, onlyPending, includeVoided]);

  async function loadAll() {
    setLoading(true);
    setErr(null);
    try {
      const [s, p, v] = await Promise.all([
        fetch("/api/admin/gifts/catalog", { cache: "no-store" }),
        fetch("/api/admin/gifts/products", { cache: "no-store" }),
        fetch("/api/admin/gifts/vouchers", { cache: "no-store" }),
      ]);

      if (!s.ok) throw new Error(await s.text());
      if (!p.ok) throw new Error(await p.text());
      if (!v.ok) throw new Error(await v.text());

      const sj = await s.json();
      const pj = await p.json();
      const vj = await v.json();

      setServices(sj.services ?? []);
      setProducts(pj.rows ?? []);
      setVouchers(vj.rows ?? []);

      if (!pServiceId && sj.services?.[0]?.id) setPServiceId(sj.services[0].id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // El catalogo se carga una vez al entrar en la pagina.
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (serviceOptions.length && !serviceOptions.some((o) => o.id === pOptionId)) {
      setPOptionId(serviceOptions[0].id);
    }
  }, [pOptionId, pServiceId, serviceOptions]);

  async function createProduct() {
    setErr(null);
    try {
      const priceCents = Math.round(Number(String(pPriceEuros).replace(",", ".")) * 100);
      const validDays = pValidDays.trim() ? Number(pValidDays) : null;

      const r = await fetch("/api/admin/gifts/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: pServiceId,
          optionId: pOptionId,
          name: pName.trim() || null,
          priceCents,
          validDays,
          isActive: pActive,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadAll();
      setPName("");
      setPPriceEuros("0");
      setPValidDays("");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error creando producto");
    }
  }

  function startEdit(p: GiftProductRow) {
    setEditingId(p.id);
    setEName(p.name ?? "");
    setEPriceEuros((p.priceCents / 100).toFixed(2));
    setEValidDays(p.validDays ? String(p.validDays) : "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setErr(null);
    try {
      const priceCents = Math.round(Number(ePriceEuros.replace(",", ".")) * 100);
      const validDays = eValidDays.trim() ? Number(eValidDays) : null;

      const r = await fetch(`/api/admin/gifts/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eName.trim() ? eName.trim() : null,
          priceCents,
          validDays,
        }),
      });

      if (!r.ok) throw new Error(await r.text());
      setEditingId(null);
      await loadAll();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error guardando cambios");
    }
  }

  async function toggleProduct(id: string, isActive: boolean) {
    setErr(null);
    try {
      const r = await fetch(`/api/admin/gifts/products/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadAll();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error actualizando producto");
    }
  }

  async function voidVoucher(id: string) {
    const reason = prompt("Motivo de anulacion (obligatorio):") ?? "";
    if (reason.trim().length < 3) return;

    setErr(null);
    try {
      const r = await fetch(`/api/admin/gifts/vouchers/${id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      await loadAll();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error anulando vale");
    }
  }

  const activeCount = products.filter((p) => p.isActive).length;
  const voidedCount = vouchers.filter((v) => v.isVoided).length;
  const pendingCount = vouchers.filter((v) => !v.isVoided && !v.redeemedAt).length;

  return (
    <div style={pageStyle}>
      <section style={modernHeroStyle}>
        <div>
          <div style={eyebrowStyle}>Comercial</div>
          <div style={titleStyle}>Regalos</div>
          <div style={subtitleStyle}>
            Productos activos: <b>{activeCount}</b> · Pendientes: <b>{pendingCount}</b> · Vales anulados: <b>{voidedCount}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button onClick={loadAll} style={darkBtn}>Refrescar</button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Productos activos</div>
          <div style={summaryValue}>{activeCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Pendientes</div>
          <div style={summaryValue}>{pendingCount}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Anulados</div>
          <div style={summaryValue}>{voidedCount}</div>
        </article>
      </section>

      <section style={{ display: "none" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950 }}>Admin · Regalos</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Productos activos: <b>{activeCount}</b> · Pendientes: <b>{pendingCount}</b> · Vales anulados: <b>{voidedCount}</b>
          </div>
        </div>

        <button onClick={loadAll} style={lightBtn}>Refrescar</button>
      </section>

      {err ? <div style={errorStyle}>{err}</div> : null}

      <div style={tabsWrap}>
        <button
          onClick={() => setTab("PRODUCTS")}
          style={{
            ...lightBtn,
            background: tab === "PRODUCTS" ? "#111" : "#fff",
            color: tab === "PRODUCTS" ? "#fff" : "#111",
            border: "1px solid #e5e7eb",
          }}
        >
          Productos regalo
        </button>

        <button
          onClick={() => setTab("VOUCHERS")}
          style={{
            ...lightBtn,
            background: tab === "VOUCHERS" ? "#111" : "#fff",
            color: tab === "VOUCHERS" ? "#fff" : "#111",
            border: "1px solid #e5e7eb",
          }}
        >
          Vales vendidos
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: 12, opacity: 0.7 }}>Cargando...</div>
      ) : tab === "PRODUCTS" ? (
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
          <div style={panelStyle}>
            <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Crear producto regalo</div>

            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13 }}>
                Actividad
                <select value={pServiceId} onChange={(e) => setPServiceId(e.target.value)} style={inputStyle}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.category} · {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 13 }}>
                Opcion
                <select value={pOptionId} onChange={(e) => setPOptionId(e.target.value)} style={inputStyle}>
                  {serviceOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {optLabel(o)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 13 }}>
                Nombre visible (opcional)
                <input value={pName} onChange={(e) => setPName(e.target.value)} style={inputStyle} placeholder="Ej: Regalo Moto 20 min" />
              </label>

              <label style={{ fontSize: 13 }}>
                PVP (EUR)
                <input value={pPriceEuros} onChange={(e) => setPPriceEuros(e.target.value)} style={inputStyle} placeholder="75" />
              </label>

              <label style={{ fontSize: 13 }}>
                Validez en dias (opcional)
                <input value={pValidDays} onChange={(e) => setPValidDays(e.target.value)} style={inputStyle} placeholder="365" />
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={pActive} onChange={(e) => setPActive(e.target.checked)} />
                Activo
              </label>

              <button onClick={createProduct} style={darkBtn}>Crear producto</button>

              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Consejo: usa el nombre opcional solo si quieres un nombre comercial distinto; si no, se genera desde actividad y opcion.
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Productos</div>

            {products.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>No hay productos.</div>
            ) : (
              <div style={{ display: "grid" }}>
                {products.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: 12,
                      borderTop: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    {editingId === p.id ? (
                      <>
                        <div style={{ flex: 1, display: "grid", gap: 8 }}>
                          <input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Nombre visible" style={{ ...inputStyle, padding: 8 }} />

                          <div style={{ display: "flex", gap: 8 }}>
                            <input value={ePriceEuros} onChange={(e) => setEPriceEuros(e.target.value)} placeholder="PVP EUR" style={{ ...inputStyle, padding: 8, width: 120 }} />
                            <input value={eValidDays} onChange={(e) => setEValidDays(e.target.value)} placeholder="Validez dias" style={{ ...inputStyle, padding: 8, width: 140 }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => void saveEdit(p.id)} style={lightBtn}>Guardar</button>
                          <button onClick={cancelEdit} style={lightBtn}>Cancelar</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {p.name}
                            {!p.isActive ? <span style={{ fontSize: 12, opacity: 0.7 }}> · INACTIVO</span> : null}
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                            {p.service.category} · {p.service.name} · {optLabel(p.option)}
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                            PVP: <b>{euros(p.priceCents)}</b>
                            {p.validDays ? <> · Validez: <b>{p.validDays} dias</b></> : null}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => startEdit(p)} style={lightBtn}>Editar</button>
                          <button onClick={() => void toggleProduct(p.id, !p.isActive)} style={lightBtn}>
                            {p.isActive ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={panelPaddedStyle}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Vales vendidos</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input value={qCode} onChange={(e) => setQCode(e.target.value)} placeholder="Buscar codigo (RG-...)" style={{ ...inputStyle, minWidth: 240, width: "auto" }} />

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
                Solo pendientes (no canjeados)
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />
                Incluir anulados
              </label>

              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
                Mostrando: <b>{vouchersFiltered.length}</b>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>Vales</div>

            {vouchersFiltered.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.7 }}>No hay vales con esos filtros.</div>
            ) : (
              <div style={{ display: "grid" }}>
                {vouchersFiltered.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: 12,
                      borderTop: "1px solid #eee",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {v.code} {v.isVoided ? <span style={{ fontSize: 12, opacity: 0.7 }}>· ANULADO</span> : null}
                        {v.redeemedAt ? <span style={{ fontSize: 12, opacity: 0.7 }}> · CANJEADO</span> : null}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                        {v.product.name} · {euros(v.product.priceCents)} · {v.origin} · {new Date(v.soldAt).toLocaleString()}
                      </div>

                      {v.expiresAt ? (
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Caduca: {new Date(v.expiresAt).toLocaleDateString()}</div>
                      ) : null}

                      {v.isVoided && v.voidReason ? (
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>Motivo: {v.voidReason}</div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!v.isVoided && !v.redeemedAt ? (
                        <button onClick={() => void voidVoucher(v.id)} style={lightBtn}>Anular</button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(34, 197, 94, 0.08), transparent 30%)",
};

const modernHeroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #f0fdf4 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#15803d",
};

const titleStyle: CSSProperties = {
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
  maxWidth: 760,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const ghostBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const tabsWrap: CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const panelPaddedStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  padding: 12,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  padding: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  borderRadius: 12,
  color: "#991b1b",
  fontWeight: 900,
};


