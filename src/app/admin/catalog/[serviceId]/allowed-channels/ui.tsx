"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type ServiceData = {
  id: string;
  name: string;
  category: string;
};

type ChannelRow = {
  id: string;
  name: string;
  visibleInStore: boolean;
  visibleInBooth: boolean;
};

type RuleRow = {
  channelId: string;
  active: boolean;
};

export default function AdminServiceAllowedChannelsClient({ serviceId }: { serviceId: string }) {
  const [service, setService] = useState<ServiceData | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasConfiguration, setHasConfiguration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/catalog/services/${serviceId}/allowed-channels`, { cache: "no-store" });
    if (!response.ok) {
      setError(await response.text());
      setLoading(false);
      return;
    }

    const data = await response.json();
    const rules = (data.rules ?? []) as RuleRow[];
    const nextDraft = Object.fromEntries(rules.map((rule) => [rule.channelId, Boolean(rule.active)]));

    setService((data.service ?? null) as ServiceData | null);
    setChannels((data.channels ?? []) as ChannelRow[]);
    setDraft(nextDraft);
    setHasConfiguration(Boolean(data.hasConfiguration));
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleSummary = useMemo(() => {
    return {
      store: channels.filter((channel) => channel.visibleInStore).length,
      booth: channels.filter((channel) => channel.visibleInBooth).length,
    };
  }, [channels]);

  async function saveConfiguration() {
    setSaving(true);
    setError(null);
    setNotice(null);

    const rules = channels.map((channel) => ({
      channelId: channel.id,
      active: Boolean(draft[channel.id]),
    }));

    const response = await fetch(`/api/admin/catalog/services/${serviceId}/allowed-channels`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    });

    if (!response.ok) {
      setError(await response.text());
      setSaving(false);
      return;
    }

    const data = await response.json();
    setHasConfiguration(Boolean(data.hasConfiguration));
    setNotice("Configuración guardada.");
    setSaving(false);
  }

  async function resetToDefault() {
    setSaving(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/admin/catalog/services/${serviceId}/allowed-channels`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToDefault: true }),
    });

    if (!response.ok) {
      setError(await response.text());
      setSaving(false);
      return;
    }

    setDraft({});
    setHasConfiguration(false);
    setNotice("Configuración eliminada. El servicio queda abierto a todos los canales visibles.");
    setSaving(false);
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Catálogo</div>
          <h1 style={titleStyle}>Canales permitidos</h1>
          <p style={subtitleStyle}>
            {service?.name ?? "Servicio"}{service?.category ? ` · ${service.category}` : ""}. Si no hay configuración,
            el servicio queda abierto a todos los canales visibles en Store y Booth.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/catalog" style={ghostBtn}>Volver al catálogo</Link>
          <button type="button" onClick={() => void load()} style={ghostButtonElement} disabled={loading || saving}>
            Refrescar
          </button>
          <button type="button" onClick={() => void resetToDefault()} style={ghostButtonElement} disabled={loading || saving}>
            Usar todos los canales visibles
          </button>
          <button type="button" onClick={() => void saveConfiguration()} style={darkBtn} disabled={loading || saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Canales visibles Store</div>
          <div style={summaryValue}>{visibleSummary.store}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Canales visibles Booth</div>
          <div style={summaryValue}>{visibleSummary.booth}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Estado</div>
          <div style={summaryValueSmall}>{hasConfiguration ? "Filtrado activo" : "Sin reglas"}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}
      {notice ? <div style={noticeStyle}>{notice}</div> : null}

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 900 }}>Compatibilidad servicio ↔ canal</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Activa los canales que pueden vender este servicio. Guardar crea reglas explícitas; quitar la configuración
            vuelve al comportamiento abierto por defecto.
          </div>
        </div>

        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
          {!loading && channels.length === 0 ? <div style={{ opacity: 0.7 }}>No hay canales visibles para configurar.</div> : null}
          {!loading && channels.map((channel) => (
            <label key={channel.id} style={rowStyle}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>{channel.name}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
                  <span style={pillStyle(channel.visibleInStore)}>{channel.visibleInStore ? "Store" : "No Store"}</span>
                  <span style={pillStyle(channel.visibleInBooth)}>{channel.visibleInBooth ? "Booth" : "No Booth"}</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(draft[channel.id])}
                disabled={saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, [channel.id]: e.target.checked }))}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

const pageStyle: CSSProperties = {
  width: "min(1100px, 100%)",
  margin: "0 auto",
  padding: "24px 16px 48px",
  display: "grid",
  gap: 14,
};

const heroStyle: CSSProperties = {
  padding: 18,
  border: "1px solid #dbe7f3",
  borderRadius: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 52%, #ecfeff 100%)",
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

const titleStyle: CSSProperties = { margin: 0, fontSize: 34, lineHeight: 1, color: "#0f172a" };
const subtitleStyle: CSSProperties = { margin: 0, color: "#475569", maxWidth: 720 };

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCard: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

const summaryLabel: CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 800 };
const summaryValue: CSSProperties = { fontSize: 28, fontWeight: 900, color: "#0f172a" };
const summaryValueSmall: CSSProperties = { fontSize: 20, fontWeight: 900, color: "#0f172a" };

const panelStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#fff",
  overflow: "hidden",
};

const panelHeader: CSSProperties = {
  padding: 16,
  borderBottom: "1px solid #eef2f7",
  display: "grid",
  gap: 4,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
};

const ghostBtn: CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  background: "#fff",
  fontWeight: 800,
};

const ghostButtonElement: CSSProperties = {
  ...ghostBtn,
  cursor: "pointer",
};

const darkBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  fontWeight: 700,
};

const noticeStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #bae6fd",
  background: "#f0f9ff",
  color: "#075985",
  fontWeight: 700,
};

function pillStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 8px",
    borderRadius: 999,
    background: active ? "#dcfce7" : "#e2e8f0",
    color: active ? "#166534" : "#475569",
    fontWeight: 800,
  };
}
