// src/app/admin/cash-closures/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import CashClosureDetailSection from "@/app/admin/cash-closures/_components/CashClosureDetailSection";
import CashClosuresListSection from "@/app/admin/cash-closures/_components/CashClosuresListSection";

type Row = {
  id: string;
  origin: "STORE" | "BOOTH" | "BAR";
  shift: string;
  businessDate: string;
  windowFrom: string;
  windowTo: string;
  closedAt: string;
  isVoided: boolean;
  note?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  closedByUser?: { fullName?: string | null; username?: string | null } | null;
  voidedByUser?: { fullName?: string | null; username?: string | null } | null;
  users?: Array<{
    user?: { id?: string; fullName?: string | null; username?: string | null } | null;
    roleNameAtClose?: string | null;
  }>;
  declaredJson?: {
    service?: Record<string, number>;
    deposit?: Record<string, number>;
    total?: Record<string, number>;
  };
  computedJson?: {
    meta?: {
      cashFundCents?: number;
      cashToKeepCents?: number;
      cashToWithdrawCents?: number;
    };
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
  totalCommissionCents?: number;
  companyCommissionCents?: number;
  channelCommissionCostCents?: number;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  reviewedByUser?: { fullName?: string | null; username?: string | null } | null;
  depositSummary?: {
    returnedCents: number;
    retainedNetCents: number;
    retainedCount: number;
    partialRetentions: number;
  };
};

type CommissionsSummary = {
  ok: boolean;
  totalCommissionCents?: number;
  totalCompanyCommissionCents?: number;
  totalChannelCommissionCostCents?: number;
  rows?: Array<{
    channelId: string;
    name: string;
    kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
    reservations: number;
    baseServiceCents: number;
    baseDepositCents: number;
    baseTotalCents: number;
    commissionCents: number;
    effectivePct?: number;
  }>;
};

type VoidableClosure = Pick<Row, "id" | "origin" | "shift" | "businessDate" | "closedAt" | "reviewedAt">;

function yyyyMmDd(iso: string) {
  return String(iso).slice(0, 10);
}

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function netFrom(obj?: Record<string, number>) {
  return Number(obj?.CASH ?? 0) + Number(obj?.CARD ?? 0) + Number(obj?.BIZUM ?? 0) + Number(obj?.TRANSFER ?? 0) + Number(obj?.VOUCHER ?? 0);
}

function addMethodMaps(a?: Record<string, number>, b?: Record<string, number>) {
  return {
    CASH: Number(a?.CASH ?? 0) + Number(b?.CASH ?? 0),
    CARD: Number(a?.CARD ?? 0) + Number(b?.CARD ?? 0),
    BIZUM: Number(a?.BIZUM ?? 0) + Number(b?.BIZUM ?? 0),
    TRANSFER: Number(a?.TRANSFER ?? 0) + Number(b?.TRANSFER ?? 0),
    VOUCHER: Number(a?.VOUCHER ?? 0) + Number(b?.VOUCHER ?? 0),
  };
}

function closureScopeLabel(row: Pick<Row, "origin" | "shift">) {
  return row.origin === "BOOTH" ? row.shift : "DIARIO";
}

export default function AdminCashClosuresPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [comm, setComm] = useState<CommissionsSummary | null>(null);
  const [commLoading, setCommLoading] = useState(false);

  const [origin, setOrigin] = useState<string>(() => searchParams.get("origin") ?? ""); // "", STORE, BOOTH, BAR
  const [date, setDate] = useState<string>(() => searchParams.get("date") ?? ""); // YYYY-MM-DD
  const [includeVoided, setIncludeVoided] = useState(() => searchParams.get("includeVoided") === "1");

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

  useEffect(() => {
    setOrigin(searchParams.get("origin") ?? "");
    setDate(searchParams.get("date") ?? "");
    setIncludeVoided(searchParams.get("includeVoided") === "1");
  }, [searchParams]);

  const selected = useMemo(() => rows.find((x) => x.id === selectedId) ?? null, [rows, selectedId]);
  const stats = useMemo(() => {
    return {
      total: rows.length,
      reviewed: rows.filter((row) => Boolean(row.reviewedAt)).length,
      voided: rows.filter((row) => row.isVoided).length,
    };
  }, [rows]);
  const summaryDate = useMemo(() => {
    if (date) return date;
    if (selected?.businessDate) return yyyyMmDd(selected.businessDate);
    if (rows[0]?.businessDate) return yyyyMmDd(rows[0].businessDate);
    return "";
  }, [date, rows, selected?.businessDate]);
  const dailySummary = useMemo(() => {
    if (!summaryDate) return [];

    const activeRows = rows.filter((row) => !row.isVoided && yyyyMmDd(row.businessDate) === summaryDate);
    const grouped = new Map<Row["origin"], {
      origin: Row["origin"];
      closures: number;
      declared: Record<string, number>;
      system: Record<string, number>;
      diff: Record<string, number>;
      companyCommissionCents: number;
      channelCommissionCostCents: number;
      netAfterChannelCommissionCents: number;
    }>();

    for (const row of activeRows) {
      const current = grouped.get(row.origin) ?? {
        origin: row.origin,
        closures: 0,
        declared: { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 },
        system: { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 },
        diff: { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 },
        companyCommissionCents: 0,
        channelCommissionCostCents: 0,
        netAfterChannelCommissionCents: 0,
      };
      current.closures += 1;
      current.declared = addMethodMaps(current.declared, row.declaredJson?.total);
      current.system = addMethodMaps(current.system, row.systemJson?.total);
      current.diff = addMethodMaps(current.diff, row.diffJson?.total);
      current.companyCommissionCents += Number(row.companyCommissionCents ?? 0);
      current.channelCommissionCostCents += Number(row.channelCommissionCostCents ?? 0);
      current.netAfterChannelCommissionCents += netFrom(row.systemJson?.total) - Number(row.channelCommissionCostCents ?? 0);
      grouped.set(row.origin, current);
    }

    return Array.from(grouped.values()).sort((a, b) => a.origin.localeCompare(b.origin));
  }, [rows, summaryDate]);
  const dailyGrandTotal = useMemo(
    () =>
      dailySummary.reduce(
        (acc, row) => ({
          closures: acc.closures + row.closures,
          declared: acc.declared + netFrom(row.declared),
          system: acc.system + netFrom(row.system),
          diff: acc.diff + netFrom(row.diff),
          companyCommissionCents: acc.companyCommissionCents + row.companyCommissionCents,
          channelCommissionCostCents: acc.channelCommissionCostCents + row.channelCommissionCostCents,
          netAfterChannelCommissionCents: acc.netAfterChannelCommissionCents + row.netAfterChannelCommissionCents,
        }),
        { closures: 0, declared: 0, system: 0, diff: 0, companyCommissionCents: 0, channelCommissionCostCents: 0, netAfterChannelCommissionCents: 0 }
      ),
    [dailySummary]
  );

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

  async function voidClosure(row: VoidableClosure) {
    const scope = `${row.origin} · ${closureScopeLabel(row)} · ${yyyyMmDd(row.businessDate)}`;
    const firstConfirm = confirm(
      `Vas a reabrir el cierre ${scope}.\n\n` +
      "Esto anulará este cierre como activo, desbloqueará la operativa y exigirá volver a cerrar caja después de corregir la incidencia.\n\n" +
      "Pulsa Aceptar solo si necesitas registrar una corrección real."
    );
    if (!firstConfirm) return;

    if (row.reviewedAt) {
      const reviewedConfirm = confirm(
        "Este cierre ya estaba revisado por admin.\n\n" +
        "Reabrirlo eliminará ese estado de revisión y tendrás que revisar de nuevo el nuevo cierre.\n\n" +
        "¿Quieres continuar?"
      );
      if (!reviewedConfirm) return;
    }

    const reason = prompt(
      "Motivo de reapertura (obligatorio, mínimo 10 caracteres):\n" +
      "Ej: cobro de última hora, devolución posterior, error de conteo en efectivo..."
    );
    if (reason === null) return;

    const cleanReason = reason.trim();
    if (cleanReason.length < 10) {
      alert("Escribe un motivo más concreto. Mínimo 10 caracteres.");
      return;
    }

    try {
      const r = await fetch(`/api/admin/cash-closures/${row.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cleanReason }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
      alert(
        "Cierre reabierto. Haz la corrección operativa necesaria y vuelve a cerrar caja para dejar un nuevo cierre activo."
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Error reabriendo cierre");
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
            Revisión operativa de cierres, diferencias declaradas frente al sistema y comisiones estimadas por canal.
          </p>
        </div>
        <div style={opsStyles.actionGrid}>
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

      <section style={infoStrip}>
        <div style={infoBlock}>
          <div style={infoTitle}>Lectura rápida</div>
          <div style={infoText}>`STORE` y `BAR` se revisan como cierre diario. `BOOTH` mantiene cierre por turno real.</div>
        </div>
        <div style={infoBlock}>
          <div style={infoTitle}>Qué revisar primero</div>
          <div style={infoText}>Empieza por la diferencia neta y luego baja al detalle por método, sobre todo `CASH`.</div>
        </div>
      </section>

      {summaryDate && dailySummary.length > 0 ? (
        <section style={panelStyle}>
          <div style={{ padding: "10px 12px", background: "#f9fafb", fontWeight: 900, fontSize: 13 }}>
            Resumen del día · {summaryDate}
          </div>
          <div style={{ padding: 12, display: "grid", gap: 12 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={tableHeadLeft}>Origen</th>
                    <th style={tableHeadRight}>Cierres</th>
                    <th style={tableHeadRight}>Declarado neto</th>
                    <th style={tableHeadRight}>Sistema neto</th>
                    <th style={tableHeadRight}>Comisión empresa</th>
                    <th style={tableHeadRight}>Coste canal</th>
                    <th style={tableHeadRight}>Neto tras canal</th>
                    <th style={tableHeadRight}>Diferencia neta</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((row) => (
                    <tr key={row.origin}>
                      <td style={tableCellLeft}>{row.origin}</td>
                      <td style={tableCellRight}>{row.closures}</td>
                      <td style={tableCellRight}>{euros(netFrom(row.declared))}</td>
                      <td style={tableCellRight}>{euros(netFrom(row.system))}</td>
                      <td style={tableCellRight}>{euros(row.companyCommissionCents)}</td>
                      <td style={tableCellRight}>{euros(row.channelCommissionCostCents)}</td>
                      <td style={{ ...tableCellRight, fontWeight: 800 }}>{euros(row.netAfterChannelCommissionCents)}</td>
                      <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(netFrom(row.diff))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tableCellLeft, fontWeight: 900 }}>TOTAL DÍA</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{dailyGrandTotal.closures}</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(dailyGrandTotal.declared)}</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(dailyGrandTotal.system)}</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(dailyGrandTotal.companyCommissionCents)}</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(dailyGrandTotal.channelCommissionCostCents)}</td>
                    <td style={{ ...tableCellRight, fontWeight: 900 }}>{euros(dailyGrandTotal.netAfterChannelCommissionCents)}</td>
                    <td style={{ ...tableCellRight, fontWeight: 950 }}>{euros(dailyGrandTotal.diff)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              El resumen agrega cierres activos del día por origen. En `BOOTH` suma mañana y tarde; en `STORE` y `BAR` normalmente verás un único cierre diario por punto.
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div style={errorStyle}>
          {error}
        </div>
      ) : null}

      <section style={filtersPanel}>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle}>
          <option value="">Todos los orígenes</option>
          <option value="STORE">STORE · Diario</option>
          <option value="BOOTH">BOOTH · Turno</option>
          <option value="BAR">BAR · Diario</option>
        </select>

        <label style={{ fontSize: 13 }}>
          Fecha (opcional)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#334155" }}>
          <input type="checkbox" checked={includeVoided} onChange={(e) => setIncludeVoided(e.target.checked)} />
          Incluir anulados
        </label>

        <button onClick={load} style={{ ...lightBtn, justifySelf: "end" }}>
          Aplicar filtros
        </button>
      </section>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 12 }}>
        <CashClosuresListSection
          panelStyle={panelStyle}
          lightBtn={lightBtn}
          loading={loading}
          rows={rows}
          selectedId={selectedId}
          yyyyMmDd={yyyyMmDd}
          onSelect={setSelectedId}
          onToggleReviewed={(row) => {
            if (row.reviewedAt) {
              setReviewed(row.id, false).catch(() => {});
            } else {
              const note = prompt("Nota de revisión (opcional):") ?? "";
              setReviewed(row.id, true, note.trim() ? note.trim() : null).catch(() => {});
            }
          }}
        />

        <CashClosureDetailSection
          panelStyle={panelStyle}
          detailStatStyle={detailStatStyle}
          detailStatLabel={detailStatLabel}
          detailStatValue={detailStatValue}
          lightBtn={lightBtn}
          selected={selected}
          comm={comm}
          commLoading={commLoading}
          yyyyMmDd={yyyyMmDd}
          euros={euros}
          netFrom={netFrom}
          onVoid={voidClosure}
        />
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1200px, 100%)",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(20, 184, 166, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%)",
};

const heroStyle: React.CSSProperties = {
  ...opsStyles.heroCard,
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
  ...opsStyles.heroTitle,
  lineHeight: 1,
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
  ...opsStyles.metricCard,
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

const infoStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 10,
};

const infoBlock: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  padding: 14,
  display: "grid",
  gap: 4,
};

const infoTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#0f766e",
};

const infoText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: "#475569",
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #dbe4ea",
  color: "#0f172a",
};

const darkBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  border: "1px solid #0f172a",
  background: "#0f172a",
  cursor: "pointer",
};

const filtersPanel: React.CSSProperties = {
  ...opsStyles.sectionCard,
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
  ...opsStyles.sectionCard,
  border: "1px solid #dbe4ea",
  borderRadius: 18,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
  overflow: "hidden",
};

const detailStatStyle: React.CSSProperties = {
  ...opsStyles.metricCard,
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

const tableHeadLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 8,
  borderBottom: "1px solid #eee",
};

const tableHeadRight: React.CSSProperties = {
  textAlign: "right",
  padding: 8,
  borderBottom: "1px solid #eee",
};

const tableCellLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 8,
  borderBottom: "1px solid #f3f4f6",
};

const tableCellRight: React.CSSProperties = {
  textAlign: "right",
  padding: 8,
  borderBottom: "1px solid #f3f4f6",
};
