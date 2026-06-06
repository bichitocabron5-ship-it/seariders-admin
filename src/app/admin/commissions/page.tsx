"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { opsStyles } from "@/components/ops-ui";

type Status = "PENDING" | "PAID" | "VOIDED";
type Origin = "" | "STORE" | "BOOTH" | "WEB";
type PaymentMethod = "" | "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";

type CommissionRow = {
  id: string;
  channelId: string;
  reservationId: string | null;
  paymentId: string | null;
  sourceOrigin: "STORE" | "BOOTH" | "WEB" | "BAR";
  serviceId: string | null;
  customerName: string | null;
  commissionBaseCents: number;
  appliedCommissionMode: "PERCENT" | "FIXED";
  appliedCommissionValue: number;
  appliedCommissionPct: number | null;
  commissionCents: number;
  generatedAt: string;
  dueDate: string | null;
  status: Status;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  channel: { id: string; name: string; kind: string } | null;
  service: { id: string; name: string; category: string } | null;
  reservation: {
    id: string;
    source: string;
    status: string;
    boothCode: string | null;
    activityDate: string;
    scheduledTime: string | null;
    customerName: string | null;
  } | null;
  payment: {
    id: string;
    method: string;
    createdAt: string;
    amountCents: number;
    direction: string;
    isExternalCommissionOnly: boolean;
  } | null;
  paidByUser: { fullName: string | null; username: string | null } | null;
};

type FilterOption = {
  id: string;
  name: string;
  category?: string | null;
  kind?: string | null;
  isActive?: boolean;
};

type Summary = Record<Status, { count: number; commissionCents: number }>;

const tabs: Array<{ status: Status; label: string }> = [
  { status: "PENDING", label: "Pendientes" },
  { status: "PAID", label: "Pagadas" },
  { status: "VOIDED", label: "Anuladas" },
];

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8) : "-";
}

function ymd(value?: string | null) {
  return value ? value.slice(0, 10) : "-";
}

function dateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function commissionRule(row: CommissionRow) {
  if (row.appliedCommissionMode === "FIXED") return `${euros(Math.round(row.appliedCommissionValue * 100))} fija`;
  return `${Number(row.appliedCommissionPct ?? row.appliedCommissionValue ?? 0).toFixed(2)}%`;
}

