// src/app/booth/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/seariders-ui";
import { getCountryOptionsEs } from "@/lib/countries";
import { opsStyles } from "@/components/ops-ui";
import { computeCommissionableBase, resolveDiscountPolicy } from "@/lib/commission";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import BoothOverviewSection from "./_components/BoothOverviewSection";
import BoothPreReservationFormSection from "./_components/BoothPreReservationFormSection";
import BoothPreReservationsSection from "./_components/BoothPreReservationsSection";
import BoothTripsSection from "./_components/BoothTripsSection";

type Service = { id: string; name: string; category: string; code?: string | null; isExternalActivity?: boolean | null };
type Option = { id: string; serviceId: string; durationMinutes: number; paxMax: number; basePriceCents: number };
type CartItem = { id: string; serviceId: string; optionId: string | null; quantity: number; pax: number; isExtra: boolean };
type ChannelRule = { serviceId: string; commissionPct: number };
type Channel = {
  id: string;
  name: string;
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  discountResponsibility?: "COMPANY" | "PROMOTER" | "SHARED" | null;
  promoterDiscountShareBps?: number | null;
  commissionRules?: ChannelRule[] | null;
};
type PayMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

type SplitLine = { amount: string; method: PayMethod; received?: string };

type ReservationLike = {
  id: string;
  status?: string;
  customerName?: string | null;
  customerCountry?: string | null;
  boothCode?: string | null;
  boothNote?: string | null;
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

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function searidersPctFromChannelPct(channelPct: number, kind?: Channel["kind"] | null) {
  const normalized = clampPct(channelPct);
  return kind === "EXTERNAL_ACTIVITY" ? clampPct(100 - normalized) : normalized;
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
  const [servicesExtra, setServicesExtra] = useState<Service[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [extraPriceByServiceId, setExtraPriceByServiceId] = useState<Record<string, number | null>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const [rows, setRows] = useState<ReservationLike[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [splitById, setSplitById] = useState<Record<string, [SplitLine, SplitLine]>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [discountEuros, setDiscountEuros] = useState<string>(""); // descuento opcional
  const [discountResponsibility, setDiscountResponsibility] = useState<"COMPANY" | "PROMOTER" | "SHARED">("COMPANY");
  const [promoterDiscountSharePct, setPromoterDiscountSharePct] = useState<string>("50");
  const [boothNote, setBoothNote] = useState("");
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [taxiboatOps, setTaxiboatOps] = useState<TaxiboatOperationRow[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>("");
  const [activeBoat, setActiveBoat] = useState<"TAXIBOAT_1"|"TAXIBOAT_2">("TAXIBOAT_1");
  const [cashClosureSummary, setCashClosureSummary] = useState<CashClosureSummary | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [reservationActionId, setReservationActionId] = useState<string | null>(null);
  const [tripActionId, setTripActionId] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // form
  const [firstName, setFirstName] = useState("");
  const [customerCountry, setCustomerCountry] = useState("ES");
  const [serviceId, setServiceId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pax, setPax] = useState(2);
  const [extraServiceId, setExtraServiceId] = useState("");
  const [extraQuantity, setExtraQuantity] = useState(1);
  const [channelId, setChannelId] = useState<string>(""); // opcional
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("CARD");
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
    <AlertBanner tone="warning" title="Caja cerrada">
      No se pueden registrar cobros en este turno. Si hay que reabrir, pídeselo a Admin.
    </AlertBanner>
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

const filteredChannels = useMemo(() => {
  const wantsExternalChannel = selectedService?.isExternalActivity === true;
  const preferred = channels.filter((channel) =>
    wantsExternalChannel ? channel.kind === "EXTERNAL_ACTIVITY" : channel.kind !== "EXTERNAL_ACTIVITY"
  );
  return preferred.length > 0 ? preferred : channels;
}, [channels, selectedService]);

const selectedChannel = useMemo(() => {
  return filteredChannels.find((channel) => channel.id === channelId) ?? channels.find((channel) => channel.id === channelId) ?? null;
}, [filteredChannels, channels, channelId]);

useEffect(() => {
  const policy = resolveDiscountPolicy({ channel: selectedChannel });
  setDiscountResponsibility(policy.discountResponsibility);
  setPromoterDiscountSharePct((policy.promoterDiscountShareBps / 100).toFixed(2));
}, [selectedChannel]);

const isExternalCharge = selectedChannel?.kind === "EXTERNAL_ACTIVITY" || selectedService?.isExternalActivity === true;

const countryOptions = useMemo(() => getCountryOptionsEs(), []);
const selectedCountryOpt = useMemo(() => {
  const v = String(customerCountry ?? "").toUpperCase();
  return countryOptions.find((c) => c.value === v) ?? null;
}, [customerCountry, countryOptions]);

const getServiceById = useCallback(
  (id: string) => services.find((service) => service.id === id) ?? servicesExtra.find((service) => service.id === id) ?? null,
  [services, servicesExtra]
);

const getOptionById = useCallback(
  (id: string | null) => (id ? options.find((option) => option.id === id) ?? null : null),
  [options]
);

const getCartItemUnitPriceCents = useCallback(
  (item: CartItem) => {
    if (item.isExtra) return Number(extraPriceByServiceId[item.serviceId] ?? 0) || 0;
    return Number(getOptionById(item.optionId)?.basePriceCents ?? 0) || 0;
  },
  [extraPriceByServiceId, getOptionById]
);

const getCartItemLabel = useCallback(
  (item: CartItem) => {
    const service = getServiceById(item.serviceId);
    if (item.isExtra) return `${service?.name ?? "Extra"} · extra`;
    const option = getOptionById(item.optionId);
    return `${service?.name ?? "Servicio"}${option?.durationMinutes ? ` · ${option.durationMinutes} min` : ""}`;
  },
  [getOptionById, getServiceById]
);

const effectiveItems = useMemo<CartItem[]>(
  () =>
    cartItems.length > 0
      ? cartItems
      : serviceId && optionId
        ? [
            {
              id: "current",
              serviceId,
              optionId,
              quantity: Math.max(1, Number(quantity || 1)),
              pax: Math.max(1, Number(pax || 1)),
              isExtra: false,
            },
          ]
        : [],
  [cartItems, optionId, pax, quantity, serviceId]
);

const baseTotalCents = useMemo(
  () =>
    effectiveItems.reduce(
      (sum, item) => sum + getCartItemUnitPriceCents(item) * Math.max(1, Number(item.quantity || 1)),
      0
    ),
  [effectiveItems, getCartItemUnitPriceCents]
);

const maxManualDiscountCents = useMemo(() => Math.floor(baseTotalCents * 0.3), [baseTotalCents]);
const discountCentsRaw = useMemo(() => toCentsFromEuroInput(discountEuros), [discountEuros]);
const discountCentsClamped = useMemo(
  () => Math.max(0, Math.min(discountCentsRaw, maxManualDiscountCents)),
  [discountCentsRaw, maxManualDiscountCents]
);
const finalTotalCents = useMemo(
  () => Math.max(0, baseTotalCents - discountCentsClamped),
  [baseTotalCents, discountCentsClamped]
);

const commissionServiceId = useMemo(
  () => effectiveItems.find((item) => !item.isExtra)?.serviceId ?? selectedService?.id ?? null,
  [effectiveItems, selectedService]
);

const commissionPct = useMemo(() => {
  if (!selectedChannel?.commissionEnabled || !commissionServiceId) return 0;

  const specificRule = selectedChannel.commissionRules?.find((rule) => rule.serviceId === commissionServiceId);
  if (specificRule) {
    return searidersPctFromChannelPct(Number(specificRule.commissionPct ?? 0), selectedChannel.kind);
  }

  return searidersPctFromChannelPct(Number(selectedChannel.commissionBps ?? 0) / 100, selectedChannel.kind);
}, [commissionServiceId, selectedChannel]);

const commissionBreakdown = useMemo(
  () =>
    computeCommissionableBase({
      grossBaseCents: baseTotalCents,
      totalDiscountCents: discountCentsClamped,
      responsibility: discountResponsibility,
      promoterDiscountShareBps: Math.round(Number(promoterDiscountSharePct || "0") * 100),
    }),
  [baseTotalCents, discountCentsClamped, discountResponsibility, promoterDiscountSharePct]
);

const commissionCents = useMemo(
  () => Math.round(commissionBreakdown.commissionBaseCents * (commissionPct / 100)),
  [commissionBreakdown.commissionBaseCents, commissionPct]
);
const netAfterCommissionCents = useMemo(() => Math.max(0, finalTotalCents - commissionCents), [finalTotalCents, commissionCents]);

const load = useCallback(async () => {
  setError(null);
  const [catalogRes, summaryRes, reservationsRes, tripsRes, opsRes] =
    await Promise.allSettled([
      fetch("/api/pos/catalog?origin=BOOTH", { cache: "no-store" }),
      fetch("/api/store/cash-closures/summary?origin=BOOTH", { cache: "no-store" }),
      fetch("/api/booth/reservations/today", { cache: "no-store" }),
      fetch("/api/booth/taxiboat-trips/today", { cache: "no-store" }),
      fetch("/api/platform/taxiboat-operations", { cache: "no-store" }),
    ]);

  const errors: string[] = [];

  if (catalogRes.status === "fulfilled" && catalogRes.value.ok) {
    const data = await catalogRes.value.json();

    setServices(data.services ?? []);
    setServicesExtra(data.servicesExtra ?? []);
    setOptions(data.options ?? []);
    setExtraPriceByServiceId(data.extraPriceByServiceId ?? {});
    setChannels(data.channels ?? []);

    const firstCategory = (data.services ?? [])[0]?.category ?? "";
    setCategory((prev) => prev || firstCategory);

    const initialServices = data.services ?? [];
    const initialFiltered = firstCategory
      ? initialServices.filter((s: Service) => s.category === firstCategory)
      : initialServices;

    const s0 = initialFiltered[0] ?? initialServices[0];
    setServiceId((prev) => prev || s0?.id || "");

    const firstOpt = (data.options ?? []).find(
      (o: Option) => o.serviceId === (s0?.id ?? "")
    );
    setOptionId((prev) => prev || firstOpt?.id || "");
    setExtraServiceId((prev) => prev || data.servicesExtra?.[0]?.id || "");
  } else if (catalogRes.status === "rejected") {
    errors.push("No se pudo cargar el catálogo de Booth.");
  }

  if (summaryRes.status === "fulfilled") {
    if (summaryRes.value.ok) {
      setCashClosureSummary(await summaryRes.value.json());
    } else {
      setCashClosureSummary({ ok: false, error: await summaryRes.value.text() });
    }
  } else {
    errors.push("No se pudo cargar el estado de caja.");
  }

  if (reservationsRes.status === "fulfilled") {
    if (reservationsRes.value.ok) {
      const data = await reservationsRes.value.json();
      setRows(data.rows ?? []);
    } else {
      errors.push("No se pudieron cargar las reservas de Booth.");
    }
  } else {
    errors.push("No se pudieron cargar las reservas de Booth.");
  }

  if (tripsRes.status === "fulfilled") {
    if (tripsRes.value.ok) {
      const data = await tripsRes.value.json();
      setTrips(data.trips ?? []);
    } else {
      errors.push("No se pudieron cargar los viajes de taxiboat.");
    }
  } else {
    errors.push("No se pudieron cargar los viajes de taxiboat.");
  }

  if (opsRes.status === "fulfilled") {
    if (opsRes.value.ok) {
      const data = await opsRes.value.json();
      setTaxiboatOps(data.rows ?? []);
    } else {
      errors.push("No se pudo cargar el estado de taxiboat.");
    }
  } else {
    errors.push("No se pudo cargar el estado de taxiboat.");
  }

  if (errors.length > 0) {
    setError(errors[0]);
  }
}, []);

const activeTrip = trips.find((t) => t.id === activeTripId);
const openTripOptions = useMemo(() => trips.filter((t) => t.status === "OPEN"), [trips]);

const activeTripLabel = activeTrip
  ? `${activeTrip.boat} · ${activeTrip.status} · PAX ${activeTrip.paxTotal ?? 0}${
      activeTrip.departedAt
        ? ` · salió ${new Date(activeTrip.departedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
        : ""
    }`
  : "";
const reservationsPending = useMemo(() => rows.filter((r) => (r.pendingCents ?? 0) > 0).length, [rows]);
const reservationsReceived = useMemo(() => rows.filter((r) => Boolean(r.arrivedStoreAt)).length, [rows]);
const openTrips = openTripOptions.length;
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

function addActivityToCart() {
  if (isExternalCharge) throw new Error("Las actividades externas no usan carrito.");
  if (!serviceId) throw new Error("Servicio requerido");
  if (!optionId) throw new Error("Duración requerida");
  if (Number(quantity) < 1) throw new Error("Cantidad inválida");
  if (Number(pax) < 1) throw new Error("PAX inválido");

  setCartItems((prev) => {
    const idx = prev.findIndex((item) => !item.isExtra && item.serviceId === serviceId && item.optionId === optionId);
    if (idx >= 0) {
      const next = prev.slice();
      next[idx] = { ...next[idx], quantity: next[idx].quantity + Math.max(1, Number(quantity || 1)) };
      return next;
    }

    return [
      ...prev,
      {
        id: crypto.randomUUID(),
        serviceId,
        optionId,
        quantity: Math.max(1, Number(quantity || 1)),
        pax: Math.max(1, Number(pax || 1)),
        isExtra: false,
      },
    ];
  });
}

function addExtraToCart() {
  if (!extraServiceId) throw new Error("Selecciona un extra.");
  if (Number(extraQuantity) < 1) throw new Error("Cantidad inválida.");

  setCartItems((prev) => {
    const idx = prev.findIndex((item) => item.isExtra && item.serviceId === extraServiceId);
    if (idx >= 0) {
      const next = prev.slice();
      next[idx] = { ...next[idx], quantity: next[idx].quantity + Math.max(1, Number(extraQuantity || 1)) };
      return next;
    }

    return [
      ...prev,
      {
        id: crypto.randomUUID(),
        serviceId: extraServiceId,
        optionId: null,
        quantity: Math.max(1, Number(extraQuantity || 1)),
        pax: 1,
        isExtra: true,
      },
    ];
  });
}

function removeCartItem(id: string) {
  setCartItems((prev) => prev.filter((item) => item.id !== id));
}

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

  useLiveRefresh(load, {
    intervalMs: 45_000,
    refreshOnFocus: true,
    refreshOnVisible: true,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTripId && openTripOptions.some((trip) => trip.id === activeTripId)) return;

    const firstOpenTripId = openTripOptions[0]?.id ?? "";
    if (activeTripId !== firstOpenTripId) {
      setActiveTripId(firstOpenTripId);
    }
  }, [activeTripId, openTripOptions]);

  useEffect(() => {
    // si cambia el servicio, selecciona primera opcion
    if (serviceId) {
      const first = options.find(o => o.serviceId === serviceId);
      if (first) setOptionId(first.id);
    }
  }, [serviceId, options]);

useEffect(() => {
  if (!channelId) return;
  if (filteredChannels.some((channel) => channel.id === channelId)) return;
  setChannelId("");
}, [channelId, filteredChannels]);

  async function createPre(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const customerName = String(firstName ?? "").trim();
    if (!customerName) {
      setError("Nombre requerido");
      return;
    }
    if (isExternalCharge && cartItems.length > 0) {
      setError("Los cobros externos no admiten carrito ni extras.");
      return;
    }

    const itemsToSend =
      cartItems.length > 0
        ? cartItems.map((item) => ({
            serviceId: item.serviceId,
            optionId: item.optionId,
            quantity: item.quantity,
            pax: item.pax,
            isExtra: item.isExtra,
          }))
        : [
            {
              serviceId,
              optionId,
              quantity: Math.max(1, Number(quantity || 1)),
              pax: Math.max(1, Number(pax || 1)),
              isExtra: false,
            },
          ];

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
        discountResponsibility,
        promoterDiscountSharePct,
        boothNote: boothNote.trim() || null,
        paymentMethod: isExternalCharge ? paymentMethod : null,
        items: itemsToSend,
      }),
    });

    if (!r.ok) {
      setError(await r.text());
      return;
    }

    const j = await r.json();
    if (j.mode === "payment") {
      alert(
        `Comisión registrada: ${euros(j.amountCents ?? j.commissionCents ?? 0)} · Venta externa ${euros(j.grossAmountCents ?? finalTotalCents)} · Comisión Seariders ${Number(j.commissionPct ?? 0).toFixed(2)}%`
      );
    } else {
      alert(`Creada. Código: ${j.boothCode}`);
    }

    setFirstName("");
    setQuantity(1);
    setPax(2);
    setCartItems([]);
    setDiscountEuros("");
    setPromoterDiscountSharePct("50");
    setBoothNote("");
    setPaymentMethod("CARD");
    setExtraQuantity(1);

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

async function unassignReservationFromTrip(reservationId: string) {
  setError(null);
  setReservationActionId(`unassign:${reservationId}`);
  try {
    const r = await fetch("/api/booth/taxiboat-trips/unassign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId }),
    });
    if (!r.ok) throw new Error(await r.text());
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error desasignando viaje");
  } finally {
    setReservationActionId(null);
  }
}

async function cancelReservation(reservationId: string) {
  const reservation = rows.find((row) => row.id === reservationId);
  const boothPaidCents = Math.max(0, Number(reservation?.paidCents ?? 0));
  const confirmMessage =
    boothPaidCents > 0
      ? `Se cancelará la reserva y se devolverán ${euros(boothPaidCents)} en caja de carpa. Esta acción no se puede deshacer.`
      : "Se cancelará la reserva. Esta acción no se puede deshacer.";

  if (!window.confirm(confirmMessage)) {
    return;
  }

  setError(null);
  setReservationActionId(`cancel:${reservationId}`);
  try {
    const r = await fetch(`/api/booth/reservations/${reservationId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) {
      const raw = await r.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        if (parsed?.error) message = parsed.error;
      } catch {}
      throw new Error(message || "Error cancelando reserva");
    }
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error cancelando reserva");
  } finally {
    setReservationActionId(null);
  }
}

async function departTrip(tripId: string) {
  setError(null);
  setTripActionId(`depart:${tripId}`);
  try {
    const r = await fetch("/api/booth/taxiboat-trips/depart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!r.ok) {
      const raw = await r.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        if (parsed?.error) message = parsed.error;
      } catch {}
      throw new Error(message || "Error marcando salida");
    }
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error marcando salida");
  } finally {
    setTripActionId(null);
  }
}

async function cancelTrip(tripId: string) {
  if (!window.confirm("Se anulará el viaje abierto de taxiboat. Esta acción no se puede deshacer.")) {
    return;
  }

  setError(null);
  setTripActionId(`cancel-trip:${tripId}`);
  try {
    const r = await fetch("/api/booth/taxiboat-trips/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!r.ok) throw new Error(await r.text());
    if (activeTripId === tripId) setActiveTripId("");
    await load();
  } catch (e: unknown) {
    setError(e instanceof Error ? e.message : "Error anulando viaje");
  } finally {
    setTripActionId(null);
  }
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
        onReload={() => {
          void load();
        }}
      />

      {error ? <AlertBanner tone="danger" title="Error operativo">{error}</AlertBanner> : null}
      <CashClosedBanner />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>
          <BoothPreReservationFormSection
            fieldStyle={fieldStyle}
            firstName={firstName}
            customerCountry={customerCountry}
            serviceId={serviceId}
            optionId={optionId}
            quantity={quantity}
            pax={pax}
            channelId={channelId}
            paymentMethod={paymentMethod}
            category={category}
            categories={categories}
            services={services}
            servicesFiltered={servicesFiltered}
            servicesExtra={servicesExtra}
            options={options}
            optionsForService={optionsForService}
            channels={filteredChannels}
            selectedService={selectedService}
            selectedChannel={selectedChannel}
            isExternalCharge={isExternalCharge}
            selectedCountryOpt={selectedCountryOpt}
            countryOptions={countryOptions}
            discountEuros={discountEuros}
            boothNote={boothNote}
            maxManualDiscountCents={maxManualDiscountCents}
            baseTotalCents={baseTotalCents}
            discountCentsRaw={discountCentsRaw}
            discountCentsClamped={discountCentsClamped}
            finalTotalCents={finalTotalCents}
            commissionPct={commissionPct}
            commissionCents={commissionCents}
            netAfterCommissionCents={netAfterCommissionCents}
            discountResponsibility={discountResponsibility}
            promoterDiscountSharePct={promoterDiscountSharePct}
            promoterDiscountCents={commissionBreakdown.promoterDiscountCents}
            companyDiscountCents={commissionBreakdown.companyDiscountCents}
            commissionBaseCents={commissionBreakdown.commissionBaseCents}
            cartItems={cartItems}
            extraServiceId={extraServiceId}
            extraQuantity={extraQuantity}
            euros={euros}
            getCartItemLabel={getCartItemLabel}
            getCartItemUnitPriceCents={getCartItemUnitPriceCents}
            onSubmit={createPre}
            onAddActivity={addActivityToCart}
            onAddExtra={addExtraToCart}
            onRemoveCartItem={removeCartItem}
            setFirstName={setFirstName}
            setCustomerCountry={setCustomerCountry}
            setServiceId={setServiceId}
            setOptionId={setOptionId}
            setQuantity={setQuantity}
            setPax={setPax}
            setChannelId={setChannelId}
            setPaymentMethod={setPaymentMethod}
            setCategory={setCategory}
            setDiscountEuros={setDiscountEuros}
            setDiscountResponsibility={setDiscountResponsibility}
            setPromoterDiscountSharePct={setPromoterDiscountSharePct}
            setBoothNote={setBoothNote}
            setExtraServiceId={setExtraServiceId}
            setExtraQuantity={setExtraQuantity}
          />

          <BoothPreReservationsSection
            cardStyle={cardStyle}
            darkBtn={darkBtn}
            ghostBtn={ghostBtn}
            fieldStyle={fieldStyle}
            preReservationRows={preReservationRows}
            activeTripId={activeTripId}
            activeTripLabel={activeTripLabel}
            payingId={payingId}
            isCashClosed={isCashClosed}
            reservationActionId={reservationActionId}
            getSplit={getSplit}
            setSplitLine={setSplitLine}
            assignToActiveTrip={assignToActiveTrip}
            unassignReservationFromTrip={unassignReservationFromTrip}
            cancelReservation={cancelReservation}
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
          cancelTrip={cancelTrip}
          markArrivedBooth={markArrivedBooth}
          reservationActionId={reservationActionId}
          tripActionId={tripActionId}
          unassignReservationFromTrip={unassignReservationFromTrip}
          cancelReservation={cancelReservation}
          boatLabel={boatLabel}
          formatReservationLine={formatReservationLine}
          getTaxiboatReturnMeta={getTaxiboatReturnMeta}
          getTaxiboatWaitMeta={getTaxiboatWaitMeta}
        />
      </div>
    </div>
  );
}
