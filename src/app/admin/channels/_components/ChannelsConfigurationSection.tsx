"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

type Channel = {
  id: string;
  name: string;
  isActive: boolean;
  allowsPromotions: boolean;
  commissionEnabled: boolean;
  commissionBps: number | null;
};

type Props = {
  channels: Channel[];
  loading: boolean;
  savingId: string | null;
  patchChannel: (id: string, patch: Partial<Channel>) => void | Promise<void>;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  rowCard: CSSProperties;
  controlsGrid: CSSProperties;
  inputStyle: CSSProperties;
  ghostBtn: CSSProperties;
  statusPill: CSSProperties;
  statusOn: CSSProperties;
  statusOff: CSSProperties;
};

export default function ChannelsConfigurationSection({
  channels,
  loading,
  savingId,
  patchChannel,
  panelStyle,
  panelHeader,
  rowCard,
  controlsGrid,
  inputStyle,
  ghostBtn,
  statusPill,
  statusOn,
  statusOff,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Configuración de canales</div>
        <div style={{ fontWeight: 900, color: "#475569" }}>{channels.length} registros</div>
      </div>

      <div style={{ padding: 14 }}>
        {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
        {!loading && channels.length === 0 ? <div style={{ opacity: 0.7 }}>No hay canales.</div> : null}

        <div style={{ display: "grid", gap: 12 }}>
          {channels.map((channel) => {
            const pct = (channel.commissionBps ?? 0) / 100;
            const busy = savingId === channel.id;

            return (
              <article key={channel.id} style={rowCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 17, color: "#0f172a" }}>{channel.name}</div>
                      <span style={{ ...statusPill, ...(channel.isActive ? statusOn : statusOff) }}>
                        {channel.isActive ? "Activo" : "Inactivo"}
                      </span>
                      <span style={{ ...statusPill, ...(channel.commissionEnabled ? statusOn : statusOff) }}>
                        {channel.commissionEnabled ? "Comisión ON" : "Comisión OFF"}
                      </span>
                      <span style={{ ...statusPill, ...(channel.allowsPromotions ? statusOn : statusOff) }}>
                        {channel.allowsPromotions ? "Promos ON" : "Promos OFF"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      Comisión base y reglas específicas por servicio.
                    </div>
                  </div>

                  <Link href={`/admin/channels/${channel.id}/commissions`} style={ghostBtn}>
                    Reglas por servicio
                  </Link>
                </div>

                <div style={controlsGrid}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={channel.allowsPromotions}
                      disabled={busy}
                      onChange={(e) => {
                        void patchChannel(channel.id, { allowsPromotions: e.target.checked });
                      }}
                    />
                    Permite promociones
                  </label>

                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={channel.commissionEnabled}
                      disabled={busy}
                      onChange={(e) => {
                        void patchChannel(channel.id, { commissionEnabled: e.target.checked });
                      }}
                    />
                    Comisión activa
                  </label>

                  <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    Comisión base (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={pct}
                      disabled={busy}
                      onChange={(e) => {
                        const value = Number(e.target.value || 0);
                        const bps = Math.round(value * 100);
                        void patchChannel(channel.id, { commissionBps: bps });
                      }}
                      style={inputStyle}
                    />
                  </label>

                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
                    <input
                      type="checkbox"
                      checked={channel.isActive}
                      disabled={busy}
                      onChange={(e) => {
                        void patchChannel(channel.id, { isActive: e.target.checked });
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
  );
}
