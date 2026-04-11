"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Page, Stat, styles } from "@/components/ui";
import { getBarCashSummary, getBarShiftSessions } from "../services/bar";

type Method = "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";
type Shift = "MORNING" | "AFTERNOON";

type Summary = {
  ok: boolean;
  error?: string;
  computed?: {
    service?: { NET?: { byMethod?: Partial<Record<Method, number>> } };
    all?: { NET?: number };
    meta?: { windowFrom?: string | null; windowTo?: string | null };
  };
  isClosed?: boolean;
  closure?: { id: string; closedAt: string } | null;
};

const METHODS: Method[] = ["CASH", "CARD", "BIZUM", "TRANSFER", "VOUCHER"];
const VISIBLE_METHODS: Method[] = ["CASH", "CARD", "BIZUM", "TRANSFER"];

function businessDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function centsFromEuroInput(s: string) {
  const n = Number((s ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function euroInputFromCents(c: number) {
  return ((Number(c ?? 0) / 100).toFixed(2)).replace(".", ",");
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} EUR`;
}

function hhmm(d?: string | Date | null) {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function emptyMethodMapInputs() {
  return { CASH: "", CARD: "", BIZUM: "", TRANSFER: "", VOUCHER: "" } as Record<Method, string>;
}

function mapInputsFromCents(m: Record<Method, number>) {
  return {
    CASH: euroInputFromCents(m.CASH ?? 0),
    CARD: euroInputFromCents(m.CARD ?? 0),
    BIZUM: euroInputFromCents(m.BIZUM ?? 0),
    TRANSFER: euroInputFromCents(m.TRANSFER ?? 0),
    VOUCHER: euroInputFromCents(m.VOUCHER ?? 0),
  };
}

function sumInputsToCents(m: Record<Method, string>) {
  const out: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
  for (const key of METHODS) out[key] = centsFromEuroInput(m[key] ?? "");
  return out;
}

function sumMethodMapCents(m: Record<Method, number>) {
  return METHODS.reduce((acc, key) => acc + Number(m[key] ?? 0), 0);
}

function diffTone(value: number) {
  if (value > 0) return { color: "#166534", background: "#dcfce7", border: "#86efac" };
  if (value < 0) return { color: "#991b1b", background: "#fee2e2", border: "#fca5a5" };
  return { color: "#1e293b", background: "#f8fafc", border: "#cbd5e1" };
}

function methodLabel(method: Method) {
  switch (method) {
    case "CASH":
      return "Efectivo";
    case "CARD":
      return "Tarjeta";
    case "BIZUM":
      return "Bizum";
    case "TRANSFER":
      return "Transferencia";
    default:
      return "Vale";
  }
}

export default function BarCashClosuresPage() {
  const origin = "BAR" as const;
  const today = useMemo(() => businessDateToday(), []);

  const shift: Shift = "MORNING";
  const [loading, setLoading] = useState(true);
  const [sum, setSum] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [ssRows, setSsRows] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSs, setSelectedSs] = useState<string[]>([]);
  const [declService, setDeclService] = useState<Record<Method, string>>(emptyMethodMapInputs());
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);

  const systemServiceByMethod: Record<Method, number> = useMemo(() => {
    const m = sum?.computed?.service?.NET?.byMethod ?? {};
    return {
      CASH: m.CASH ?? 0,
      CARD: m.CARD ?? 0,
      BIZUM: m.BIZUM ?? 0,
      TRANSFER: m.TRANSFER ?? 0,
      VOUCHER: m.VOUCHER ?? 0,
    };
  }, [sum]);

  const declaredTotals = useMemo(() => {
    const service = sumInputsToCents(declService);
    const deposit: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
    const total = { ...service };

    return {
      service,
      deposit,
      total,
      netService: sumMethodMapCents(service),
      netDeposit: 0,
      netTotal: sumMethodMapCents(total),
    };
  }, [declService]);

  const diffLive = useMemo(() => {
    const service: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
    for (const key of METHODS) service[key] = (declaredTotals.service[key] ?? 0) - (systemServiceByMethod[key] ?? 0);
    return {
      service,
      netService: sumMethodMapCents(service),
    };
  }, [declaredTotals, systemServiceByMethod]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [summaryData, sessionsData] = await Promise.all([
        getBarCashSummary({ date: today, shift }),
        getBarShiftSessions({ date: today, shift }),
      ]);

      setSum(summaryData);

      const rows: Array<{ id: string; label: string }> = sessionsData.rows ?? [];
      setSsRows(rows);
      setSelectedSs((prev) => {
        const availableIds = new Set(rows.map((row) => row.id));
        const stillValid = prev.filter((id) => availableIds.has(id));
        if (stillValid.length) return stillValid;
        return rows.slice(0, 4).map((row) => row.id);
      });

      const untouched = VISIBLE_METHODS.every((key) => (declService[key] ?? "").trim() === "");
      if (untouched) {
        const m = summaryData?.computed?.service?.NET?.byMethod ?? {};
        setDeclService(
          mapInputsFromCents({
            CASH: m.CASH ?? 0,
            CARD: m.CARD ?? 0,
            BIZUM: m.BIZUM ?? 0,
            TRANSFER: m.TRANSFER ?? 0,
            VOUCHER: m.VOUCHER ?? 0,
          })
        );
      }
    } catch (e: unknown) {
      setSum(null);
      setSsRows([]);
      setError(e instanceof Error ? e.message : "Error cargando cierre");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  async function closeCash() {
    if (!sum?.ok) return;

    if (selectedSs.length < 1 || selectedSs.length > 4) {
      setError("Selecciona entre 1 y 4 usuarios del turno.");
      return;
    }

    try {
      setClosing(true);
      setError(null);

      const res = await fetch("/api/store/cash-closures/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          shift,
          date: today,
          shiftSessionIds: selectedSs,
          declared: declaredTotals,
          note,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar caja");
    } finally {
      setClosing(false);
    }
  }

  function toggleShiftSession(id: string) {
    setSelectedSs((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  const headerRight = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...styles.pill, background: "#fff", border: "1px solid #dbe4ea", color: "#0f172a" }}>
        Cierre diario
      </span>
      <Link href="/admin/cash-closures?origin=BAR" style={{ ...styles.btn, textDecoration: "none" }}>
        Ver en admin
      </Link>
      <Button onClick={() => void load()}>Refrescar</Button>
    </div>
  );

  return (
    <Page title="Bar - Cierre de caja" right={headerRight}>
      {error ? <Alert kind="error">{error}</Alert> : null}

      <Card>
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              borderRadius: 24,
              padding: 22,
              color: "#e2e8f0",
              background:
                "radial-gradient(circle at top left, rgba(134, 239, 172, 0.18), transparent 34%), linear-gradient(135deg, #052e2b 0%, #0f766e 50%, #082f49 100%)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "#a7f3d0",
                }}
              >
                Cierre operativo
              </span>
              <div style={{ fontSize: 28, fontWeight: 950, color: "#fff", lineHeight: 1.05 }}>
                Caja BAR
              </div>
              <div style={{ fontSize: 14, color: "#d1fae5", maxWidth: 620 }}>
                Revisión del turno, declaración por método y cierre final del punto BAR.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Fecha: {today}
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Alcance: día completo
              </span>
              <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                Estado: {sum?.isClosed ? "Cerrado" : "Abierto"}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <Stat label="Sistema neto" value={euros(Number(sum?.computed?.all?.NET ?? 0))} />
            <Stat label="Declarado" value={euros(declaredTotals.netTotal)} />
            <Stat label="Diferencia viva" value={euros(diffLive.netService)} />
          </div>
        </div>
      </Card>

      {sum?.isClosed ? (
        <Alert kind="info">
          Este turno ya está cerrado. Puedes revisarlo en <Link href="/admin/cash-closures?origin=BAR">admin/cash-closures</Link>.
        </Alert>
      ) : null}

      <Card title="Contexto del turno">
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Stat label="Fecha operativa" value={today} />
          <Stat
            label="Ventana"
            value={
              sum?.computed?.meta
                ? `${hhmm(sum.computed.meta.windowFrom)} - ${hhmm(sum.computed.meta.windowTo)}`
                : "-"
            }
          />
          <Stat label="Usuarios seleccionados" value={selectedSs.length} />
        </div>
      </Card>

      <Card title="Personal del cierre" right={<div style={{ fontSize: 12, color: "#64748b" }}>Selecciona entre 1 y 4 personas del turno BAR</div>}>
        {loading ? (
          <div>Cargando...</div>
        ) : ssRows.length === 0 ? (
          <Alert kind="info">No hay sesiones de turno BAR para esta fecha y turno.</Alert>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {ssRows.map((row) => (
              <label
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: selectedSs.includes(row.id) ? "#eff6ff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSs.includes(row.id)}
                  onChange={() => toggleShiftSession(row.id)}
                />
                <span style={{ fontWeight: 700 }}>{row.label}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card title="Importes declarados">
        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 14,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 160px) minmax(140px, 1fr) minmax(110px, 140px) minmax(110px, 140px)",
              gap: 12,
              alignItems: "center",
              fontSize: 12,
              fontWeight: 900,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <div>Metodo</div>
            <div>Declarado</div>
            <div>Sistema</div>
            <div>Diferencia</div>
          </div>
          {VISIBLE_METHODS.map((method) => {
            const diff = diffLive.service[method] ?? 0;
            const tone = diffTone(diff);
            return (
              <div
                key={method}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(120px, 160px) minmax(140px, 1fr) minmax(110px, 140px) minmax(110px, 140px)",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 900 }}>{methodLabel(method)}</div>
                <Input
                  value={declService[method]}
                  onChange={(e) =>
                    setDeclService((prev) => ({
                      ...prev,
                      [method]: e.target.value,
                    }))
                  }
                  placeholder="0,00"
                />
                <div style={{ color: "#475569" }}>{euros(systemServiceByMethod[method] ?? 0)}</div>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${tone.border}`,
                    background: tone.background,
                    color: tone.color,
                    fontWeight: 900,
                  }}
                >
                  {euros(diff)}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Stat label="Sistema servicio" value={euros(sumMethodMapCents(systemServiceByMethod))} />
          <Stat label="Declarado servicio" value={euros(declaredTotals.netService)} />
          <Stat label="Diferencia" value={euros(diffLive.netService)} />
        </div>

        <div style={{ marginTop: 16 }}>
          <Button onClick={() => setDeclService(mapInputsFromCents(systemServiceByMethod))}>
            Copiar importes del sistema
          </Button>
        </div>
      </Card>

      <Card title="Cierre">
        <div
          style={{
            display: "grid",
            gap: 12,
            padding: 14,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota de cierre (opcional)" />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => void closeCash()} disabled={closing || Boolean(sum?.isClosed)}>
              {closing ? "Cerrando..." : "Cerrar caja"}
            </Button>
            <Link href="/admin/cash-closures?origin=BAR" style={{ ...styles.btn, textDecoration: "none" }}>
              Ir a admin/cash-closures
            </Link>
          </div>
        </div>
      </Card>
    </Page>
  );
}
