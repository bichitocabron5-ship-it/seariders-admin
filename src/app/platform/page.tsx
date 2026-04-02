// src/app/platform/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PlatformBoard from "./_components/PlatformBoard";
import { opsStyles } from "@/components/ops-ui";

type BoardOption = {
  key: "JETSKI" | "NAUTICA";
  title: string;
  kind: "JETSKI" | "NAUTICA";
  categories: string[];
};

type TaxiboatOperationRow = {
  id: string;
  boat: "TAXIBOAT_1" | "TAXIBOAT_2" | string;
  status: "TO_PLATFORM" | "AT_PLATFORM" | "TO_BOOTH" | "AT_BOOTH" | string;
  departedBoothAt?: string | null;
  arrivedPlatformAt?: string | null;
  departedPlatformAt?: string | null;
  arrivedBoothAt?: string | null;
  updatedAt: string;
};

const BOARD_OPTIONS: BoardOption[] = [
  {
    key: "JETSKI",
    title: "Plataforma - Jetski",
    kind: "JETSKI",
    categories: ["JETSKI"],
  },
  {
    key: "NAUTICA",
    title: "Plataforma - Náutica",
    kind: "NAUTICA",
    categories: ["TOWABLE", "WAKEBOARD", "FLYBOARD", "PARASAILING", "JETCAR", "BOAT"],
  },
];

