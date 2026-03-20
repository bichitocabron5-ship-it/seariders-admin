"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Channel = {
  id: string;
  name: string;
  isActive: boolean;
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
          ? `Error ${r.status}: /api/admin/channels no devolvio JSON.`
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

      setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)));
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
        throw new Error("La comision base debe estar entre 0 y 100");
      }

      const commissionBps = Math.round(parsedPct * 100);

      const r = await fetch("/api/admin/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          isActive: newIsActive,
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
            Gestion de activacion comercial y comision base por canal. Las reglas especificas por servicio se editan
            desde el detalle de cada canal.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
          <div style={summaryLabel}>Comision activa</div>
          <div style={summaryValue}>{stats.commissionActive}</div>
        </article>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Crear canal</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Alta rapida de un canal comercial con estado y comision base inicial.
          </div>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={controlsGrid}>
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Nombre del canal
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Booking, GetYourGuide, Brutal"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Comision base (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={newCommissionPct}
                onChange={(e) => setNewCommissionPct(e.target.value)}
                style={inputStyle}
                disabled={!newCommissionEnabled}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={newCommissionEnabled}
                onChange={(e) => {
                  setNewCommissionEnabled(e.target.checked);
                  if (!e.target.checked) setNewCommissionPct("0");
                }}
              />
              Comision activa
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
              <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
              Canal activo
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => void createChannel()} disabled={creating} style={darkBtn}>
              {creating ? "Creando..." : "Crear canal"}
            </button>
          </div>
        </div>
      </section>

      <section style={panelStyle}>
        <div style={panelHeader}>
          <div style={{ fontWeight: 950 }}>Configuracion de canales</div>
          <div style={{ fontWeight: 900, color: "#475569" }}>{channels.length} registros</div>
        </div>

        <div style={{ padding: 14 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
          {!loading && channels.length === 0 ? <div style={{ opacity: 0.7 }}>No hay canales.</div> : null}

          <div style={{ display: "grid", gap: 12 }}>
            {channels.map((ch) => {
              const pct = (ch.commissionBps ?? 0) / 100;
              const busy = savingId === ch.id;
              return (
                <article key={ch.id} style={rowCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{ch.name}</div>
                        <span style={{ ...statusPill, ...(ch.isActive ? statusOn : statusOff) }}>
                          {ch.isActive ? "Activo" : "Inactivo"}
                        </span>
                        <span style={{ ...statusPill, ...(ch.commissionEnabled ? statusOn : statusOff) }}>
                          {ch.commissionEnabled ? "Comision ON" : "Comision OFF"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Comision base y reglas especificas por servicio.
                      </div>
                    </div>

                    <Link href={`/admin/channels/${ch.id}/commissions`} style={ghostBtn}>
                      Reglas por servicio
                    </Link>
                  </div>

                  <div style={controlsGrid}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={ch.commissionEnabled}
                        disabled={busy}
                        onChange={(e) => {
                          void patchChannel(ch.id, { commissionEnabled: e.target.checked });
                        }}
                      />
                      Comision activa
                    </label>

                    <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                      Comision base (%)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={pct}
                        disabled={busy}
                        onChange={(e) => {
                          const v = Number(e.target.value || 0);
                          const bps = Math.round(v * 100);
                          void patchChannel(ch.id, { commissionBps: bps });
                        }}
                        style={inputStyle}
                      />
                    </label>

                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={ch.isActive}
                        disabled={busy}
                        onChange={(e) => {
                          void patchChannel(ch.id, { isActive: e.target.checked });
                        }}
                      />
                      Canal activo
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
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
    "radial-gradient(circle at top left, rgba(59, 130, 246, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(14, 165, 233, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 26,
  padding: 20,
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
  margin: 0,
  fontSize: 34,
  lineHeight: 1,
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

const panelStyle: CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 18,
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
  padding: 10,
  borderRadius: 10,
  border: "1px solid #dbe4ea",
  outline: "none",
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

const darkBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
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
