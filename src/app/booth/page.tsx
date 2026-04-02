// src/app/booth/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getCountryOptionsEs } from "@/lib/countries";
import { opsStyles } from "@/components/ops-ui";
import BoothOverviewSection from "./_components/BoothOverviewSection";
import BoothPreReservationFormSection from "./_components/BoothPreReservationFormSection";
import BoothPreReservationsSection from "./_components/BoothPreReservationsSection";
import BoothTripsSection from "./_components/BoothTripsSection";

type Service = { id: string; name: string; category: string; code?: string | null };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; basePriceCents: number };
type Channel = { id: string; name: string };
type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

type SplitLine = { amount: string; method: PayMethod; received?: string };

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
  status: "TO_PLATFORM" | "AT_PLATFORM" | "TO_BOOTH" | "AT_BOOTH" | string;
  departedBoothAt?: string | null;
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
      ? `ALERTA CRÍTICA (${TAXIBOAT_QUEUE_CRITICAL_MINUTES}+ min)`
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
      detail: `Salió de Platform hace ${msToClock(elapsedMs)}`,
      bg: "#fffbeb",
      fg: "#92400e",
      bd: "#fde68a",
    };
  }

  if (row.status === "TO_PLATFORM") {
    const departedMs = new Date(row.departedBoothAt ?? row.updatedAt).getTime();
    const elapsedMs = Math.max(0, (nowMs ?? Date.now()) - departedMs);
    return {
      statusLabel: "HACIA PLATFORM",
      detail: `Salio de Booth hace ${msToClock(elapsedMs)}`,
      bg: "#eff6ff",
      fg: "#1d4ed8",
      bd: "#bfdbfe",
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
    detail: `Disponible en Platform desde ${arrivedLabel}`,
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

// categorías disponibles (desde services)
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


// servicios filtrados por categoría
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
  // Ajusta los hints a tus códigos/nombres reales
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
      { amount: "", method: "CASH", received: "" },
      { amount: "", method: "CARD", received: "" },
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

  const shellStyle: React.CSSProperties = { ...opsStyles.pageShell, width: "min(1380px, 100%)" };
  const cardStyle: React.CSSProperties = { ...opsStyles.sectionCard, padding: 20 };
  const fieldStyle: React.CSSProperties = opsStyles.field;
  const ghostBtn: React.CSSProperties = opsStyles.ghostButton;
  const darkBtn: React.CSSProperties = opsStyles.primaryButton;
  const metricCard: React.CSSProperties = opsStyles.metricCard;

  return (
    <div style={shellStyle}>
      <BoothOverviewSection
        rowsCount={rows.length}
        openTrips={openTrips}
        reservationsPending={reservationsPending}
        reservationsReceived={reservationsReceived}
        queueWaiting={queueWaiting}
        cashClosureSummary={cashClosureSummary}
        isCashClosed={isCashClosed}
        euros={euros}
        cardStyle={cardStyle}
        metricCard={metricCard}
        ghostBtn={ghostBtn}
        darkBtn={darkBtn}
        onReload={() => {
          void load();
        }}
      />

      {error ? <div style={{ padding: 12, background: "#fff1f2", border: "1px solid #fecaca", borderRadius: 12 }}>{error}</div> : null}
      <CashClosedBanner />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <BoothPreReservationFormSection
            cardStyle={cardStyle}
            darkBtn={darkBtn}
            fieldStyle={fieldStyle}
            firstName={firstName}
            lastName={lastName}
            customerCountry={customerCountry}
            serviceId={serviceId}
            optionId={optionId}
            quantity={quantity}
            pax={pax}
            channelId={channelId}
            category={category}
            categories={categories}
            services={services}
            servicesFiltered={servicesFiltered}
            options={options}
            optionsForService={optionsForService}
            channels={channels}
            selectedCountryOpt={selectedCountryOpt}
            countryOptions={countryOptions}
            isJetski={isJetski}
            discountEuros={discountEuros}
            maxManualDiscountCents={maxManualDiscountCents}
            baseTotalCents={baseTotalCents}
            discountCentsRaw={discountCentsRaw}
            euros={euros}
            onSubmit={createPre}
            setFirstName={setFirstName}
            setLastName={setLastName}
            setCustomerCountry={setCustomerCountry}
            setServiceId={setServiceId}
            setOptionId={setOptionId}
            setQuantity={setQuantity}
            setPax={setPax}
            setChannelId={setChannelId}
            setCategory={setCategory}
            setDiscountEuros={setDiscountEuros}
          />

          <BoothPreReservationsSection
            cardStyle={cardStyle}
            darkBtn={darkBtn}
            fieldStyle={fieldStyle}
            preReservationRows={preReservationRows}
            activeTripId={activeTripId}
            activeTripLabel={activeTripLabel}
            payingId={payingId}
            isCashClosed={isCashClosed}
            getSplit={getSplit}
            setSplitLine={setSplitLine}
            assignToActiveTrip={assignToActiveTrip}
            paySplitNow={paySplitNow}
            euros={euros}
            formatReservationLine={formatReservationLine}
            getWaitMeta={(reservation) =>
              getTaxiboatWaitMeta(
                reservation.taxiboatAssignedAt,
                reservation.taxiboatDepartedAt,
                reservation.arrivedStoreAt,
                nowMs
              )
            }
          />
        </div>

        <BoothTripsSection
          cardStyle={cardStyle}
          darkBtn={darkBtn}
          ghostBtn={ghostBtn}
          fieldStyle={fieldStyle}
          activeBoat={activeBoat}
          activeTripId={activeTripId}
          trips={trips}
          taxiboatOpsByBoat={taxiboatOpsByBoat}
          nowMs={nowMs}
          setActiveBoat={setActiveBoat}
          setActiveTripId={setActiveTripId}
          createTrip={createTrip}
          departTrip={departTrip}
          markArrivedBooth={markArrivedBooth}
          boatLabel={boatLabel}
          formatReservationLine={formatReservationLine}
          getTaxiboatReturnMeta={getTaxiboatReturnMeta}
          getTaxiboatWaitMeta={getTaxiboatWaitMeta}
        />
      </div>
    </div>
  );
}
