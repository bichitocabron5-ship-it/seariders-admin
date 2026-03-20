"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ApiGet = {
  ok: true;
  policy: { id: string; intervalMinutes: number; openTime: string; closeTime: string };
  categories: string[];
  limits: { category: string; maxUnits: number }[];
};

const pageShell: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: 24,
  display: "grid",
  gap: 16,
};

const softCard: React.CSSProperties = {
  border: "1px solid #dbe4ea",
  borderRadius: 22,
  background: "#fff",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  textDecoration: "none",
};

const darkBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
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
      const r = await fetch("/api/admin/slots", { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as ApiGet;
      setData(j);
      setIntervalMinutes(j.policy.intervalMinutes ?? 30);
      setOpenTime(j.policy.openTime ?? "09:00");
      setCloseTime(j.policy.closeTime ?? "20:00");
      const m: Record<string, number> = {};
      for (const row of j.limits) m[String(row.category).toUpperCase()] = Number(row.maxUnits ?? 0);
      for (const c of j.categories) if (m[c] == null) m[c] = c === "JETSKI" ? 10 : 1;
      setLimitsMap(m);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error cargando slots");
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
      const limits = categories.map((c) => ({
        category: c,
        maxUnits: Number(limitsMap[c] ?? 0),
      }));

      const r = await fetch("/api/admin/slots", {
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

      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as ApiGet;
      setData(j);
      setIntervalMinutes(j.policy.intervalMinutes ?? 30);
      setOpenTime(j.policy.openTime ?? "09:00");
      setCloseTime(j.policy.closeTime ?? "20:00");
      const m: Record<string, number> = {};
      for (const row of j.limits) m[String(row.category).toUpperCase()] = Number(row.maxUnits ?? 0);
      for (const c of j.categories) if (m[c] == null) m[c] = c === "JETSKI" ? 10 : 1;
      setLimitsMap(m);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
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
            <div style={{ fontSize: 34, lineHeight: 1.02, fontWeight: 950, color: "#0f172a" }}>Slots y capacidad</div>
            <div style={{ fontSize: 14, color: "#475569" }}>
              Politica horaria, intervalo de reserva y limites por categoria en una pantalla mas ordenada.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin" style={ghostBtn}>
              Volver a admin
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
          <span style={pillStyle}>Categorias: {categories.length}</span>
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

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 950, fontSize: 20 }}>Politica de slots</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Intervalo (minutos)
            <input
              type="number"
              min={5}
              max={240}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Apertura
            <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Cierre
            <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} style={inputStyle} />
          </label>
        </div>
      </section>

      <section style={{ ...softCard, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 950, fontSize: 20 }}>Capacidad por categoria</div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>{categories.length} categoria(s)</div>
        </div>

        {!data ? (
          <div style={{ opacity: 0.7 }}>{loading ? "Cargando..." : "Sin datos"}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {categories.map((c) => (
              <div
                key={c}
                style={{
                  border: "1px solid #e5edf4",
                  borderRadius: 18,
                  padding: 14,
                  background: "linear-gradient(180deg, #ffffff 0%, #fafcff 100%)",
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 240px) 1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 950 }}>{c}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {c === "JETSKI" ? "Referencia inicial recomendada: 10" : "Referencia inicial: 1"}
                  </div>
                </div>

                <input
                  type="number"
                  min={0}
                  max={999}
                  value={limitsMap[c] ?? 0}
                  onChange={(e) =>
                    setLimitsMap((prev) => ({
                      ...prev,
                      [c]: Number(e.target.value),
                    }))
                  }
                  style={{ ...inputStyle, maxWidth: 180 }}
                />

                <span style={limitBadge}>{Number(limitsMap[c] ?? 0)} ud.</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={{ fontSize: 12, color: "#64748b" }}>
        Nota: si anades una categoria nueva en Catalogo, aparecera aqui automaticamente con un limite inicial por defecto.
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
