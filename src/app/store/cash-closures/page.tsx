// src/app/store/cash-closures/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import { StoreHero, StoreMetricCard, StoreMetricGrid } from "@/components/store-ui";
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
  closure?: { id: string; closedAt: string; isVoided?: boolean } | null;
};

type Method = "CASH" | "CARD" | "BIZUM" | "TRANSFER" | "VOUCHER";
const METHODS: Method[] = ["CASH", "CARD", "BIZUM", "TRANSFER", "VOUCHER"];

function businessDateToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} €`;
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

function sumInputsToCents(m: Record<Method, string>) {
  const out: Record<Method, number> = { CASH: 0, CARD: 0, BIZUM: 0, TRANSFER: 0, VOUCHER: 0 };
  for (const k of METHODS) out[k] = centsFromEuroInput(m[k] ?? "");
  return out;
}

function sumMethodMapCents(m: Record<Method, number>) {
  return METHODS.reduce((acc, k) => acc + Number(m[k] ?? 0), 0);
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

export default function StoreCashClosuresPage() {
  const origin = "STORE" as const;

  const [shift, setShift] = useState<"MORNING" | "AFTERNOON">("MORNING");

  const [loading, setLoading] = useState(true);
  const [sum, setSum] = useState<Summary | null>(null);

  const [ssRows, setSsRows] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedSs, setSelectedSs] = useState<string[]>([]);

  const [declService, setDeclService] = useState<Record<Method, string>>(emptyMethodMapInputs());
  const [declDeposit, setDeclDeposit] = useState<Record<Method, string>>(emptyMethodMapInputs());

  const [note, setNote] = useState<string>("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const systemNet = useMemo(() => Number(sum?.computed?.all?.NET ?? 0), [sum]);

  function fillDeclaredFromSystem() {
    setDeclService(mapInputsFromCents(systemServiceByMethod));
    setDeclDeposit(mapInputsFromCents(systemDepositByMethod));
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
    setError(null);

    try {
      const r = await fetch(`/api/store/cash-closures/summary?origin=${origin}&shift=${shift}&date=${today}`, {
        cache: "no-store",
      });

      if (!r.ok) {
        setSum({ ok: false, error: await r.text() });
      } else {
        const j = await r.json();
        setSum(j);

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
          const mD = j?.computed?.deposit?.NET?.byMethod ?? {};
          setDeclService(mapInputsFromCents({
            CASH: mS.CASH ?? 0,
            CARD: mS.CARD ?? 0,
            BIZUM: mS.BIZUM ?? 0,
            TRANSFER: mS.TRANSFER ?? 0,
            VOUCHER: mS.VOUCHER ?? 0,
          }));
          setDeclDeposit(mapInputsFromCents({
            CASH: mD.CASH ?? 0,
            CARD: mD.CARD ?? 0,
            BIZUM: mD.BIZUM ?? 0,
            TRANSFER: mD.TRANSFER ?? 0,
            VOUCHER: mD.VOUCHER ?? 0,
          }));
        }
      }

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
      }
    } catch (e: unknown) {
      setSum({ ok: false, error: e instanceof Error ? e.message : "Error desconocido" });
    } finally {
      setLoading(false);
    }
  }

  async function closeCash() {
    if (!sum?.ok) return;

    if (selectedSs.length < 1 || selectedSs.length > 4) {
      alert("Selecciona entre 1 y 4 usuarios del turno.");
      return;
    }

    setClosing(true);
    setError(null);

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

      if (!r.ok) throw new Error(await r.text());

      await load();
      alert("✅ Caja cerrada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cerrando caja");
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
    <div style={opsStyles.actionGrid}>
      <Select value={shift} onChange={(e) => setShift(e.target.value as "MORNING" | "AFTERNOON")}>
        <option value="MORNING">Mañana</option>
        <option value="AFTERNOON">Tarde</option>
      </Select>
      <Button onClick={load}>Refrescar</Button>
    </div>
  );

  return (
    <Page
      title="Tienda · Cierre de caja"
      right={headerRight}
    >
      {error ? <Alert kind="error">{error}</Alert> : null}

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
            <StoreHero
              eyebrow="Operativa diaria"
              title="Cierre de tienda"
              description="Revisa importes del sistema, completa el declarado y cierra el turno con los participantes correctos."
              titleColor="#fff"
              eyebrowColor="#7dd3fc"
              background="radial-gradient(circle at top left, rgba(125, 211, 252, 0.24), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0b1120 100%)"
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${isClosed ? "#86efac" : "#38bdf8"}`,
                    background: isClosed ? "rgba(22, 101, 52, 0.18)" : "rgba(14, 165, 233, 0.16)",
                    fontWeight: 900,
                    color: "#fff",
                  }}
                >
                  {isClosed ? "Cerrado" : "Abierto"}
                </div>
                <span style={{ ...opsStyles.heroPill, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(148, 163, 184, 0.35)", color: "#fff" }}>
                  Origen: {origin}
                </span>
                <span style={{ ...opsStyles.heroPill, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(148, 163, 184, 0.35)", color: "#fff" }}>
                  Fecha: {today}
                </span>
                <span style={{ ...opsStyles.heroPill, background: "rgba(15, 23, 42, 0.24)", border: "1px solid rgba(148, 163, 184, 0.35)", color: "#fff" }}>
                  Ventana: {sum?.ok ? `${hhmm(windowFrom)}-${hhmm(windowTo)}` : "--"}
                </span>
              </div>
            </StoreHero>

            <div style={{ display: "grid", gap: 12 }}>
              <StoreMetricCard label="Sistema neto" value={euros(systemNet)} />
              <StoreMetricCard label="Declarado neto" value={euros(declaredTotals.netTotal)} />
              <StoreMetricCard
                label="Diferencia neta"
                value={euros(diffLive.netTotal)}
                accentColor={diffNetTone.color}
                valueColor={diffNetTone.color}
              >
                <div
                  style={{
                    marginTop: 4,
                    padding: "6px 10px",
                    borderRadius: 999,
                    width: "fit-content",
                    border: `1px solid ${diffNetTone.border}`,
                    background: diffNetTone.background,
                  }}
                >
                  Declarado - sistema
                </div>
              </StoreMetricCard>
            </div>
          </div>

          <StoreMetricGrid>
            <StoreMetricCard label="Servicio sistema" value={euros(sumMethodMapCents(systemServiceByMethod))} />
            <StoreMetricCard label="Fianza sistema" value={euros(sumMethodMapCents(systemDepositByMethod))} />
            <StoreMetricCard label="Participantes" value={ssRows.length} />
          </StoreMetricGrid>
        </div>
      </Card>

      {loading ? (
        <Alert kind="info">Cargando…</Alert>
      ) : !sum?.ok ? (
        <Alert kind="error">Error: {sum?.error ?? "No se pudo cargar el resumen"}</Alert>
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
                Usa el resumen calculado del sistema para precargar el declarado y ajustar solo lo necesario.
              </div>
            </div>
            <Button onClick={fillDeclaredFromSystem}>Traer datos del sistema</Button>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ ...opsStyles.sectionCard, borderRadius: 18, padding: 16, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 950 }}>Servicio</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>en € (con coma)</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
                {METHODS.map((m) => (
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

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Sistema servicio neto: <b>{euros(sumMethodMapCents(systemServiceByMethod))}</b> · Declarado servicio neto:{" "}
                <b>{euros(declaredTotals.netService)}</b>
              </div>
            </div>

            <div style={{ ...opsStyles.sectionCard, borderRadius: 18, padding: 16, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 950 }}>Fianza</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>en € (con coma)</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 }}>
                {METHODS.map((m) => (
                  <label key={m} style={{ display: "grid", gap: 6, padding: 12, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      <MethodKeyPill m={m} />
                    </div>
                    <Input
                      value={declDeposit[m]}
                      onChange={(e) => setDeclDeposit((s) => ({ ...s, [m]: e.target.value }))}
                      placeholder="0,00"
                    />
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                Sistema fianza neta: <b>{euros(sumMethodMapCents(systemDepositByMethod))}</b> · Declarado fianza neta:{" "}
                <b>{euros(declaredTotals.netDeposit)}</b>
              </div>
            </div>

            <div style={styles.grid3}>
              <Stat label="Sistema neto" value={euros(systemNet)} />
              <Stat label="Declarado neto" value={euros(declaredTotals.netTotal)} />
              <Stat label="Diferencia neta" value={euros(diffLive.netTotal)} />
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Tip: si no cuadra, empieza por <b>CASH</b>. “DIF” = Declarado − Sistema.
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
                        border: `1px solid ${checked ? "#bae6fd" : "#e2e8f0"}`,
                        borderRadius: 16,
                        background: checked ? "#f0f9ff" : "white",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...selectedSs, s.id] : selectedSs.filter((x) => x !== s.id);
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
