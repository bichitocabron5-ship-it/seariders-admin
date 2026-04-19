"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";

type Row = {
  id: string;
  serviceId: string;
  serviceName: string | null;
  serviceCategory: string | null;
  optionId: string | null;
  optionLabel: string | null;
  durationMin: number | null;
  pricingTier: "STANDARD" | "RESIDENT";
  basePriceCents: number;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
};

type Service = {
  id: string;
  name: string;
  category: string;
};

type Option = {
  id: string;
  serviceId: string;
  durationMinutes: number;
  paxMax: number;
  contractedMinutes: number;
  isActive: boolean;
};

type CatalogResponse = {
  servicesMain: Service[];
  servicesExtra: Service[];
  options: Option[];
};

const currency = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function euros(cents: number) {
  return currency.format(Number(cents || 0) / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "Vigente";
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function optionDisplay(option: Option) {
  return `${option.durationMinutes} min · hasta ${option.paxMax} pax · contratado ${option.contractedMinutes} min`;
}

export default function PricingHistoryPage() {
  const initialSearch =
    typeof window !== "undefined" ? new URL(window.location.href).searchParams : null;

  const [rows, setRows] = useState<Row[]>([]);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>(initialSearch?.get("serviceId") ?? "");
  const [optionId, setOptionId] = useState<string>(initialSearch?.get("optionId") ?? "");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (serviceId.trim()) params.set("serviceId", serviceId.trim());
        if (optionId !== "") params.set("optionId", optionId.trim());

        const qs = params.toString();

        const [historyRes, catalogRes] = await Promise.all([
          fetch(`/api/admin/pricing/history${qs ? `?${qs}` : ""}`, { cache: "no-store" }),
          fetch("/api/admin/pricing/catalog", { cache: "no-store" }),
        ]);

        if (!historyRes.ok) {
          if (cancelled) return;
          setError(await historyRes.text());
          setRows([]);
          setLoading(false);
          return;
        }

        if (!catalogRes.ok) {
          if (cancelled) return;
          setError(await catalogRes.text());
          setRows([]);
          setLoading(false);
          return;
        }

        const historyJson = await historyRes.json();
        const catalogJson = (await catalogRes.json()) as CatalogResponse;

        if (cancelled) return;
        setRows(historyJson.rows ?? []);
        setCatalog(catalogJson);
        setLoading(false);
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [optionId, refreshTick, serviceId]);

  const serviceOptions = useMemo(() => {
    const all = [...(catalog?.servicesMain ?? []), ...(catalog?.servicesExtra ?? [])];
    return all.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [catalog]);

  const optionsForService = useMemo(() => {
    if (!serviceId) return [];
    return (catalog?.options ?? []).filter((option) => option.serviceId === serviceId);
  }, [catalog, serviceId]);

  const selectedService = useMemo(
    () => serviceOptions.find((service) => service.id === serviceId) ?? null,
    [serviceOptions, serviceId]
  );

  const title = useMemo(() => {
    if (!selectedService) return "Histórico de precios";
    if (optionId === "null") return `Histórico · ${selectedService.name} · extra`;
    if (!optionId) return `Histórico · ${selectedService.name}`;
    const selectedOption = optionsForService.find((option) => option.id === optionId);
    return selectedOption
      ? `Histórico · ${selectedService.name} · ${optionDisplay(selectedOption)}`
      : `Histórico · ${selectedService.name}`;
  }, [optionId, optionsForService, selectedService]);

  const activeCount = rows.filter((row) => row.isActive).length;

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Pricing</div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={subtitleStyle}>
            Histórico versionado de PVP base por servicio y opción. La tabla oculta claves internas y prioriza lectura comercial.
          </p>
        </div>

        <div style={actionsStyle}>
          <Link href="/admin/pricing" style={ghostBtn}>
            Volver a precios
          </Link>
          <button type="button" onClick={() => setRefreshTick((value) => value + 1)} style={primaryBtn} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <div style={statsGrid}>
        <StatCard label="Registros" value={String(rows.length)} />
        <StatCard label="Versiones activas" value={String(activeCount)} />
        <StatCard label="Servicio filtrado" value={selectedService?.name ?? "Todos"} />
      </div>

      <section style={filterCard}>
        <label style={fieldStyle}>
          Servicio
          <select
            value={serviceId}
            onChange={(e) => {
              const nextService = e.target.value;
              setServiceId(nextService);
              setOptionId("");
            }}
            style={inputStyle}
          >
            <option value="">Todos</option>
            {serviceOptions.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} · {service.category}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          Opción
          <select
            value={optionId}
            onChange={(e) => setOptionId(e.target.value)}
            style={inputStyle}
            disabled={!serviceId}
          >
            <option value="">Todas</option>
            <option value="null">Extra sin opción</option>
            {optionsForService.map((option) => (
              <option key={option.id} value={option.id}>
                {optionDisplay(option)}
              </option>
            ))}
          </select>
        </label>

        <div style={{ ...fieldStyle, justifyContent: "end" }}>
          <button
            type="button"
            onClick={() => {
              setServiceId("");
              setOptionId("");
            }}
            style={ghostBtn}
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={tableCard}>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Servicio</th>
                <th style={thStyle}>Opción</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Duración</th>
                <th style={thStyle}>Tarifa</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Precio</th>
                <th style={thStyle}>Desde</th>
                <th style={thStyle}>Hasta</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    Sin registros.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const serviceTitle = row.serviceName ?? "Servicio sin nombre";
                  const optionTitle =
                    row.optionLabel ?? (row.optionId === null ? "Extra sin opción asociada" : "Opción sin etiqueta");

                  return (
                    <tr key={row.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{serviceTitle}</div>
                        <div style={metaStyle}>{row.serviceCategory ?? "Sin categoría"}</div>
                      </td>
                      <td style={tdStyle}>
                        <div>{optionTitle}</div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {row.durationMin != null ? `${row.durationMin} min` : "-"}
                      </td>
                      <td style={tdStyle}>{row.pricingTier === "RESIDENT" ? "Residente" : "Estándar"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                        {euros(row.basePriceCents)}
                      </td>
                      <td style={tdStyle}>{formatDate(row.validFrom)}</td>
                      <td style={tdStyle}>{formatDate(row.validTo)}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <span
                          style={{
                            ...statusPill,
                            background: row.isActive ? "#f0fdf4" : "#f8fafc",
                            borderColor: row.isActive ? "#bbf7d0" : "#dbe4ea",
                            color: row.isActive ? "#166534" : "#475569",
                          }}
                        >
                          {row.isActive ? "Activa" : "Cerrada"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{props.label}</div>
      <div style={statValue}>{props.value}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1320px, 100%)",
  display: "grid",
  gap: 18,
  background:
    "radial-gradient(circle at top left, rgba(37, 99, 235, 0.06), transparent 28%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 24%)",
};

const heroStyle: React.CSSProperties = {
  ...opsStyles.heroCard,
  borderRadius: 28,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #eef2ff 100%)",
  display: "grid",
  gap: 18,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#2563eb",
};

const titleStyle: React.CSSProperties = {
  ...opsStyles.heroTitle,
  margin: 0,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  lineHeight: 1.05,
  color: "#0f172a",
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 760,
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
};

const actionsStyle: React.CSSProperties = {
  ...opsStyles.actionGrid,
};

const primaryBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 14px",
  borderRadius: 14,
  fontWeight: 950,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 14px",
  borderRadius: 14,
  color: "#0f172a",
  fontWeight: 900,
  textDecoration: "none",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const statCard: React.CSSProperties = {
  ...opsStyles.metricCard,
  borderRadius: 18,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  display: "grid",
  gap: 6,
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const statValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
  color: "#0f172a",
};

const filterCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 20,
  padding: 16,
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1fr) minmax(280px, 1.2fr) auto",
  gap: 12,
  alignItems: "end",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: "12px 14px",
  borderRadius: 12,
  background: "#fff",
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const tableCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 22,
  overflow: "hidden",
};

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 980,
};

const thStyle: React.CSSProperties = {
  padding: "14px 16px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  color: "#334155",
  verticalAlign: "top",
};

const metaStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
};

const emptyStyle: React.CSSProperties = {
  padding: 20,
  textAlign: "center",
  color: "#64748b",
};

const statusPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #dbe4ea",
  fontSize: 12,
  fontWeight: 900,
  minWidth: 84,
};

