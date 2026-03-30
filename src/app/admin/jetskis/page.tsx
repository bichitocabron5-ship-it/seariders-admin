// src/app/admin/jetskis/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { JetskiRow, JetskiStatus } from "../types";

const JETSKI_STATUSES: JetskiStatus[] = ["OPERATIONAL", "OUT_OF_SERVICE", "RETIRED"];

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminJetskisPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<JetskiRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | JetskiStatus>("");

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JetskiRow | null>(null);

  const filteredParams = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    return p.toString();
  }, [q, status]);

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/jetskis?${filteredParams}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRows(json.jetskis ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [filteredParams]);

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(r: JetskiRow) {
    setEditing(r);
    setOpen(true);
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      operational: rows.filter((row) => row.status === "OPERATIONAL").length,
      retired: rows.filter((row) => row.status === "RETIRED").length,
    };
  }, [rows]);

  return (
    <div style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Flota</div>
          <div style={titleStyle}>Jetskis</div>
          <div style={subtitleStyle}>
            Alta/baja, matrícula, bastidor, pax máx, modelo, año y estado operativo.
          </div>
        </div>

        <div style={opsStyles.actionGrid}>
          <Link href="/admin" style={ghostBtn}>
            Volver a Admin
          </Link>
          <button
            type="button"
            onClick={() => load({ showLoading: true })}
            style={ghostButtonElement}
          >
            Refrescar
          </button>

          <button
            type="button"
            onClick={openCreate}
            style={darkBtn}
          >
            + Nueva jetski
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <article style={summaryCard}>
          <div style={summaryLabel}>Jetskis</div>
          <div style={summaryValue}>{stats.total}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Operativas</div>
          <div style={summaryValue}>{stats.operational}</div>
        </article>
        <article style={summaryCard}>
          <div style={summaryLabel}>Retiradas</div>
          <div style={summaryValue}>{stats.retired}</div>
        </article>
      </section>

      {/* Filtros */}
      <div style={panelStyle}>
        <div style={{ fontWeight: 950 }}>Filtros</div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Buscar (número, modelo, matrícula, bastidor)
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: 12, VX, 1234ABC..."
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "" | JetskiStatus)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              <option value="">Todos</option>
              {JETSKI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={() => load({ showLoading: true })}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            Aplicar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div style={panelStyle}>
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontWeight: 950 }}>Jetskis</div>
          <div style={{ fontWeight: 900, opacity: 0.8 }}>{rows.length}</div>
        </div>

        <div style={{ padding: 12 }}>
          {loading ? <div style={{ opacity: 0.7 }}>Cargando...</div> : null}
          {error ? (
            <div
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                fontWeight: 900,
              }}
            >
              {error}
            </div>
          ) : null}

          {!loading && rows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay jetskis.</div> : null}

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openEdit(r)}
                style={{
                  textAlign: "left",
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 12,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>
                      Moto {r.number ?? "—"}
                    </div>

                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        fontWeight: 900,
                        fontSize: 12,
                        background: r.status === "OPERATIONAL" ? "#ecfeff" : "#fafafa",
                      }}
                    >
                      {r.status}
                    </div>

                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {r.model ? r.model : "Modelo —"} {r.year ? `· ${r.year}` : ""} {r.plate ? `· ${r.plate}` : ""}
                      {r.chassisNumber ? ` · Bastidor: ${r.chassisNumber}` : ""}
                      {r.maxPax ? ` · Pax máx: ${r.maxPax}` : ""}
                      {r.owner ? ` · ${r.owner}` : ""}
                    </div>

                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                      Horas: {r.currentHours ?? "—"} · Último service: {r.lastServiceHours ?? "—"} · Intervalo: {r.serviceIntervalHours}h · Aviso: {r.serviceWarnHours}h
                    </div>
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Actualizado: <b>{fmtDateTime(r.updatedAt)}</b>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {open ? (
        <JetskiModal
          initial={editing}
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

const pageStyle: CSSProperties = {
  ...opsStyles.pageShell,
  width: "min(1200px, 100%)",
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(99, 102, 241, 0.08), transparent 34%), radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 30%)",
};

const heroStyle: CSSProperties = {
  ...opsStyles.heroCard,
  borderRadius: 26,
  padding: 20,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 48%, #eef2ff 100%)",
  display: "grid",
  gap: 18,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#4338ca",
};

const titleStyle: CSSProperties = {
  ...opsStyles.heroTitle,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  lineHeight: 1,
  color: "#0f172a",
};

const subtitleStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "#475569",
  maxWidth: 760,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const summaryCard: CSSProperties = {
  ...opsStyles.metricCard,
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
  ...opsStyles.sectionCard,
  borderRadius: 18,
  padding: 12,
};

const ghostBtn: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  fontWeight: 900,
  textDecoration: "none",
  color: "#0f172a",
};

const ghostButtonElement: CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  fontWeight: 900,
};

const darkBtn: CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 950,
};

function JetskiModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: JetskiRow | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const isEdit = !!initial;

  const [number, setNumber] = useState(initial?.number != null ? String(initial.number) : "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [chassisNumber, setChassisNumber] = useState(initial?.chassisNumber ?? "");
  const [status, setStatus] = useState<JetskiStatus>(initial?.status ?? "OPERATIONAL");
  const [owner, setOwner] = useState(initial?.owner ?? "");
  const [maxPax, setMaxPax] = useState(initial?.maxPax != null ? String(initial.maxPax) : "");
  const [currentHours, setCurrentHours] = useState(
    initial?.currentHours != null ? String(initial.currentHours) : "");
  const [lastServiceHours, setLastServiceHours] = useState(
    initial?.lastServiceHours != null ? String(initial.lastServiceHours) : "");
  const [serviceIntervalHours, setServiceIntervalHours] = useState(
    initial?.serviceIntervalHours != null ? String(initial.serviceIntervalHours) : "85");
  const [serviceWarnHours, setServiceWarnHours] = useState(
    initial?.serviceWarnHours != null ? String(initial.serviceWarnHours) : "70");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    const cur = currentHours.trim() ? Number(currentHours.trim()) : null;
    if (cur !== null && (!Number.isFinite(cur) || cur < 0)) return setError("Horas actuales inválidas.");

    const last = lastServiceHours.trim() ? Number(lastServiceHours.trim()) : null;
    if (last !== null && (!Number.isFinite(last) || last < 0)) return setError("Horas último service inválidas.");

    const interval = Number(serviceIntervalHours.trim());
    if (!Number.isFinite(interval) || interval <= 0) return setError("Intervalo de service inválido.");

    const warn = Number(serviceWarnHours.trim());
    if (!Number.isFinite(warn) || warn <= 0) return setError("Aviso de service inválido.");
    if (warn > interval) return setError("Aviso no puede ser mayor que el intervalo.");

    const n = number.trim() ? Number(number.trim()) : null;
    if (n === null || !Number.isFinite(n) || n <= 0) return setError("Número de moto obligatorio (entero > 0).");

    const yearNum = year.trim() ? Number(year.trim()) : null;
    if (yearNum !== null && (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > 2100)) {
      return setError("Año inválido.");
    }
    const maxPaxNum = maxPax.trim() ? Number(maxPax.trim()) : null;
    if (maxPaxNum !== null && (!Number.isInteger(maxPaxNum) || maxPaxNum < 1 || maxPaxNum > 50)) {
      return setError("Pax máx inválido.");
    }

    setBusy(true);
    try {
      const body = {
        number: n,
        model: model.trim() ? model.trim() : null,
        year: yearNum,
        plate: plate.trim() ? plate.trim() : null,
        chassisNumber: chassisNumber.trim() ? chassisNumber.trim() : null,
        owner: owner.trim() ? owner.trim() : null,
        maxPax: maxPaxNum,
        status,

        currentHours: cur,
        lastServiceHours: last,
        serviceIntervalHours: interval,
        serviceWarnHours: warn,
        };

      const targetUrl = isEdit
        ? `/api/admin/jetskis/${encodeURIComponent(initial!.id)}`
        : `/api/admin/jetskis`;
      const res = await fetch(targetUrl, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());

      await onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
      onClick={() => (busy ? null : onClose())}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          padding: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{isEdit ? "Editar jetski" : "Nueva jetski"}</div>
          <button
            type="button"
            onClick={() => (busy ? null : onClose())}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              borderRadius: 10,
              padding: "6px 10px",
              fontWeight: 900,
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Número
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ej: 12"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Estado
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JetskiStatus)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            >
              {JETSKI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Modelo (opcional)
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej: Yamaha VX"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Año (opcional)
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2022"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, gridColumn: "1 / -1" }}>
            Matrícula / placa (opcional)
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="Ej: 1234ABC"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Nº bastidor (opcional)
            <input
              value={chassisNumber}
              onChange={(e) => setChassisNumber(e.target.value)}
              placeholder="Ej: CA-YDV03847G425"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Pax máx (opcional)
            <input
              value={maxPax}
              onChange={(e) => setMaxPax(e.target.value)}
              placeholder="Ej: 2"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Propietario (opcional)
            <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Ej: SeaRiders / Renting / Particular..."
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            </label>

            <div style={{ gridColumn: "1 / -1", marginTop: 6, fontWeight: 950 }}>
            Mecánica
            </div>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Horas actuales (opcional)
            <input
                value={currentHours}
                onChange={(e) => setCurrentHours(e.target.value)}
                placeholder="Ej: 123.5"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Horas último service (opcional)
            <input
                value={lastServiceHours}
                onChange={(e) => setLastServiceHours(e.target.value)}
                placeholder="Ej: 100"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Intervalo service (h)
            <input
                value={serviceIntervalHours}
                onChange={(e) => setServiceIntervalHours(e.target.value)}
                placeholder="85"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            </label>

            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Aviso service (h)
            <input
                value={serviceWarnHours}
                onChange={(e) => setServiceWarnHours(e.target.value)}
                placeholder="70"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            </label>
        </div>



        {error ? (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              fontWeight: 900,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: busy ? "#9ca3af" : "#111",
              color: "#fff",
              fontWeight: 950,
            }}
          >
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}