export default function PlatformPage() {
  const [selected, setSelected] = useState<BoardOption["key"]>("JETSKI");
  const [taxiboatOps, setTaxiboatOps] = useState<TaxiboatOperationRow[]>([]);
  const [taxiboatLoading, setTaxiboatLoading] = useState(false);
  const [taxiboatError, setTaxiboatError] = useState<string | null>(null);
  const [actionBoat, setActionBoat] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const board = useMemo(
    () => BOARD_OPTIONS.find((b) => b.key === selected) || BOARD_OPTIONS[0],
    [selected]
  );

  async function loadTaxiboatOps() {
    setTaxiboatLoading(true);
    setTaxiboatError(null);

    try {
      const res = await fetch("/api/platform/taxiboat-operations", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { rows?: TaxiboatOperationRow[] };
      setTaxiboatOps(json.rows ?? []);
    } catch (e: unknown) {
      setTaxiboatError(e instanceof Error ? e.message : "Error cargando taxiboats");
    } finally {
      setTaxiboatLoading(false);
    }
  }

  async function runTaxiboatAction(
    boat: TaxiboatOperationRow["boat"],
    action: "MARK_AT_PLATFORM" | "DEPART_TO_BOOTH"
  ) {
    setActionBoat(`${boat}:${action}`);
    setTaxiboatError(null);

    try {
      const res = await fetch("/api/platform/taxiboat-operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boat, action }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadTaxiboatOps();
    } catch (e: unknown) {
      setTaxiboatError(e instanceof Error ? e.message : "Error actualizando taxiboat");
    } finally {
      setActionBoat(null);
    }
  }

  useEffect(() => {
    void loadTaxiboatOps();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={{ ...opsStyles.pageShell, width: "min(1480px, 100%)" }}>
      <section
        style={{
          ...opsStyles.heroCard,
          background:
            "radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%), radial-gradient(circle at right bottom, rgba(99, 102, 241, 0.16), transparent 24%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #312e81 100%)",
          color: "#e0e7ff",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#93c5fd" }}>
              Platform
            </div>
            <h1 style={opsStyles.heroTitle}>Operativa de plataforma</h1>
            <div style={{ fontSize: 14, color: "#c7d2fe" }}>
              Cola operativa, asignaciones, salidas, cierre de actividades e incidencias de flota en una sola vista.
            </div>
          </div>

          <div style={{ ...opsStyles.actionGrid, width: "min(100%, 340px)" }}>
            <Link href="/operations" style={ghostLink}>
              Centro operativo
            </Link>
            <Link href="/admin" style={ghostLink}>
              Admin
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {BOARD_OPTIONS.map((option) => {
            const active = option.key === selected;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option.key)}
                style={{
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "#111827" : "rgba(191, 219, 254, 0.25)"}`,
                  background: active ? "#fff" : "rgba(15, 23, 42, 0.26)",
                  color: active ? "#111827" : "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                {option.key === "JETSKI" ? "Jetski" : "Náutica"}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPillStyle}>Vista: {board.key === "JETSKI" ? "Jetski" : "Náutica"}</span>
          <span style={heroPillStyle}>Categorías: {board.categories.length}</span>
          <span style={heroPillStyle}>Taxiboats: {taxiboatOps.length}</span>
        </div>
      </section>

      {board.key === "NAUTICA" ? (
        <section
          style={{
            border: "1px solid #dbe4ea",
            borderRadius: 24,
            padding: "clamp(18px, 3vw, 24px)",
            background: "#fff",
            boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0369a1" }}>
                Taxiboat
              </div>
              <div style={{ fontSize: 24, fontWeight: 950, color: "#0f172a" }}>
                Retorno Platform {"->"} Booth
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Estado operativo por barco para que Booth sepa si ya salió de Platform.
              </div>
            </div>

            <button type="button" onClick={() => void loadTaxiboatOps()} style={refreshBtn}>
              Refrescar taxiboats
            </button>
          </div>

          {taxiboatError ? (
            <div style={taxiboatErrorStyle}>{taxiboatError}</div>
          ) : null}

          {taxiboatLoading ? (
            <div style={{ color: "#475569", fontWeight: 800 }}>Cargando taxiboats...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {taxiboatOps.map((row) => (
                <TaxiboatOpsCard
                  key={row.id}
                  row={row}
                  nowMs={nowMs}
                  busyAction={actionBoat}
                  onAction={runTaxiboatAction}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div>
        <PlatformBoard title={board.title} kind={board.kind} categories={board.categories} />
      </div>
    </div>
  );
}

function TaxiboatOpsCard({
  row,
  nowMs,
  busyAction,
  onAction,
}: {
  row: TaxiboatOperationRow;
  nowMs: number;
  busyAction: string | null;
  onAction: (
    boat: TaxiboatOperationRow["boat"],
    action: "MARK_AT_PLATFORM" | "DEPART_TO_BOOTH"
  ) => Promise<void>;
}) {
  const isToBooth = row.status === "TO_BOOTH";
  const isToPlatform = row.status === "TO_PLATFORM";
  const isAtBooth = row.status === "AT_BOOTH";
  const startedAt = isToPlatform
    ? row.departedBoothAt ?? row.updatedAt
    : row.departedPlatformAt ?? row.updatedAt;
  const startedMs = new Date(startedAt).getTime();
  const elapsedMin = Number.isFinite(startedMs)
    ? Math.max(0, Math.round((nowMs - startedMs) / 60000))
    : null;
  const colors = isToBooth
    ? { bg: "#fff7ed", bd: "#fed7aa", fg: "#b45309" }
    : isToPlatform
      ? { bg: "#eff6ff", bd: "#bfdbfe", fg: "#1d4ed8" }
    : isAtBooth
      ? { bg: "#f0fdf4", bd: "#bbf7d0", fg: "#166534" }
      : { bg: "#ecfeff", bd: "#a5f3fc", fg: "#155e75" };

  return (
    <div
      style={{
        border: `1px solid ${colors.bd}`,
        background: colors.bg,
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "center" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 950, color: "#0f172a" }}>
            {row.boat === "TAXIBOAT_1" ? "Taxiboat 1" : "Taxiboat 2"}
          </div>
          <div style={{ fontSize: 13, color: colors.fg, fontWeight: 900 }}>
            {isToBooth ? "En camino a Booth" : isToPlatform ? "En camino a Platform" : isAtBooth ? "En Booth" : "En plataforma"}
          </div>
        </div>

        <span
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: `1px solid ${colors.bd}`,
            background: "#fff",
            color: colors.fg,
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          {isToBooth ? "TO BOOTH" : isToPlatform ? "TO PLATFORM" : isAtBooth ? "AT BOOTH" : "AT PLATFORM"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div style={{ fontSize: 14, color: "#0f172a", fontWeight: 800 }}>
          {isToBooth
            ? `Salió hacia Booth hace ${elapsedMin ?? 0} min`
            : isToPlatform
              ? `Salió desde Booth hace ${elapsedMin ?? 0} min`
            : isAtBooth
              ? `Llegada a Booth: ${fmtDateTime(row.arrivedBoothAt ?? row.updatedAt)}`
              : `Última llegada a Platform: ${fmtDateTime(row.arrivedPlatformAt ?? row.updatedAt)}`}
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${colors.bd}`, background: "#fff", color: colors.fg, fontWeight: 900, fontSize: 13 }}>
          {isToBooth
            ? `Trayecto activo${elapsedMin != null ? ` · ${elapsedMin} min` : ""}`
            : isToPlatform
              ? `Llegando a Platform${elapsedMin != null ? ` · ${elapsedMin} min` : ""}`
              : isAtBooth
                ? "Barco en Booth"
                : "Listo en Platform"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <button
          type="button"
          onClick={() => void onAction(row.boat, "MARK_AT_PLATFORM")}
          disabled={busyAction !== null}
          style={{
            ...taxiboatActionBtn,
            opacity: busyAction !== null ? 0.6 : 1,
            width: "100%",
          }}
        >
          {busyAction === `${row.boat}:MARK_AT_PLATFORM` ? "Guardando..." : "En plataforma"}
        </button>
        <button
          type="button"
          onClick={() => void onAction(row.boat, "DEPART_TO_BOOTH")}
          disabled={busyAction !== null}
          style={{
            ...taxiboatPrimaryBtn,
            opacity: busyAction !== null ? 0.6 : 1,
            width: "100%",
          }}
        >
          {busyAction === `${row.boat}:DEPART_TO_BOOTH` ? "Guardando..." : "Salida a Booth"}
        </button>
      </div>
    </div>
  );
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

const ghostLink: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid rgba(191, 219, 254, 0.28)",
  background: "rgba(255,255,255,0.92)",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  textAlign: "center",
};

const heroPillStyle: React.CSSProperties = {
  ...opsStyles.heroPill,
  border: "1px solid rgba(125, 211, 252, 0.35)",
  background: "rgba(15, 23, 42, 0.24)",
};

const refreshBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
};

const taxiboatActionBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  cursor: "pointer",
};

const taxiboatPrimaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const taxiboatErrorStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: 12,
  fontWeight: 800,
};