export default function AdminCommissionsPage() {
  const [activeStatus, setActiveStatus] = useState<Status>("PENDING");
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    PENDING: { count: 0, commissionCents: 0 },
    PAID: { count: 0, commissionCents: 0 },
    VOIDED: { count: 0, commissionCents: 0 },
  });
  const [channels, setChannels] = useState<FilterOption[]>([]);
  const [services, setServices] = useState<FilterOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [channelId, setChannelId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [origin, setOrigin] = useState<Origin>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [paidMethod, setPaidMethod] = useState<PaymentMethod>("TRANSFER");
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );
  const currentTotal = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.commissionCents ?? 0), 0),
    [rows]
  );
  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + Number(row.commissionCents ?? 0), 0),
    [selectedRows]
  );
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("status", activeStatus);
      if (channelId) qs.set("channelId", channelId);
      if (serviceId) qs.set("serviceId", serviceId);
      if (origin) qs.set("origin", origin);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      if (dueFrom) qs.set("dueFrom", dueFrom);
      if (dueTo) qs.set("dueTo", dueTo);

      const response = await fetch(`/api/admin/commissions?${qs.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setRows(data.rows ?? []);
      setSummary(data.summary ?? summary);
      setChannels(data.filters?.channels ?? []);
      setServices(data.filters?.services ?? []);
      setSelectedIds([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando comisiones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((current) => current !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(rows.map((row) => row.id));
  }

  async function markPaid(ids: string[]) {
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    try {
      const paidAt = paidDate ? new Date(`${paidDate}T12:00:00.000Z`).toISOString() : undefined;
      const response = await fetch("/api/admin/commissions/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          paidAt,
          paymentMethod: paidMethod || null,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como pagada");
    } finally {
      setBusy(false);
    }
  }

  async function voidLines(ids: string[]) {
    if (!ids.length) return;
    const reason = prompt("Motivo de anulación:");
    if (!reason || reason.trim().length < 3) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/commissions/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, reason: reason.trim() }),
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo anular");
    } finally {
      setBusy(false);
    }
  }

  async function patchLine(id: string, patch: { notes?: string | null; dueDate?: string | null }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/commissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo editar la línea");
    } finally {
      setBusy(false);
    }
  }

  function editNotes(row: CommissionRow) {
    const next = prompt("Nota administrativa:", row.notes ?? "");
    if (next === null) return;
    void patchLine(row.id, { notes: next.trim() || null });
  }

  function editDueDate(row: CommissionRow) {
    const next = prompt("Vencimiento (YYYY-MM-DD, vacío para quitar):", ymd(row.dueDate) === "-" ? "" : ymd(row.dueDate));
    if (next === null) return;
    const clean = next.trim();
    void patchLine(row.id, { dueDate: clean ? new Date(`${clean}T12:00:00.000Z`).toISOString() : null });
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Administración</div>
          <h1 style={titleStyle}>Comisiones de canales</h1>
          <p style={subtitleStyle}>
            Control administrativo de comisiones generadas, pendientes de pago, pagadas y anuladas por canal o promotor.
          </p>
        </div>
        <div style={opsStyles.actionGrid}>
          <Link href="/admin" style={ghostBtn}>Volver a Admin</Link>
          <button type="button" onClick={() => void load()} disabled={loading || busy} style={darkBtn}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        {tabs.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setActiveStatus(tab.status)}
            style={{
              ...summaryCard,
              textAlign: "left",
              cursor: "pointer",
              borderColor: activeStatus === tab.status ? "#0f766e" : "#dbe4ea",
              background: activeStatus === tab.status ? "linear-gradient(180deg, #ecfeff 0%, #ffffff 100%)" : "#fff",
            }}
          >
            <div style={summaryLabel}>{tab.label}</div>
            <div style={summaryValue}>{summary[tab.status]?.count ?? 0}</div>
            <div style={summaryMoney}>{euros(summary[tab.status]?.commissionCents ?? 0)}</div>
          </button>
        ))}
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <section style={filtersPanel}>
        <label style={fieldLabel}>
          Canal/promotor
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}{channel.isActive === false ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabel}>
          Servicio
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={inputStyle}>
            <option value="">Todos</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.category ? `${service.category} · ` : ""}{service.name}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabel}>
          Origen
          <select value={origin} onChange={(e) => setOrigin(e.target.value as Origin)} style={inputStyle}>
            <option value="">Todos</option>
            <option value="STORE">Store</option>
            <option value="BOOTH">Booth</option>
            <option value="WEB">Web</option>
          </select>
        </label>

        <label style={fieldLabel}>
          Generada desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </label>

        <label style={fieldLabel}>
          Generada hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </label>

        <label style={fieldLabel}>
          Vence desde
          <input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} style={inputStyle} />
        </label>

        <label style={fieldLabel}>
          Vence hasta
          <input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} style={inputStyle} />
        </label>

        <button type="button" onClick={() => void load()} disabled={loading || busy} style={darkBtn}>
          Aplicar filtros
        </button>
      </section>

      {activeStatus === "PENDING" ? (
        <section style={bulkPanel}>
          <div style={{ fontWeight: 950 }}>
            Selección: {selectedIds.length} líneas · {euros(selectedTotal)}
          </div>
          <label style={compactLabel}>
            Fecha pago
            <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={smallInput} />
          </label>
          <label style={compactLabel}>
            Método
            <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value as PaymentMethod)} style={smallInput}>
              <option value="">Sin método</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BIZUM">Bizum</option>
              <option value="VOUCHER">Voucher</option>
            </select>
          </label>
          <button type="button" onClick={() => void markPaid(selectedIds)} disabled={busy || selectedIds.length === 0} style={darkBtn}>
            Marcar pagadas
          </button>
          <button type="button" onClick={() => void voidLines(selectedIds)} disabled={busy || selectedIds.length === 0} style={dangerBtn}>
            Anular selección
          </button>
        </section>
      ) : null}

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div>
            <div style={{ fontWeight: 950 }}>{tabs.find((tab) => tab.status === activeStatus)?.label}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {rows.length} líneas visibles · {euros(currentTotal)}
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 900 }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
            Seleccionar visibles
          </label>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>Generada</th>
                <th style={thStyle}>Vence</th>
                <th style={thStyle}>Promotor/canal</th>
                <th style={thStyle}>Reserva</th>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Servicio</th>
                <th style={thStyle}>Origen</th>
                <th style={thRight}>Base</th>
                <th style={thRight}>Comisión</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Pago</th>
                <th style={thStyle}>Método</th>
                <th style={thStyle}>Notas</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} style={emptyCell}>Cargando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} style={emptyCell}>Sin líneas.</td></tr>
              ) : rows.map((row) => {
                const selected = selectedIds.includes(row.id);
                const reservationLabel = row.reservation?.boothCode ?? shortId(row.reservationId);
                const customer = row.customerName ?? row.reservation?.customerName ?? "-";
                return (
                  <tr key={row.id} style={{ background: selected ? "#f0fdfa" : "#fff" }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selected} onChange={() => toggleSelected(row.id)} />
                    </td>
                    <td style={tdStyle}>{dateTime(row.generatedAt)}</td>
                    <td style={tdStyle}>{ymd(row.dueDate)}</td>
                    <td style={tdStrong}>{row.channel?.name ?? shortId(row.channelId)}</td>
                    <td style={tdStyle}>
                      {row.reservationId ? (
                        <Link href={`/store?reservationId=${row.reservationId}`} style={linkStyle}>
                          {reservationLabel}
                        </Link>
                      ) : shortId(row.paymentId)}
                    </td>
                    <td style={tdStyle}>{customer}</td>
                    <td style={tdStyle}>{row.service?.name ?? "-"}</td>
                    <td style={tdStyle}>{row.sourceOrigin}</td>
                    <td style={tdRight}>{euros(row.commissionBaseCents)}</td>
                    <td style={tdRight}>
                      <strong>{euros(row.commissionCents)}</strong>
                      <div style={mutedText}>{commissionRule(row)}</div>
                    </td>
                    <td style={tdStyle}><StatusPill status={row.status} /></td>
                    <td style={tdStyle}>{ymd(row.paidAt)}</td>
                    <td style={tdStyle}>{row.paymentMethod || "-"}</td>
                    <td style={{ ...tdStyle, minWidth: 220 }}>{row.notes || "-"}</td>
                    <td style={tdStyle}>
                      <div style={rowActions}>
                        {row.status === "PENDING" ? (
                          <>
                            <button type="button" onClick={() => void markPaid([row.id])} disabled={busy} style={miniBtn}>Pagar</button>
                            <button type="button" onClick={() => void voidLines([row.id])} disabled={busy} style={miniDanger}>Anular</button>
                          </>
                        ) : null}
                        <button type="button" onClick={() => editNotes(row)} disabled={busy} style={miniBtn}>Nota</button>
                        <button type="button" onClick={() => editDueDate(row)} disabled={busy} style={miniBtn}>Vence</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const style =
    status === "PAID"
      ? { background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }
      : status === "VOIDED"
        ? { background: "#fff1f2", color: "#be123c", borderColor: "#fecdd3" }
        : { background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
  const label = status === "PAID" ? "Pagada" : status === "VOIDED" ? "Anulada" : "Pendiente";
  return <span style={{ ...pillStyle, ...style }}>{label}</span>;
}

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1440px, 100%)",
  gap: 14,
  background: "linear-gradient(180deg, #f8fafc 0%, #eef7f6 100%)",
};

const heroStyle: CSSProperties = {
  ...opsStyles.heroCard,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #ecfeff 100%)",
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
  color: "#0f766e",
};

const titleStyle: CSSProperties = {
  ...opsStyles.heroTitle,
  margin: 0,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  ...opsStyles.metricCard,
  padding: 14,
  border: "1px solid #dbe4ea",
  borderRadius: 16,
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

const summaryMoney: CSSProperties = {
  marginTop: 2,
  color: "#0f766e",
  fontSize: 13,
  fontWeight: 900,
};

const filtersPanel: CSSProperties = {
  ...opsStyles.sectionCard,
  background: "#fff",
  border: "1px solid #dbe4ea",
  padding: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
  alignItems: "end",
};

const bulkPanel: CSSProperties = {
  ...filtersPanel,
  gridTemplateColumns: "1fr repeat(4, auto)",
};

const panelStyle: CSSProperties = {
  ...opsStyles.sectionCard,
  padding: 0,
  background: "#fff",
  border: "1px solid #dbe4ea",
  overflow: "hidden",
};

const panelHeader: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #e5edf3",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
};

const compactLabel: CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
  minHeight: 42,
};

const smallInput: CSSProperties = {
  ...inputStyle,
  minWidth: 150,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  color: "#0f172a",
};

const darkBtn: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 900,
};

const dangerBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
  whiteSpace: "pre-wrap",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  minWidth: 1320,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5edf3",
  background: "#f8fafc",
  color: "#475569",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const thRight: CSSProperties = {
  ...thStyle,
  textAlign: "right",
};

const tdStyle: CSSProperties = {
  padding: "10px 8px",
  borderBottom: "1px solid #edf2f7",
  verticalAlign: "top",
  color: "#334155",
};

const tdStrong: CSSProperties = {
  ...tdStyle,
  fontWeight: 900,
  color: "#0f172a",
};

const tdRight: CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const emptyCell: CSSProperties = {
  padding: 18,
  color: "#64748b",
};

const mutedText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginTop: 2,
};

const linkStyle: CSSProperties = {
  color: "#0f766e",
  fontWeight: 900,
  textDecoration: "none",
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 190,
};

const miniBtn: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const miniDanger: CSSProperties = {
  ...miniBtn,
  borderColor: "#fecaca",
  background: "#fff1f2",
  color: "#991b1b",
};

const pillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
