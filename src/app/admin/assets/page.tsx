"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { opsStyles } from "@/components/ops-ui";
import AssetModal from "@/app/admin/assets/_components/AssetModal";
import AdminAssetsFiltersSection from "@/app/admin/assets/_components/AdminAssetsFiltersSection";
import AdminAssetsListSection from "@/app/admin/assets/_components/AdminAssetsListSection";
import type { AssetRow, AssetStatus, AssetType } from "../types";

const ASSET_TYPES: AssetType[] = ["BOAT", "TOWBOAT", "JETCAR", "PARASAILING", "FLYBOARD", "TOWABLE", "OTHER"];
const ASSET_STATUSES: AssetStatus[] = ["OPERATIONAL", "MAINTENANCE", "DAMAGED", "OUT_OF_SERVICE"];

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1320px, 100%)",
  gap: 16,
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  padding: 10,
  borderRadius: 12,
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
};

const darkBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

export default function AdminAssetsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | AssetType>("");
  const [status, setStatus] = useState<"" | AssetStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);

  const filteredParams = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    return params.toString();
  }, [q, type, status]);

  const load = useCallback(
    async (opts?: { showLoading?: boolean }) => {
      const showLoading = opts?.showLoading ?? true;
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/assets?${filteredParams}`, { cache: "no-store" });
        if (!response.ok) throw new Error(await response.text());
        const json = await response.json();
        setRows(json.assets ?? []);
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Error cargando recursos");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [filteredParams]
  );

  useEffect(() => {
    void load({ showLoading: true });
  }, [load]);

  const operationalCount = rows.filter((row) => row.status === "OPERATIONAL").length;
  const maintenanceCount = rows.filter((row) => row.status === "MAINTENANCE").length;
  const unavailableCount = rows.filter((row) => row.status === "DAMAGED" || row.status === "OUT_OF_SERVICE").length;

  return (
    <div style={pageShell}>
      <section
        style={{
          ...opsStyles.heroCard,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}
        >
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                color: "#0891b2",
              }}
            >
              Admin
            </div>
            <div style={{ ...opsStyles.heroTitle, color: "#0f172a" }}>Recursos náuticos</div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Flota de apoyo, estado operativo y datos técnicos de boats, towboat, jetcar, parasailing, flyboard y
              towables.
            </div>
          </div>

          <div style={{ ...opsStyles.actionGrid, width: "min(100%, 520px)" }}>
            <Link href="/admin" style={ghostBtn}>
              Volver a admin
            </Link>
            <button type="button" onClick={() => void load({ showLoading: true })} style={ghostBtn}>
              Refrescar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              style={darkBtn}
            >
              Nuevo recurso
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPill}>Recursos: {rows.length}</span>
          <span style={heroPill}>Operativos: {operationalCount}</span>
          <span style={heroPill}>Mantenimiento: {maintenanceCount}</span>
          <span style={heroPill}>Fuera de servicio: {unavailableCount}</span>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard title="Recursos" value={rows.length} tone="neutral" />
        <MetricCard title="Operativos" value={operationalCount} tone="success" />
        <MetricCard title="Mantenimiento" value={maintenanceCount} tone="info" />
        <MetricCard title="Bloqueados" value={unavailableCount} tone="warning" />
      </div>

      <AdminAssetsFiltersSection
        q={q}
        type={type}
        status={status}
        assetTypes={ASSET_TYPES}
        assetStatuses={ASSET_STATUSES}
        inputStyle={inputStyle}
        cardStyle={softCard}
        onQueryChange={setQ}
        onTypeChange={setType}
        onStatusChange={setStatus}
      />

      <AdminAssetsListSection
        rows={rows}
        loading={loading}
        error={error}
        cardStyle={softCard}
        errorBox={errorBox}
        fmtDateTime={fmtDateTime}
        onEdit={(row) => {
          setEditing(row);
          setOpen(true);
        }}
      />

      {open ? (
        <AssetModal
          initial={editing}
          inputStyle={inputStyle}
          ghostBtn={ghostBtn}
          darkBtn={darkBtn}
          errorBox={errorBox}
          overlayStyle={overlayStyle}
          modalStyle={modalStyle}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await load({ showLoading: true });
          }}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "neutral" | "success" | "info" | "warning";
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { border: "1px solid #dbe4ea", background: "#fff", color: "#0f172a" },
    success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" },
    info: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" },
    warning: { border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e" },
  };

  return (
    <div style={{ ...softCard, ...tones[tone], padding: 14, boxShadow: "none" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

const heroPill: React.CSSProperties = {
  ...opsStyles.heroPill,
  border: "1px solid #bae6fd",
  background: "rgba(255,255,255,0.88)",
  color: "#0f766e",
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.38)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 70,
};

const modalStyle: React.CSSProperties = {
  width: "min(960px, 100%)",
  borderRadius: 20,
  border: "1px solid #dbe4ea",
  background: "#fff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
  padding: 18,
  display: "grid",
  gap: 14,
};
