// src/app/admin/cash-closures/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  origin: "STORE" | "BOOTH" | "BAR";
  shift: string;
  businessDate: string;
  windowFrom: string;
  windowTo: string;
  closedAt: string;
  isVoided: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
  closedByUser?: { fullName?: string | null; username?: string | null } | null;
  voidedByUser?: { fullName?: string | null; username?: string | null } | null;
  declaredJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  systemJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  diffJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  reviewedAt?: string | null;
  reviewNote?: string | null;
  reviewedByUser?: { fullName?: string | null; username?: string | null } | null;
};

type CommissionsSummary = {
  ok: boolean;
  totalCommissionCents?: number;
  rows?: Array<{
    channelId: string;
    name: string;
    reservations: number;
    baseServiceCents: number;
    baseDepositCents: number;
    baseTotalCents: number;
    commissionCents: number;
  }>;
};

function yyyyMmDd(iso: string) {
  return String(iso).slice(0, 10);
}

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function netFrom(obj?: Record<string, number>) {
  return Number(obj?.CASH ?? 0) + Number(obj?.CARD ?? 0) + Number(obj?.BIZUM ?? 0) + Number(obj?.TRANSFER ?? 0) + Number(obj?.VOUCHER ?? 0);
}

export default function AdminCashClosuresPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comm, setComm] = useState<CommissionsSummary | null>(null);
  const [commLoading, setCommLoading] = useState(false);

  const [origin, setOrigin] = useState<string>(""); // "", STORE, BOOTH, BAR
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [includeVoided, setIncludeVoided] = useState(false);

  const [selectedId, setSelectedId] = useState<string>("");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (origin) qs.set("origin", origin);
      if (date) qs.set("date", date);
      qs.set("includeVoided", includeVoided ? "1" : "0");

      const r = await fetch(`/api/admin/cash-closures/list?${qs.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRows(j.rows ?? []);
      if (!selectedId && (j.rows?.[0]?.id ?? "")) setSelectedId(j.rows[0].id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando cierres");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => rows.find((x) => x.id === selectedId) ?? null, [rows, selectedId]);
  const stats = useMemo(() => {
    return {
      total: rows.length,
      reviewed: rows.filter((row) => Boolean(row.reviewedAt)).length,
      voided: rows.filter((row) => row.isVoided).length,
    };
  }, [rows]);

  useEffect(() => {
    if (!selected?.id) {
      setComm(null);
      return;
    }
    setCommLoading(true);
    fetch(`/api/admin/cash-closures/${selected.id}/commissions`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((j) => setComm(j?.ok ? j : null))
      .catch(() => setComm(null))
      .finally(() => setCommLoading(false));
  }, [selected?.id]);

  async function setReviewed(closureId: string, reviewed: boolean, note?: string | null) {
    const r = await fetch(`/api/admin/cash-closures/${closureId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed, note: note ?? null }),
    });
    if (!r.ok) throw new Error(await r.text());
    await load(); // tu refresco
  }

  async function voidClosure(closureId: string) {
    const reason = prompt("Motivo de reapertura/anulación (obligatorio):");
    if (!reason || reason.trim().length < 3) return;

    try {
      const r = await fetch(`/api/admin/cash-closures/${closureId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error anulando cierre");
    }
  }

  const inputStyle = { padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" };
  const lightBtn = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Operativa</div>
          <h1 style={titleStyle}>Cierres de caja</h1>
          <p style={subtitleStyle}>
            Revision operativa de cierres, diferencias declaradas frente al sistema y comisiones estimadas por canal.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button onClick={load} style={darkBtn}>
            Refrescar
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Cierres</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Revisados</div>
          <div style={summaryValue}>{stats.reviewed}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Anulados</div>
          <div style={summaryValue}>{stats.voided}</div>
        </article>
      </section>

      {error ? (
        <div style={errorStyle}>
          {error}
        </div>
      ) : null}

      <section style={filtersPanel}>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle}>
          <option value="">(Todos los origins)</option>
          <option value="STORE">STORE</option>
          <option value="BOOTH">BOOTH</option>
          <option value="BAR">BAR</option>
        </select>

        <label style={{ fontSize: 13 }}>
          Fecha (opcional)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />
          Incluir anulados
        </label>

        <button onClick={load} style={{ ...lightBtn, justifySelf: "end" }}>
          Aplicar filtros
        </button>
      </section>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>
            Lista
          </div>

          {loading ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Cargando…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Sin cierres.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  borderTop: "1px solid #eee",
                  padding: 14,
                  cursor: "pointer",
                  background: selectedId === r.id ? "linear-gradient(180deg, #f0f9ff 0%, #ecfeff 100%)" : "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 900,
                          background: r.isVoided ? "#fee2e2" : "#ecfeff",
                          color: r.isVoided ? "#991b1b" : "#155e75",
                          border: `1px solid ${r.isVoided ? "#fecaca" : "#bae6fd"}`,
                        }}
                      >
                        {r.origin}
                      </span>
                      {r.origin} · {r.shift} · {yyyyMmDd(r.businessDate)}
                      {r.isVoided ? " · ANULADO" : ""}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      Cerró: {r.closedByUser?.fullName ?? r.closedByUser?.username ?? "—"} · {new Date(r.closedAt).toLocaleString()}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                      {r.reviewedAt
                        ? `✅ Revisado por ${r.reviewedByUser?.username ?? "admin"}`
                        : "⏳ Pendiente de revisión"}
                      {r.reviewNote ? ` · ${r.reviewNote}` : ""}
                    </div>
                  </div>

                  {!r.isVoided ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.reviewedAt) {
                          setReviewed(r.id, false).catch(() => {});
                        } else {
                          const note = prompt("Nota de revisión (opcional):") ?? "";
                          setReviewed(r.id, true, note.trim() ? note.trim() : null).catch(() => {});
                        }
                      }}
                      style={lightBtn}
                    >
                      {r.reviewedAt ? "Quitar revisado" : "Marcar revisado"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={panelStyle}>
          <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>
            Detalle
          </div>

          {!selected ? (
            <div style={{ padding: 12, opacity: 0.7 }}>Selecciona un cierre.</div>
          ) : (
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 900,
                        background: selected.isVoided ? "#fee2e2" : "#ecfeff",
                        color: selected.isVoided ? "#991b1b" : "#155e75",
                        border: `1px solid ${selected.isVoided ? "#fecaca" : "#bae6fd"}`,
                      }}
                    >
                      {selected.origin}
                    </span>
                    {selected.origin} · {selected.shift} · {yyyyMmDd(selected.businessDate)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    Ventana: {new Date(selected.windowFrom).toLocaleTimeString()}–{new Date(selected.windowTo).toLocaleTimeString()}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    Estado: {selected.isVoided ? "ANULADO (reabierto)" : "ACTIVO"}{" "}
                    {selected.isVoided ? `· Motivo: ${selected.voidReason ?? "—"}` : ""}
                  </div>
                </div>

                {!selected.isVoided ? (
                  <button onClick={() => voidClosure(selected.id)} style={lightBtn}>
                    Anular / Reabrir
                  </button>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div style={detailStatStyle}>
                  <div style={detailStatLabel}>Declarado neto</div>
                  <div style={detailStatValue}>{euros(netFrom(selected.declaredJson?.total))}</div>
                </div>
                <div style={detailStatStyle}>
                  <div style={detailStatLabel}>Sistema neto</div>
                  <div style={detailStatValue}>{euros(netFrom(selected.systemJson?.total))}</div>
                </div>
                <div
                  style={{
                    ...detailStatStyle,
                    background:
                      netFrom(selected.diffJson?.total) === 0
                        ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
                        : netFrom(selected.diffJson?.total) > 0
                          ? "linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)"
                          : "linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)",
                  }}
                >
                  <div style={detailStatLabel}>Diferencia neta</div>
                  <div style={detailStatValue}>{euros(netFrom(selected.diffJson?.total))}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 18, padding: 14, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Desglose por método (céntimos)</div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Bloque</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>CASH</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>CARD</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>BIZUM</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>TRANSFER</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>VOUCHER</th>
                        <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>NETO</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[
                        { label: "DECLARADO · Servicio", obj: selected.declaredJson?.service },
                        { label: "DECLARADO · Fianza", obj: selected.declaredJson?.deposit },
                        { label: "DECLARADO · Total", obj: selected.declaredJson?.total },

                        { label: "SISTEMA · Servicio", obj: selected.systemJson?.service },
                        { label: "SISTEMA · Fianza", obj: selected.systemJson?.deposit },
                        { label: "SISTEMA · Total", obj: selected.systemJson?.total },

                        { label: "DIF · Servicio", obj: selected.diffJson?.service },
                        { label: "DIF · Fianza", obj: selected.diffJson?.deposit },
                        { label: "DIF · Total", obj: selected.diffJson?.total },
                      ].map((row, idx) => {
                        const cash = Number(row.obj?.CASH ?? 0);
                        const card = Number(row.obj?.CARD ?? 0);
                        const biz = Number(row.obj?.BIZUM ?? 0);
                        const tr = Number(row.obj?.TRANSFER ?? 0);
                        const v = Number(row.obj?.VOUCHER ?? 0);
                        const net = cash + card + biz + tr + v;

                        return (
                          <tr key={idx}>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>{row.label}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(cash)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(card)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(biz)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(tr)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(v)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900 }}>
                              {euros(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "#fff" }}>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Comisiones por canal</div>

                  {commLoading ? (
                    <div style={{ opacity: 0.7 }}>Cargando…</div>
                  ) : !comm ? (
                    <div style={{ opacity: 0.7 }}>Sin datos de comisiones (o no hay canales con comisión).</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>Total comisiones (estimado)</div>
                        <div style={{ fontWeight: 900 }}>{euros(comm.totalCommissionCents ?? 0)}</div>
                      </div>

                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Canal</th>
                              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Reservas</th>
                              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base servicio</th>
                              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base fianza</th>
                              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Base total</th>
                              <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #eee" }}>Comisión</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(comm.rows ?? []).map((x) => (
                              <tr key={x.channelId}>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", fontWeight: 800 }}>{x.name}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{x.reservations}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(x.baseServiceCents)}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{euros(x.baseDepositCents)}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 800 }}>{euros(x.baseTotalCents)}</td>
                                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 900 }}>{euros(x.commissionCents)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Nota: base calculada con pagos netos del cierre (IN−OUT). Si el canal marca “comisión sobre fianza”, se incluye.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  Nota: “DIF” = Declarado − Sistema. Lo normal es que el mayor descuadre esté en CASH.
                </div>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Si quieres, la siguiente iteración muestra el desglose por método (CASH/CARD/BIZUM/TRANSFER/VOUCHER) y servicio/fianza.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(20, 184, 166, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%)",
};

const heroStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #ecfeff 100%)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#0f766e",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
  fontWeight: 950,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #fff 0%, #f8fafc 100%)",
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 26,
  fontWeight: 950,
  color: "#0f172a",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const darkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const filtersPanel: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  alignItems: "center",
};

const panelStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  overflow: "hidden",
};

const detailStatStyle: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const detailStatLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const detailStatValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 950,
  color: "#0f172a",
};

const errorStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
