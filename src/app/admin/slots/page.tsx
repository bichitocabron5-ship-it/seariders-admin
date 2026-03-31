"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { opsStyles } from "@/components/ops-ui";
import SlotsCapacitySection from "./_components/SlotsCapacitySection";
import SlotsPolicySection from "./_components/SlotsPolicySection";
import type { ApiGet } from "./types";

const pageShell: React.CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1280px, 100%)",
  gap: 16,
};

const softCard: React.CSSProperties = {
  ...opsStyles.sectionCard,
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  ...opsStyles.field,
  width: "100%",
  padding: 10,
  borderRadius: 12,
};

const ghostBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  color: "#111",
};

const darkBtn: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

export default function AdminSlotsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<ApiGet | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("20:00");
  const [limitsMap, setLimitsMap] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const response = await fetch("/api/admin/slots", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const json = (await response.json()) as ApiGet;
      setData(json);
      setIntervalMinutes(json.policy.intervalMinutes ?? 30);
      setOpenTime(json.policy.openTime ?? "09:00");
      setCloseTime(json.policy.closeTime ?? "20:00");
      const nextMap: Record<string, number> = {};
      for (const row of json.limits) nextMap[String(row.category).toUpperCase()] = Number(row.maxUnits ?? 0);
      for (const category of json.categories) {
        if (nextMap[category] == null) nextMap[category] = category === "JETSKI" ? 10 : 1;
      }
      setLimitsMap(nextMap);
    } catch (cause: unknown) {
      setErr(cause instanceof Error ? cause.message : "Error cargando slots");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = useMemo(() => {
    if (!data?.categories) return [];
    return data.categories.slice().sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const limits = categories.map((category) => ({
        category,
        maxUnits: Number(limitsMap[category] ?? 0),
      }));

      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: {
            intervalMinutes: Number(intervalMinutes),
            openTime: String(openTime).trim(),
            closeTime: String(closeTime).trim(),
          },
          limits,
        }),
      });

      if (!response.ok) throw new Error(await response.text());
      const json = (await response.json()) as ApiGet;
      setData(json);
      setIntervalMinutes(json.policy.intervalMinutes ?? 30);
      setOpenTime(json.policy.openTime ?? "09:00");
      setCloseTime(json.policy.closeTime ?? "20:00");
      const nextMap: Record<string, number> = {};
      for (const row of json.limits) nextMap[String(row.category).toUpperCase()] = Number(row.maxUnits ?? 0);
      for (const category of json.categories) {
        if (nextMap[category] == null) nextMap[category] = category === "JETSKI" ? 10 : 1;
      }
      setLimitsMap(nextMap);
    } catch (cause: unknown) {
      setErr(cause instanceof Error ? cause.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const totalCapacity = categories.reduce((acc, category) => acc + Number(limitsMap[category] ?? 0), 0);

  return (
    <div style={pageShell}>
      <section
        style={{
          ...softCard,
          padding: 20,
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #ecfeff 100%)",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase", color: "#0891b2" }}>
              Admin
            </div>
            <div style={{ ...opsStyles.heroTitle, fontSize: "clamp(30px, 4vw, 38px)", lineHeight: 1.02, color: "#0f172a" }}>
              Slots y capacidad
            </div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Política horaria, intervalo de reserva y límites por categoría en una pantalla más ordenada.
            </div>
          </div>

          <div style={opsStyles.actionGrid}>
            <Link href="/admin" style={ghostBtn}>
              Volver a Admin
            </Link>
            <button type="button" onClick={() => void load()} disabled={loading || saving} style={ghostBtn}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
            <button type="button" onClick={() => void save()} disabled={loading || saving || !data} style={darkBtn}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={pillStyle}>Categorías: {categories.length}</span>
          <span style={pillStyle}>Intervalo: {intervalMinutes} min</span>
          <span style={pillStyle}>Horario: {openTime} - {closeTime}</span>
          <span style={pillStyle}>Capacidad total: {totalCapacity}</span>
        </div>
      </section>

      {err ? <div style={errorBox}>{err}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard title="Intervalo" value={`${intervalMinutes} min`} tone="info" />
        <MetricCard title="Apertura" value={openTime} tone="neutral" />
        <MetricCard title="Cierre" value={closeTime} tone="neutral" />
        <MetricCard title="Capacidad total" value={String(totalCapacity)} tone="success" />
      </div>

      <SlotsPolicySection
        intervalMinutes={intervalMinutes}
        openTime={openTime}
        closeTime={closeTime}
        inputStyle={inputStyle}
        cardStyle={softCard}
        onIntervalChange={setIntervalMinutes}
        onOpenTimeChange={setOpenTime}
        onCloseTimeChange={setCloseTime}
      />

      <SlotsCapacitySection
        dataLoaded={Boolean(data)}
        loading={loading}
        categories={categories}
        limitsMap={limitsMap}
        inputStyle={inputStyle}
        cardStyle={softCard}
        limitBadge={limitBadge}
        onLimitChange={(category, value) =>
          setLimitsMap((prev) => ({
            ...prev,
            [category]: value,
          }))
        }
      />

      <div style={{ fontSize: 12, color: "#64748b" }}>
        Nota: si añades una categoría nueva en Catálogo, aparecerá aquí automáticamente con un límite inicial por defecto.
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "neutral" | "success" | "info";
}) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { border: "1px solid #dbe4ea", background: "#fff", color: "#0f172a" },
    success: { border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534" },
    info: { border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1d4ed8" },
  };

  return (
    <div style={{ ...softCard, ...tones[tone], padding: 14, boxShadow: "none" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.82 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #bae6fd",
  background: "rgba(255,255,255,0.88)",
  color: "#0f766e",
  fontWeight: 900,
  fontSize: 12,
};

const limitBadge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #dbe4ea",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 900,
  fontSize: 12,
};

const errorBox: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontWeight: 900,
};
