// src/app/booth/cash-closures/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Page, Card, Button, Input, Select, Alert, Stat, styles } from "@/components/ui";

type Summary = {
  ok: boolean;
  error?: string;
  computed?: {
    service?: { NET?: { byMethod?: Partial<Record<Method, number>> } };
    deposit?: { NET?: { byMethod?: Partial<Record<Method, number>> } };
    all?: { NET?: number };
    meta?: { windowFrom?: string | null; windowTo?: string | null };
  };
  isClosed?: boolean;
  closure?: { id: string; closedAt: string } | null;
};

type Method = "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";
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

function emptyMethodMapInputs() {
  return { CASH: "", CARD: "", BIZUM: "", TRANSFER: "", VOUCHER: "" } as Record<Method, string>;
}

function sumMethodMapCents(m: Record<Method, number>) {
  return METHODS.reduce((acc, k) => acc + Number(m[k] ?? 0), 0);
}

function sumInputsToCents(m: Record<Method, string>) {
  const out: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
  for (const k of METHODS) out[k] = centsFromEuroInput(m[k] ?? "");
  return out;
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} €`;
}

function hhmm(d?: string | Date | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
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

function diffTone(value: number) {
  if (value > 0) return { color: "#166534", background: "#dcfce7", border: "#86efac" };
  if (value < 0) return { color: "#991b1b", background: "#fee2e2", border: "#fca5a5" };
  return { color: "#1e293b", background: "#f8fafc", border: "#cbd5e1" };
}

const ZERO_INPUTS: Record<Method, string> = {
  CASH: "0,00",
  CARD: "0,00",
  BIZUM: "0,00",
  TRANSFER: "0,00",
  VOUCHER: "0,00",
};

function MethodKeyPill({ m }: { m: Method }) {
  const border =
    m === "CASH"
      ? "#e5e7eb"
      : m === "CARD"
      ? "#bae6fd"
      : m === "BIZUM"
      ? "#bbf7d0"
      : m === "TRANSFER"
      ? "#fde68a"
      : "#fecdd3";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: border }} />
      <span style={{ fontWeight: 900 }}>{m}</span>
      <span style={{ width: 1, height: 14, background: "#e5e7eb" }} />
    </span>
  );
}

export default function BoothCashClosuresPage() {
  const origin = "BOOTH" as const;

  const [shift, setShift] = useState<"MORNING" | "AFTERNOON">("MORNING");
  const [loading, setLoading] = useState(true);
  const [sum, setSum] = useState<Summary | null>(null);

  const [ssRows, setSsRows] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSs, setSelectedSs] = useState<string[]>([]);
  const [closing, setClosing] = useState(false);

  const [note, setNote] = useState<string>("");
  const [declService, setDeclService] = useState<Record<Method, string>>(emptyMethodMapInputs());
  const [declDeposit, setDeclDeposit] = useState<Record<Method, string>>(emptyMethodMapInputs());

  const [actionError, setActionError] = useState<string | null>(null);

  const today = useMemo(() => businessDateToday(), []);

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

  const systemDepositByMethod: Record<Method, number> = useMemo(() => {
    const m = sum?.computed?.deposit?.NET?.byMethod ?? {};
    return {
      CASH: m.CASH ?? 0,
      CARD: m.CARD ?? 0,
      BIZUM: m.BIZUM ?? 0,
      TRANSFER: m.TRANSFER ?? 0,
      VOUCHER: m.VOUCHER ?? 0,
    };
  }, [sum]);
  const systemDepositNet = useMemo(() => sumMethodMapCents(systemDepositByMethod), [systemDepositByMethod]);

  function fillDeclaredFromSystem() {
    setDeclService(mapInputsFromCents(systemServiceByMethod));
    setDeclDeposit(ZERO_INPUTS);
  }

  const declaredTotals = useMemo(() => {
    const service = sumInputsToCents(declService);
    const deposit = sumInputsToCents(declDeposit);

    const total: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
    for (const m of METHODS) total[m] = (service[m] ?? 0) + (deposit[m] ?? 0);

    const netService = sumMethodMapCents(service);
    const netDeposit = sumMethodMapCents(deposit);
    const netTotal = sumMethodMapCents(total);

    return { service, deposit, total, netService, netDeposit, netTotal };
  }, [declService, declDeposit]);

  const diffLive = useMemo(() => {
    const dService: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
    const dDeposit: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
    const dTotal: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };

    for (const m of METHODS) {
      dService[m] = (declaredTotals.service[m] ?? 0) - (systemServiceByMethod[m] ?? 0);
      dDeposit[m] = (declaredTotals.deposit[m] ?? 0) - (systemDepositByMethod[m] ?? 0);
      dTotal[m] = dService[m] + dDeposit[m];
    }

    const netService = sumMethodMapCents(dService);
    const netDeposit = sumMethodMapCents(dDeposit);
    const netTotal = sumMethodMapCents(dTotal);

    return { service: dService, deposit: dDeposit, total: dTotal, netService, netDeposit, netTotal };
  }, [declaredTotals, systemServiceByMethod, systemDepositByMethod]);

  async function load() {
    setLoading(true);
    setActionError(null);

    try {
      // ✅ Summary (mismo endpoint, pero pásale date para consistencia)
      const r = await fetch(`/api/store/cash-closures/summary?origin=${origin}&shift=${shift}&date=${today}`, {
        cache: "no-store",
      });

      // ✅ Shift sessions
      const ss = await fetch(`/api/cash-closures/shift-sessions?origin=${origin}&shift=${shift}&date=${today}`, {
        cache: "no-store",
      });

      if (ss.ok) {
        const j = await ss.json();
        const rows: Array<{ id: string; label: string }> = j.rows ?? [];
        setSsRows(rows);
        setSelectedSs((prev) => {
          if (prev?.length) return prev;
          return rows.slice(0, 4).map((x) => x.id);
        });
      } else {
        setSsRows([]);
        setSelectedSs([]);
      }

      if (!r.ok) {
        setSum({ ok: false, error: await r.text() });
      } else {
        const j = await r.json();
        setSum(j);

        // auto prefill 1ª vez
        const untouched =
          (
            declService.CASH +
            declService.CARD +
            declService.BIZUM +
            declService.TRANSFER +
            declService.VOUCHER
          ).trim() === "" &&
          (
            declDeposit.CASH +
            declDeposit.CARD +
            declDeposit.BIZUM +
            declDeposit.TRANSFER +
            declDeposit.VOUCHER
          ).trim() === "";
        if (untouched) {
          const mS = j?.computed?.service?.NET?.byMethod ?? {};
          setDeclService(mapInputsFromCents({
            CASH: mS.CASH ?? 0,
            CARD: mS.CARD ?? 0,
            BIZUM: mS.BIZUM ?? 0,
            TRANSFER: mS.TRANSFER ?? 0,
            VOUCHER: mS.VOUCHER ?? 0,
          }));
          setDeclDeposit(ZERO_INPUTS);
        }
      }
    } catch (e: unknown) {
      setSum({ ok: false, error: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoading(false);
    }
  }

  const systemNet = useMemo(() => Number(sum?.computed?.all?.NET ?? 0), [sum]);

  async function closeCash() {
    if (!sum?.ok) return;

    if (selectedSs.length < 1 || selectedSs.length > 4) {
      alert("Selecciona entre 1 y 4 usuarios del turno.");
      return;
    }

    setClosing(true);
    setActionError(null);

    try {
      const body = {
        origin,
        shift,
        date: today,
        shiftSessionIds: selectedSs,
        declared: declaredTotals,
        note: note.trim() ? note.trim() : null,
      };

      const r = await fetch("/api/store/cash-closures/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const ct = r.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? (await r.json().catch(() => null))?.error
          : await r.text();
        throw new Error((msg || "Error cerrando caja").toString().slice(0, 300));
      }

      await load();
      alert("✅ Caja cerrada.");
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Error cerrando caja");
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  const windowFrom = sum?.computed?.meta?.windowFrom;
  const windowTo = sum?.computed?.meta?.windowTo;
  const isClosed = Boolean(sum?.isClosed);
  const diffNetTone = diffTone(diffLive.netTotal);

  const headerRight = (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <Select value={shift} onChange={(e) => setShift(e.target.value as "MORNING" | "AFTERNOON")}>
        <option value="MORNING">Mañana</option>
        <option value="AFTERNOON">Tarde</option>
      </Select>
      <Button onClick={load}>Refrescar</Button>
    </div>
  );

  return (
    <Page title="Carpa · Cierre de caja" right={headerRight}>
      {actionError ? <Alert kind="error">{actionError}</Alert> : null}

      <Card>
        <div style={{ display: "grid", gap: 18 }}>
          <div
            style={{
              display: "grid",
              gap: 16,
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
                  "radial-gradient(circle at top left, rgba(134, 239, 172, 0.2), transparent 34%), linear-gradient(135deg, #082f49 0%, #0f766e 50%, #052e2b 100%)",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#a7f3d0" }}>
                    Operativa de punto
                  </span>
                  <div style={{ fontSize: 28, fontWeight: 950, color: "#fff", lineHeight: 1.05 }}>Cierre de carpa</div>
                  <div style={{ fontSize: 14, color: "#d1fae5", maxWidth: 620 }}>
                    Consolida cobros de servicio y fianza del turno, verifica participantes y registra el cierre operativo.
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${isClosed ? "#86efac" : "#5eead4"}`,
                    background: isClosed ? "rgba(22, 101, 52, 0.18)" : "rgba(45, 212, 191, 0.16)",
                    fontWeight: 900,
                    color: "#fff",
                  }}
                >
                  {isClosed ? "Cerrado" : "Abierto"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                  Origin: {origin}
                </span>
                <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                  Fecha: {today}
                </span>
                <span style={{ ...styles.pill, background: "rgba(15, 23, 42, 0.2)", border: "1px solid rgba(148, 163, 184, 0.3)", color: "#fff" }}>
                  Ventana: {sum?.ok ? `${hhmm(windowFrom)}-${hhmm(windowTo)}` : "--"}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <Stat label="Sistema neto" value={euros(systemNet)} />
              <Stat label="Declarado neto" value={euros(declaredTotals.netTotal)} />
              <div
                style={{
                  border: `1px solid ${diffNetTone.border}`,
                  borderRadius: 16,
                  padding: 14,
                  background: diffNetTone.background,
                  color: diffNetTone.color,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Diferencia neta</div>
                <div style={{ fontSize: 22, fontWeight: 950 }}>{euros(diffLive.netTotal)}</div>
              </div>
            </div>
          </div>

          <div style={styles.grid3}>
            <Stat label="Servicio sistema" value={euros(sumMethodMapCents(systemServiceByMethod))} />
            <Stat label="Fianza sistema" value={euros(systemDepositNet)} />
            <Stat label="Participantes" value={ssRows.length} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Alert kind="info">Cargando…</Alert>
      ) : !sum?.ok ? (
        <Alert kind="error">Error: {sum?.error ?? "No se pudo cargar summary"}</Alert>
      ) : (
        <Card
          title={
            <span>
              Cierre de caja ({origin} · {shift}) · Estado: <b>{isClosed ? "CERRADO" : "ABIERTO"}</b>
            </span>
          }
          right={
            <Button variant="primary" onClick={closeCash} disabled={closing || isClosed}>
              {isClosed ? "Caja cerrada" : closing ? "Cerrando..." : "Cerrar caja"}
            </Button>
          }
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 950, fontSize: 15 }}>Conteo declarado</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Precarga el declarado a partir del resumen del turno. En carpa la fianza no aplica y queda fuera del conteo.
              </div>
            </div>
            <Button onClick={fillDeclaredFromSystem}>Traer datos del sistema</Button>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 950 }}>Servicio</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>en € (con coma)</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {VISIBLE_METHODS.map((m) => (
                  <label key={m} style={{ display: "grid", gap: 6, padding: 12, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      <MethodKeyPill m={m} />
                    </div>
                    <Input
                      value={declService[m]}
                      onChange={(e) => setDeclService((s) => ({ ...s, [m]: e.target.value }))}
                      placeholder="0,00"
                    />
                  </label>
                ))}
              </div>
            </div>

            <Alert kind={systemDepositNet === 0 ? "info" : "error"}>
              {systemDepositNet === 0
                ? "Fianza no aplica en carpa. Este cierre trabaja solo sobre servicio."
                : `Se han detectado ${euros(systemDepositNet)} en fianza dentro del sistema. El cierre visual de carpa no la declara y conviene revisar esos pagos.`}
            </Alert>

            <div style={styles.grid3}>
              <Stat label="Sistema neto" value={euros(systemNet)} />
              <Stat label="Declarado neto" value={euros(declaredTotals.netTotal)} />
              <Stat label="Diferencia neta" value={euros(diffLive.netTotal)} />
            </div>

            <div style={styles.hr} />

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 950 }}>Participantes (1–4)</div>

              <div style={{ display: "grid", gap: 8 }}>
                {ssRows.map((s) => {
                  const checked = selectedSs.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        border: `1px solid ${checked ? "#99f6e4" : "#e2e8f0"}`,
                        borderRadius: 16,
                        background: checked ? "#f0fdfa" : "white",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? Array.from(new Set([...selectedSs, s.id]))
                            : selectedSs.filter((x) => x !== s.id);
                          if (next.length > 4) return;
                          setSelectedSs(next);
                        }}
                      />
                      <div style={{ fontWeight: 900 }}>{s.label}</div>
                    </label>
                  );
                })}

                {ssRows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay sesiones de turno detectadas.</div> : null}
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Nota (opcional)</div>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observaciones del cierre" />
              </label>

              <Button variant="primary" onClick={closeCash} disabled={closing || isClosed}>
                {isClosed ? "Caja cerrada" : closing ? "Cerrando..." : "Cerrar caja"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}
