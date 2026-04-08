"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import ChannelsConfigurationSection from "./_components/ChannelsConfigurationSection";
import CreateChannelSection from "./_components/CreateChannelSection";

type Channel = {
  id: string;
  name: string;
  isActive: boolean;
  visibleInStore: boolean;
  visibleInBooth: boolean;
  allowsPromotions: boolean;
  commissionEnabled: boolean;
  commissionBps: number | null;
};

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newIsActive, setNewIsActive] = useState(true);
  const [newVisibleInStore, setNewVisibleInStore] = useState(true);
  const [newVisibleInBooth, setNewVisibleInBooth] = useState(false);
  const [newAllowsPromotions, setNewAllowsPromotions] = useState(false);
  const [newCommissionEnabled, setNewCommissionEnabled] = useState(false);
  const [newCommissionPct, setNewCommissionPct] = useState("0");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/channels", { cache: "no-store" });
      if (!r.ok) {
        const text = await r.text();
        const msg = r.headers.get("content-type")?.includes("text/html")
          ? `Error ${r.status}: /api/admin/channels no devolvió JSON.`
          : `Error ${r.status}: ${text.slice(0, 200)}`;
        throw new Error(msg);
      }
      const data = await r.json();
      setChannels(data.channels ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando canales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    return {
      total: channels.length,
      active: channels.filter((ch) => ch.isActive).length,
      commissionActive: channels.filter((ch) => ch.commissionEnabled).length,
    };
  }, [channels]);

  async function patchChannel(id: string, patch: Partial<Channel>) {
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/admin/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      const updated = data.channel as Channel | undefined;
      setChannels((prev) => prev.map((ch) => (ch.id === id ? (updated ?? { ...ch, ...patch }) : ch)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error actualizando canal");
    } finally {
      setSavingId(null);
    }
  }

  async function createChannel() {
    setCreating(true);
    setError(null);
    try {
      const trimmedName = newName.trim();
      if (!trimmedName) {
        throw new Error("Falta el nombre del canal");
      }

      const parsedPct = Number(newCommissionPct || "0");
      if (!Number.isFinite(parsedPct) || parsedPct < 0 || parsedPct > 100) {
        throw new Error("La comisión base debe estar entre 0 y 100");
      }

      const commissionBps = Math.round(parsedPct * 100);

      const r = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          isActive: newIsActive,
          visibleInStore: newVisibleInStore,
          visibleInBooth: newVisibleInBooth,
          allowsPromotions: newAllowsPromotions,
          commissionEnabled: newCommissionEnabled,
          commissionBps,
        }),
      });
      if (!r.ok) throw new Error(await r.text());

      const data = await r.json();
      if (data.channel) {
        setChannels((prev) => [...prev, data.channel].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        await load();
      }

      setNewName("");
      setNewIsActive(true);
      setNewVisibleInStore(true);
      setNewVisibleInBooth(false);
      setNewAllowsPromotions(false);
      setNewCommissionEnabled(false);
      setNewCommissionPct("0");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error creando canal");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={eyebrowStyle}>Comercial</div>
          <h1 style={titleStyle}>Canales</h1>
          <p style={subtitleStyle}>
            Gestión de activación comercial y comisión base por canal. Las reglas específicas por servicio se editan
            desde el detalle de cada canal.
          </p>
        </div>

        <div style={opsStyles.actionGrid}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button type="button" onClick={() => void load()} disabled={loading} style={darkBtn}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Total canales</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Canales activos</div>
          <div style={summaryValue}>{stats.active}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Comisión activa</div>
          <div style={summaryValue}>{stats.commissionActive}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <CreateChannelSection
        newName={newName}
        newIsActive={newIsActive}
        newVisibleInStore={newVisibleInStore}
        newVisibleInBooth={newVisibleInBooth}
        newAllowsPromotions={newAllowsPromotions}
        newCommissionEnabled={newCommissionEnabled}
        newCommissionPct={newCommissionPct}
        creating={creating}
        setNewName={setNewName}
        setNewIsActive={setNewIsActive}
        setNewVisibleInStore={setNewVisibleInStore}
        setNewVisibleInBooth={setNewVisibleInBooth}
        setNewAllowsPromotions={setNewAllowsPromotions}
        setNewCommissionEnabled={setNewCommissionEnabled}
        setNewCommissionPct={setNewCommissionPct}
        createChannel={createChannel}
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        controlsGrid={controlsGrid}
        inputStyle={inputStyle}
        darkBtn={darkBtn}
      />

      <ChannelsConfigurationSection
        channels={channels}
        loading={loading}
        savingId={savingId}
        patchChannel={patchChannel}
        panelStyle={panelStyle}
        panelHeader={panelHeader}
        rowCard={rowCard}
        controlsGrid={controlsGrid}
        inputStyle={inputStyle}
        ghostBtn={ghostBtn}
        statusPill={statusPill}
        statusOn={statusOn}
        statusOff={statusOff}
      />
    </div>
  );
}

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1200px, 100%)",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  ...opsStyles.heroCard,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eff6ff 100%)",
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
  color: "#2563eb",
};

const titleStyle: CSSProperties = {
  ...opsStyles.heroTitle,
  margin: 0,
  fontWeight: 950,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  ...opsStyles.metricCard,
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

const panelStyle: CSSProperties = {
  ...opsStyles.sectionCard,
  padding: 0,
  background: "#fff",
  boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
};

const panelHeader: CSSProperties = {
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const rowCard: CSSProperties = {
  border: "1px solid #e5edf3",
  borderRadius: 16,
  padding: 12,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  display: "grid",
  gap: 12,
};

const controlsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const inputStyle: CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 10,
  outline: "none",
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

const statusPill: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid transparent",
};

const statusOn: CSSProperties = {
  background: "#ecfeff",
  borderColor: "#99f6e4",
  color: "#0f766e",
};

const statusOff: CSSProperties = {
  background: "#f8fafc",
  borderColor: "#dbe4ea",
  color: "#64748b",
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
