// src/app/booth/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { getCountryOptionsEs, type CountryOption } from "@/lib/countries";

type Service = { id: string; name: string; category: string; code?: string | null };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; basePriceCents: number };
type Channel = { id: string; name: string };
type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

type SplitLine = { amount: string; method: PayMethod };

type ReservationLike = {
  id: string;
  customerName?: string | null;
  customerCountry?: string | null;
  boothCode?: string | null;
  quantity?: number | null;
  pax?: number | null;
  totalPriceCents?: number | null;
  paidCents?: number | null;
  pendingCents?: number | null;
  arrivedStoreAt?: string | null;
  taxiboatTripId?: string | null;
  taxiboatDepartedAt?: string | null;
  taxiboatAssignedAt?: string | null;
  service?: { name?: string | null; code?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

type TripRow = {
  id: string;
  boat: "TAXIBOAT_1" | "TAXIBOAT_2" | string;
  tripNo?: number | null;
  status: string;
  paxTotal?: number | null;
  departedAt?: string | null;
  reservations?: ReservationLike[];
};

type TaxiboatOperationRow = {
  id: string;
  boat: "TAXIBOAT_1" | "TAXIBOAT_2" | string;
  status: "AT_PLATFORM" | "TO_BOOTH" | "AT_BOOTH" | string;
  arrivedPlatformAt?: string | null;
  departedPlatformAt?: string | null;
  arrivedBoothAt?: string | null;
  updatedAt: string;
};

type CashClosureSummary = {
  ok: boolean;
  isClosed?: boolean;
  closure?: { isVoided?: boolean | null } | null;
  computed?: { all?: { NET?: number }; meta?: { shift?: string | null } };
  error?: string;
};

const TAXIBOAT_QUEUE_WARN_MINUTES = 15;
const TAXIBOAT_QUEUE_CRITICAL_MINUTES = 30;

function euros(cents: number) {
  return (cents / 100).toFixed(2) + " EUR";
}

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function getTaxiboatWaitMeta(assignedAt?: string | null, departedAt?: string | null, arrivedStoreAt?: string | null, nowMs?: number) {
  if (!assignedAt || departedAt || arrivedStoreAt) return null;

  const assignedMs = new Date(assignedAt).getTime();
  if (!Number.isFinite(assignedMs)) return null;

  const waitMs = Math.max(0, (nowMs ?? Date.now()) - assignedMs);
  const warnMs = TAXIBOAT_QUEUE_WARN_MINUTES * 60_000;
  const criticalMs = TAXIBOAT_QUEUE_CRITICAL_MINUTES * 60_000;
  const isCritical = waitMs >= criticalMs;
  const isWarn = waitMs >= warnMs;

  return {
    waitMs,
    isWarn,
    isCritical,
    bg: isCritical ? "#fff1f2" : isWarn ? "#fffbeb" : "#e0f2fe",
    fg: isCritical ? "#b91c1c" : isWarn ? "#92400e" : "#0f766e",
    bd: isCritical ? "#fecaca" : isWarn ? "#fde68a" : "#bae6fd",
    label: isCritical
      ? `ALERTA CRITICA (${TAXIBOAT_QUEUE_CRITICAL_MINUTES}+ min)`
      : isWarn
        ? `Alerta de espera (${TAXIBOAT_QUEUE_WARN_MINUTES}+ min)`
        : `Espera ${msToClock(waitMs)}`,
  };
}

function getTaxiboatReturnMeta(
  row: TaxiboatOperationRow,
  nowMs?: number
) {
  if (row.status === "AT_BOOTH") {
    const arrivedLabel = row.arrivedBoothAt
      ? new Date(row.arrivedBoothAt).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    return {
      statusLabel: "EN BOOTH",
      detail: `Llegada a Booth registrada a las ${arrivedLabel}`,
      bg: "#f0fdf4",
      fg: "#166534",
      bd: "#bbf7d0",
    };
  }

  if (row.status === "TO_BOOTH") {
    const departedMs = new Date(row.departedPlatformAt ?? row.updatedAt).getTime();
    const elapsedMs = Math.max(0, (nowMs ?? Date.now()) - departedMs);
    return {
      statusLabel: "EN CAMINO",
      detail: `Salio de platform hace ${msToClock(elapsedMs)}`,
      bg: "#fffbeb",
      fg: "#92400e",
      bd: "#fde68a",
    };
  }

  const arrivedLabel = row.arrivedPlatformAt
    ? new Date(row.arrivedPlatformAt).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  return {
    statusLabel: "EN PLATAFORMA",
    detail: `Disponible en platform desde ${arrivedLabel}`,
    bg: "#ecfeff",
    fg: "#155e75",
    bd: "#a5f3fc",
  };
}

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

function toCentsFromEuroInput(v: string) {
  const n = Number((v ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function isJetskiService(svc?: { code?: string | null; name?: string | null } | null) {
  const key = normalize(svc?.code ?? svc?.name ?? "");
  return key.includes("jetski") || key.includes("jet") || key.includes("moto");
}

function formatReservationLine(r: ReservationLike, opts?: { showCountry?: boolean }) {
  const jetski = isJetskiService(r.service);

  const parts = [
    r.service?.name ?? "Servicio",
    r.option?.durationMinutes ? `${r.option.durationMinutes} min` : null,
    jetski ? `${r.quantity} ${r.quantity === 1 ? "moto" : "motos"}` : null,
    r.pax ? `${r.pax} pax` : null,
    opts?.showCountry && r.customerCountry ? r.customerCountry : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export default function Booth() {
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rows, setRows] = useState<ReservationLike[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [splitById, setSplitById] = useState<Record<string, [SplitLine, SplitLine]>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [discountEuros, setDiscountEuros] = useState<string>(""); // descuento opcional
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [taxiboatOps, setTaxiboatOps] = useState<TaxiboatOperationRow[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>("");
  const [activeBoat, setActiveBoat] = useState<"TAXIBOAT_1"|"TAXIBOAT_2">("TAXIBOAT_1");
  const [cashClosureSummary, setCashClosureSummary] = useState<CashClosureSummary | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customerCountry, setCustomerCountry] = useState("ES");
  const [serviceId, setServiceId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pax, setPax] = useState(2);
  const [channelId, setChannelId] = useState<string>(""); // opcional
  const [category, setCategory] = useState<string>("");

// categorias disponibles (desde services)
const categories = useMemo(() => {
  const set = new Set<string>();
  for (const s of services) {
    if (s.category) set.add(s.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}, [services]);

const isCashClosed = Boolean(cashClosureSummary?.isClosed && !cashClosureSummary?.closure?.isVoided);

const CashClosedBanner = () =>
  isCashClosed ? (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12 }}>
      <b>Caja cerrada.</b> No se pueden registrar cobros en este turno. Si hay que reabrir, pídeselo a Admin.
    </div>
  ) : null;


// servicios filtrados por categoria
const servicesFiltered = useMemo(() => {
  if (!category) return services;
  return services.filter((s) => s.category === category);
}, [services, category]);
  
const optionsForService = useMemo(
    () => options.filter(o => o.serviceId === serviceId),
    [options, serviceId]
  );

const selectedOption = useMemo(
  () => optionsForService.find((o) => o.id === optionId) ?? null,
  [optionsForService, optionId]
);

const selectedService = useMemo(() => {
  return services.find((s) => s.id === serviceId) ?? null;
}, [services, serviceId]);

const countryOptions = useMemo(() => getCountryOptionsEs(), []);
const selectedCountryOpt = useMemo(() => {
  const v = String(customerCountry ?? "").toUpperCase();
  return countryOptions.find((c) => c.value === v) ?? null;
}, [customerCountry, countryOptions]);

const isJetski = useMemo(() => {
  const key = normalize(selectedService?.code ?? selectedService?.name ?? "");
  // Ajusta los hints a tus codigos/nombres reales
  return key.includes("jetski") || key.includes("jet") || key.includes("moto");
}, [selectedService]);

const baseTotalCents = useMemo(() => {
  const unit = Number(selectedOption?.basePriceCents ?? 0) || 0;
  const qty = isJetski ? Number(quantity || 1) : 1;
  return unit * Math.max(1, qty);
}, [selectedOption, isJetski, quantity]);

const maxManualDiscountCents = useMemo(() => Math.floor(baseTotalCents * 0.3), [baseTotalCents]);
const discountCentsRaw = useMemo(() => toCentsFromEuroInput(discountEuros), [discountEuros]);
const discountCentsClamped = useMemo(
  () => Math.max(0, Math.min(discountCentsRaw, maxManualDiscountCents)),
  [discountCentsRaw, maxManualDiscountCents]
);

async function load() {
  setError(null);

  const c = await fetch("/api/pos/catalog?origin=BOOTH", { cache: "no-store" });
  if (c.ok) {
    const data = await c.json();

    setServices(data.services ?? []);
    setOptions(data.options ?? []);
    setChannels(data.channels ?? []);

    // defaults seguros dentro del if y usando data
    const firstCategory = (data.services ?? [])[0]?.category ?? "";
    setCategory((prev) => prev || firstCategory);

    const initialServices = data.services ?? [];
    const initialFiltered = firstCategory
      ? initialServices.filter((s: Service) => s.category === firstCategory)
      : initialServices;

    const s0 = initialFiltered[0] ?? initialServices[0];
    setServiceId(s0?.id ?? "");

    const firstOpt = (data.options ?? []).find((o: Option) => o.serviceId === (s0?.id ?? ""));
    setOptionId(firstOpt?.id ?? "");
  }

  const sum = await fetch("/api/store/cash-closures/summary?origin=BOOTH", { cache: "no-store" });

  if (sum.ok) setCashClosureSummary(await sum.json());
  else setCashClosureSummary({ ok: false, error: await sum.text() });

  const r = await fetch("/api/booth/reservations/today", { cache: "no-store" });
  if (r.ok) {
    const j = await r.json();
    setRows(j.rows ?? []);
  }

  const t = await fetch("/api/booth/taxiboat-trips/today", { cache: "no-store" });
  if (t.ok) {
    const j = await t.json();
    setTrips(j.trips ?? []);
  }

  const ops = await fetch("/api/platform/taxiboat-operations", { cache: "no-store" });
  if (ops.ok) {
    const j = await ops.json();
    setTaxiboatOps(j.rows ?? []);
  }
}

const activeTrip = trips.find((t) => t.id === activeTripId);

const activeTripLabel = activeTrip
  ? `${activeTrip.boat} · ${activeTrip.status} · PAX ${activeTrip.paxTotal ?? 0}${
      activeTrip.departedAt
        ? ` · salió ${new Date(activeTrip.departedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
        : ""
    }`
  : "";
const reservationsPending = useMemo(() => rows.filter((r) => (r.pendingCents ?? 0) > 0).length, [rows]);
const reservationsReceived = useMemo(() => rows.filter((r) => Boolean(r.arrivedStoreAt)).length, [rows]);
const openTrips = useMemo(() => trips.filter((t) => t.status === "OPEN").length, [trips]);
const queueWaiting = useMemo(
  () => rows.filter((r) => !r.arrivedStoreAt && !r.taxiboatDepartedAt && !r.taxiboatTripId).length,
  [rows]
);
const preReservationRows = useMemo(
  () => rows.filter((r) => !r.arrivedStoreAt && !r.taxiboatTripId),
  [rows]
);
const taxiboatOpsByBoat = useMemo(
  () => new Map(taxiboatOps.map((row) => [row.boat, row])),
  [taxiboatOps]
);

function getSplit(id: string): [SplitLine, SplitLine] {
  return (
    splitById[id] ?? [
      { amount: "", method: "CASH" },
      { amount: "", method: "CARD" },
    ]
  );
}

function setSplitLine(id: string, idx: 0 | 1, patch: Partial<SplitLine>) {
  setSplitById((m) => {
    const [a, b] = getSplit(id);
    const next: [SplitLine, SplitLine] =
      idx === 0
        ? [{ ...a, ...patch }, b]
        : [a, { ...b, ...patch }];
    return { ...m, [id]: next };
  });
}

function boatLabel(boat?: string | null) {
  if (!boat) return "Taxiboat";
  if (boat === "TAXIBOAT_1") return "Nazca";
  if (boat === "TAXIBOAT_2") return "Taxiboat 2";
  return boat; // fallback
}

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    // si cambia el servicio, selecciona primera opcion
    if (serviceId) {
      const first = options.find(o => o.serviceId === serviceId);
      if (first) setOptionId(first.id);
    }
  }, [serviceId, options]);

// si no es jetski, quantity siempre 1
useEffect(() => {
  if (!isJetski) setQuantity(1);
}, [isJetski]);

  async function createPre(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const customerName = `${String(firstName ?? "").trim()} ${String(lastName ?? "").trim()}`.trim();
    if (!customerName) {
      setError("Nombre requerido");
      return;
    }

    const r = await fetch("/api/booth/reservations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerCountry,
        serviceId,
        optionId,
        quantity,
        pax,
        channelId: channelId || null,
        discountEuros: (discountCentsClamped / 100).toFixed(2),
      }),
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    const j = await r.json();
    alert(`Creada. Código: ${j.boothCode}`);

    setFirstName("");
    setLastName("");
    setQuantity(1);
    setPax(2);
    setDiscountEuros("");

    await load();
  }

async function createTrip() {
  setError(null);
  const r = await fetch("/api/booth/taxiboat-trips/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boat: activeBoat }),
  });

  if (!r.ok) {
    setError(await r.text());
    return;
  }

  const j = await r.json();
  // fuerza refresco y deja seleccionado el nuevo viaje
  await load();
  if (j?.trip?.id) setActiveTripId(j.trip.id);
}

async function assignToActiveTrip(reservationId: string) {
  if (!activeTripId) {
    alert("Primero crea/selecciona un viaje OPEN");
    return;
  }
  const r = await fetch("/api/booth/taxiboat-trips/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId: activeTripId, reservationId }),
  });
  if (!r.ok) throw new Error(await r.text());
  await load();
}

async function departTrip(tripId: string) {
  const r = await fetch("/api/booth/taxiboat-trips/depart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tripId }),
  });
  if (!r.ok) throw new Error(await r.text());
  await load();
}

async function markArrivedBooth(boat: "TAXIBOAT_1" | "TAXIBOAT_2") {
  const r = await fetch("/api/platform/taxiboat-operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boat, action: "MARK_ARRIVED_BOOTH" }),
  });
  if (!r.ok) throw new Error(await r.text());
  await load();
}

async function paySplitNow(reservationId: string, pendingCents: number) {
  setError(null);
  setPayingId(reservationId);

  try {
    const [l1, l2] = getSplit(reservationId);

    const toCents = (s: string) =>
      Math.round(Number((s ?? "").replace(",", ".")) * 100);

    const a1 = toCents(l1.amount);
    const a2 = toCents(l2.amount);

    if ((!a1 || a1 <= 0) && (!a2 || a2 <= 0)) {
      throw new Error("Introduce un importe en al menos una línea");
    }

    if ((a1 && a1 < 0) || (a2 && a2 < 0)) throw new Error("Importe inválido");

    const total = (a1 > 0 ? a1 : 0) + (a2 > 0 ? a2 : 0);
    if (total > pendingCents) {
      throw new Error(`Te pasas del pendiente (${euros(pendingCents)})`);
    }

    // helper para crear un pago
    const createOne = async (amountCents: number, method: PayMethod) => {
      const r = await fetch("/api/booth/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          amountCents,
          method,
          origin: "BOOTH",
          isDeposit: false,
          direction: "IN",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    };

    if (a1 > 0) await createOne(a1, l1.method);
    if (a2 > 0) await createOne(a2, l2.method);

    // limpia inputs de esa reserva
    setSplitById((m) => ({
      ...m,
      [reservationId]: [
        { amount: "", method: "CASH" },
        { amount: "", method: "CARD" },
      ],
    }));

    await load(); // refresca lista
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error cobrando");
  } finally {
    setPayingId(null);
  }
}

  const shellStyle: React.CSSProperties = { padding: 24, fontFamily: "system-ui", maxWidth: 1380, margin: "0 auto", display: "grid", gap: 18 };
  const cardStyle: React.CSSProperties = { padding: 20, border: "1px solid #dbe4ea", borderRadius: 24, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)" };
  const fieldStyle: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 14, border: "1px solid #d0d9e4", background: "#fff" };
  const ghostBtn: React.CSSProperties = { padding: "10px 14px", fontWeight: 900, border: "1px solid #d0d9e4", borderRadius: 12, background: "#fff", textDecoration: "none", color: "#111" };
  const darkBtn: React.CSSProperties = { padding: "10px 14px", fontWeight: 900, border: "1px solid #111", borderRadius: 12, background: "#111", color: "#fff" };
  const metricCard: React.CSSProperties = { border: "1px solid #dbe4ea", borderRadius: 18, padding: 14, background: "#fff", display: "grid", gap: 4 };

  return (
    <div style={shellStyle}>
      <section
        style={{
          ...cardStyle,
          background:
            "radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 30%), radial-gradient(circle at right bottom, rgba(45, 212, 191, 0.12), transparent 28%), linear-gradient(135deg, #082f49 0%, #0f766e 55%, #052e2b 100%)",
          color: "#ecfeff",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#99f6e4" }}>
              Operativa de carpa
            </div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: "#fff" }}>Booth</h1>
            <div style={{ fontSize: 14, color: "#ccfbf1" }}>
              Pre-reservas, cobro parcial, agrupación por taxiboat y control de caja del punto en una sola vista.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/booth/cash-closures" style={{ ...ghostBtn, background: "rgba(255,255,255,0.9)" }}>
              Cierre de caja
            </a>
            <button onClick={load} style={{ ...darkBtn, border: "1px solid rgba(255,255,255,0.24)", background: "#0f172a" }}>
              Refrescar
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(153, 246, 228, 0.35)", background: "rgba(15, 23, 42, 0.24)", fontWeight: 900 }}>
            Reservas hoy: {rows.length}
          </span>
          <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(153, 246, 228, 0.35)", background: "rgba(15, 23, 42, 0.24)", fontWeight: 900 }}>
            Viajes OPEN: {openTrips}
          </span>
          <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(153, 246, 228, 0.35)", background: "rgba(15, 23, 42, 0.24)", fontWeight: 900 }}>
            Caja: {isCashClosed ? "Cerrada" : "Abierta"}
          </span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Pendientes de cobro</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{reservationsPending}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Recibidas en tienda</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{reservationsReceived}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>En cola sin viaje</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{queueWaiting}</div>
        </article>
        <article style={metricCard}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Neto de caja</div>
          <div style={{ fontSize: 24, fontWeight: 950 }}>{euros(cashClosureSummary?.computed?.all?.NET ?? 0)}</div>
        </article>
      </section>

      {error ? <div style={{ padding: 12, background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 12 }}>{error}</div> : null}
      <CashClosedBanner />

      {cashClosureSummary?.ok ? (
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Cierre de caja (BOOTH · {cashClosureSummary?.computed?.meta?.shift ?? "MORNING"})</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                Sistema neto: <b>{euros(cashClosureSummary.computed?.all?.NET ?? 0)}</b> · Estado: {cashClosureSummary.isClosed ? "CERRADO" : "ABIERTO"}
              </div>
            </div>
            <a href={`/booth/cash-closures`} style={{ ...ghostBtn, background: cashClosureSummary.isClosed ? "#f3f4f6" : "white", pointerEvents: cashClosureSummary.isClosed ? "none" : "auto", opacity: cashClosureSummary.isClosed ? 0.6 : 1 }}>
              {cashClosureSummary.isClosed ? "Caja cerrada" : "Cerrar caja"}
            </a>
          </div>
        </section>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Pre-reserva</h2>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Alta rápida para carpa con precio, descuento y canal.</div>
            </div>
            <form onSubmit={createPre} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>Nombre<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={fieldStyle} /></label>
                <label>Apellidos<input value={lastName} onChange={(e) => setLastName(e.target.value)} required style={fieldStyle} /></label>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div>País</div>
                <Select<CountryOption, false>
                  instanceId="booth-country"
                  inputId="booth-country"
                  options={countryOptions}
                  value={selectedCountryOpt}
                  onChange={(opt) => setCustomerCountry((opt?.value ?? "").toUpperCase())}
                  placeholder="Escribe para buscar..."
                />
              </div>
              <label>Categoría<select value={category} onChange={(e) => { const next = e.target.value; setCategory(next); const list = next ? services.filter((s) => s.category === next) : services; const s0 = list[0] ?? null; setServiceId(s0?.id ?? ""); const o0 = options.find((o) => o.serviceId === (s0?.id ?? "")) ?? null; setOptionId(o0?.id ?? ""); }} style={fieldStyle}><option value="">(todas)</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label>Servicio<select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={fieldStyle}>{servicesFiltered.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Duración<select value={optionId} onChange={(e) => setOptionId(e.target.value)} style={fieldStyle}>{optionsForService.map((o) => <option key={o.id} value={o.id}>{o.durationMinutes} min · máx {o.paxMax} pax · {euros(o.basePriceCents)}</option>)}</select></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>Cantidad (motos)<input type="number" min={1} max={4} value={quantity} disabled={!isJetski} onChange={(e) => setQuantity(Number(e.target.value))} style={fieldStyle} /></label>
                <label>PAX<input type="number" min={1} max={20} value={pax} onChange={(e) => setPax(Number(e.target.value))} style={fieldStyle} /></label>
              </div>
              <label>Descuento opcional (EUR)<input value={discountEuros} onChange={(e) => setDiscountEuros(e.target.value)} placeholder="0" style={fieldStyle} /></label>
              <div style={{ fontSize: 12, opacity: 0.85 }}>Máx descuento manual: <b>{euros(maxManualDiscountCents)}</b> (30% sobre {euros(baseTotalCents)}){discountCentsRaw > maxManualDiscountCents ? <span style={{ marginLeft: 8, color: "#b91c1c" }}>limitado a {euros(maxManualDiscountCents)}</span> : null}</div>
              <label>Canal opcional<select value={channelId} onChange={(e) => setChannelId(e.target.value)} style={fieldStyle}><option value="">(ninguno)</option>{channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}</select></label>
              <button type="submit" style={darkBtn}>Crear y generar código</button>
            </form>
          </section>

          <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22 }}>Pre-reservas de hoy</h2>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Pendientes de asignación a viaje y cobro parcial antes de salir.</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {preReservationRows.map((r) => {
                const received = !!r.arrivedStoreAt;
                const assigned = !!r.taxiboatTripId;
                const departed = !!r.taxiboatDepartedAt;
                const preparing = assigned && !departed && !received;
                const enCamino = assigned && departed && !received;
                const waitMeta = getTaxiboatWaitMeta(r.taxiboatAssignedAt, r.taxiboatDepartedAt, r.arrivedStoreAt, nowMs);
                const label = received ? "RECIBIDO" : enCamino ? "EN CAMINO" : preparing ? "PREPARANDO" : "";
                const bg = received ? "#dcfce7" : enCamino ? "#fef9c3" : preparing ? "#e0f2fe" : "transparent";
                return <div key={r.id} style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 18, background: "#fff", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{r.customerName}</strong><span style={{ fontWeight: 800 }}>{r.boothCode}</span></div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{formatReservationLine(r, { showCountry: true })}</div><div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div style={{ fontSize: 13 }}>Total: <strong>{euros(r.totalPriceCents ?? 0)}</strong></div><div style={{ fontSize: 13, opacity: 0.85 }}>Pagado: <strong>{euros(r.paidCents ?? 0)}</strong></div><div style={{ fontSize: 13, opacity: 0.85 }}>Pendiente: <strong>{euros(r.pendingCents ?? 0)}</strong></div></div>
                {waitMeta ? <div style={{ marginTop: 8, display: "inline-flex", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 999, border: `1px solid ${waitMeta.bd}`, background: waitMeta.bg, color: waitMeta.fg, fontSize: 12, fontWeight: 900 }}>{waitMeta.label}</div> : null}
                {!received && activeTripId ? <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{!assigned ? <button onClick={() => assignToActiveTrip(r.id)} style={darkBtn}>Añadir al viaje</button> : <span style={{ padding: "4px 8px", borderRadius: 999, background: "#e0f2fe" }}>Asignado a viaje</span>}<div style={{ fontSize: 12, opacity: 0.75 }}>Viaje activo: {activeTripLabel || activeTripId}</div></div> : null}
                {!received && (r.pendingCents ?? 0) > 0 ? <div style={{ marginTop: 10, display: "grid", gap: 10 }}><div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}><input disabled={isCashClosed} placeholder="Importe EUR (1)" value={getSplit(r.id)[0].amount} onChange={(e) => setSplitLine(r.id, 0, { amount: e.target.value })} style={{ ...fieldStyle, width: 160 }} /><select disabled={isCashClosed} value={getSplit(r.id)[0].method} onChange={(e) => setSplitLine(r.id, 0, { method: e.target.value as PayMethod })} style={{ ...fieldStyle, width: 180 }}><option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option><option value="BIZUM">Bizum</option><option value="TRANSFER">Transfer</option></select></div><div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}><input disabled={isCashClosed} placeholder="Importe EUR (2)" value={getSplit(r.id)[1].amount} onChange={(e) => setSplitLine(r.id, 1, { amount: e.target.value })} style={{ ...fieldStyle, width: 160 }} /><select disabled={isCashClosed} value={getSplit(r.id)[1].method} onChange={(e) => setSplitLine(r.id, 1, { method: e.target.value as PayMethod })} style={{ ...fieldStyle, width: 180 }}><option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option><option value="BIZUM">Bizum</option><option value="TRANSFER">Transfer</option></select><button onClick={() => paySplitNow(r.id, r.pendingCents ?? 0)} disabled={payingId === r.id || isCashClosed} style={{ ...darkBtn, opacity: payingId === r.id || isCashClosed ? 0.5 : 1, cursor: isCashClosed ? "not-allowed" : "pointer" }}>{isCashClosed ? "Caja cerrada" : payingId === r.id ? "Cobrando..." : "Cobrar (split)"}</button></div><div style={{ fontSize: 12, opacity: 0.7 }}>Pendiente: <strong>{euros(r.pendingCents ?? 0)}</strong> · Se pueden usar 1 o 2 líneas.</div></div> : null}
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{label ? <span style={{ padding: "4px 8px", borderRadius: 999, background: bg, fontSize: 12 }}>{label}</span> : <span />}</div></div>;
              })}
              {preReservationRows.length === 0 ? <div style={{ opacity: 0.7 }}>No hay pre-reservas pendientes de asignación.</div> : null}
            </div>
          </section>
        </div>

        <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Taxiboat · Viajes</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Crea, prepara y despacha viajes del día. El retorno desde Platform se muestra por barco.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {(["TAXIBOAT_1", "TAXIBOAT_2"] as const).map((boat) => {
              const op = taxiboatOpsByBoat.get(boat);
              const meta = op ? getTaxiboatReturnMeta(op, nowMs) : null;

              return (
                <div
                  key={boat}
                  style={{
                    border: `1px solid ${meta?.bd ?? "#e5e7eb"}`,
                    background: meta?.bg ?? "#fff",
                    borderRadius: 16,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{boatLabel(boat)}</div>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: `1px solid ${meta?.bd ?? "#e5e7eb"}`,
                        background: "#fff",
                        color: meta?.fg ?? "#475569",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {meta?.statusLabel ?? "SIN DATO"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: meta?.fg ?? "#475569", fontWeight: 800 }}>
                    {meta?.detail ?? "Sin estado operativo todavía."}
                  </div>
                  {op?.status === "TO_BOOTH" ? (
                    <button
                      type="button"
                      onClick={() => void markArrivedBooth(boat)}
                      style={darkBtn}
                    >
                      Marcar llegada a Booth
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, alignItems: "end" }}>
            <select value={activeBoat} onChange={(e) => setActiveBoat(e.target.value as "TAXIBOAT_1" | "TAXIBOAT_2")} style={fieldStyle}><option value="TAXIBOAT_1">Taxiboat 1</option><option value="TAXIBOAT_2">Taxiboat 2</option></select>
            <button onClick={createTrip} style={darkBtn}>Crear viaje</button>
            <select value={activeTripId} onChange={(e) => setActiveTripId(e.target.value)} style={{ ...fieldStyle, minWidth: 260 }}><option value="">(selecciona viaje OPEN)</option>{trips.map((t) => <option key={t.id} value={t.id}>{boatLabel(t.boat)}{t.tripNo ? ` · Viaje ${t.tripNo}` : ""} · {t.status} · PAX {t.paxTotal}</option>)}</select>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {trips.map((t) => <div key={t.id} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div style={{ fontWeight: 900 }}>{boatLabel(t.boat)} · Viaje {t.tripNo} · PAX {t.paxTotal}</div>{t.status === "OPEN" ? <button onClick={() => departTrip(t.id)} style={ghostBtn}>Marcar salida</button> : <div style={{ fontSize: 12, opacity: 0.75 }}>Salió: {t.departedAt ? new Date(t.departedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "-"}</div>}</div><div style={{ marginTop: 10, display: "grid", gap: 8 }}>{(t.reservations ?? []).map((r) => { const grouped = !!r.taxiboatAssignedAt && !t.departedAt && !r.arrivedStoreAt; const enCamino = !!t.departedAt && !r.arrivedStoreAt; const received = !!r.arrivedStoreAt; const waitMeta = getTaxiboatWaitMeta(r.taxiboatAssignedAt, t.departedAt ?? r.taxiboatDepartedAt, r.arrivedStoreAt, nowMs); const label = received ? "RECIBIDO" : enCamino ? "EN CAMINO" : grouped ? "AGRUPADO" : "PREPARANDO"; const bg = received ? "#dcfce7" : enCamino ? "#fef9c3" : grouped ? "#e0f2fe" : "#f3f4f6"; return <div key={r.id} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div style={{ fontWeight: 800 }}>{r.customerName} · <span style={{ fontWeight: 900 }}>{r.boothCode}</span></div><span style={{ padding: "2px 8px", borderRadius: 999, background: bg, fontSize: 12 }}>{label}</span></div><div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{formatReservationLine(r, { showCountry: true })}</div>{waitMeta ? <div style={{ marginTop: 8, display: "inline-flex", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 999, border: `1px solid ${waitMeta.bd}`, background: waitMeta.bg, color: waitMeta.fg, fontSize: 12, fontWeight: 900 }}>{waitMeta.label}</div> : null}</div>; })}{(t.reservations ?? []).length === 0 ? <div style={{ opacity: 0.7 }}>Sin reservas asignadas.</div> : null}</div></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
