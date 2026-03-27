// src/app/store/create/page.tsx
"use client";
import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCountryOptionsEs } from "@/lib/countries";
import { BUSINESS_TZ, shouldAutoFormalize } from "@/lib/tz-business";
import { needsContractForCategory } from "@/lib/reservation-rules";
import { AvailabilitySection, PricingSection, SubmitSection } from "./components/form-sections";
import { ReservationBasicsSection } from "./components/reservation-basics-section";
import { CartSection, ContractsSection } from "./components/store-sections";
import { useAvailability, useContractsState, useDiscountPreview, useReservationPrefill } from "./hooks/store-create-hooks";
import { buildCreateBody, buildEditUpdateBody, buildFormalizeBody, buildItemsToSend } from "./services/store-create-submit";
import { validateBeforeSubmit, validateItemsForCreate } from "./services/store-create-validation";
import { ensureOkResponse, errorMessage, isAbortError, throwValidationError } from "./utils/errors";
import type { CartItem, Channel, Option, PackPreview, ServiceMain, UIMode } from "./types";
import { getAssetAvailability, type AssetAvailability } from "../services/assets";

type CustomerSearchRow = {
  reservationId: string;
  customerName: string | null;
  email: string | null;
  phone: string | null;
  customerDocNumber: string | null;
  country: string | null;
  birthDate: string | null;
  address: string | null;
  postalCode: string | null;
  licenseNumber: string | null;
  lastActivityAt: string | null;
};

function todayMadridYMD() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function hhmmNowRounded(step = 5) {
  const d = new Date();
  const m = Math.round(d.getMinutes() / step) * step;
  d.setMinutes(m, 0, 0);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function StoreCreatePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const modeParam = sp.get("mode");
  const boothCodeParam = (sp.get("boothCode") ?? "").trim().toUpperCase();
  const showBoothBadge = Boolean(boothCodeParam);
  const giftCodeParam = (sp.get("giftCode") ?? "").trim().toUpperCase();
  const showGiftBadge = Boolean(giftCodeParam);

  const migrateReservationId = sp.get("migrateFrom") || sp.get("migrateReservationId") || null;
  const editReservationId = sp.get("editFrom") || null;

  const isMigrateMode = Boolean(migrateReservationId);
  const isEditMode = Boolean(editReservationId);

  const [companions, setCompanions] = useState<number>(0);
  const prefillReservationId = migrateReservationId || editReservationId;
  const defaultDate = sp.get("date") ?? todayMadridYMD();

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState(defaultDate);
  const [timeStr, setTimeStr] = useState<string>("");
  const [availabilityTick, setAvailabilityTick] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [assetAvailability, setAssetAvailability] = useState<AssetAvailability[]>([]);

  const [servicesMain, setServicesMain] = useState<ServiceMain[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categoriesMain, setCategoriesMain] = useState<string[]>([]);
  const [packPreview, setPackPreview] = useState<PackPreview | null>(null);

  const [category, setCategory] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [optionId, setOptionId] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");

  const [customerName, setCustomerName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pax, setPax] = useState(2);
  const [quantity, setQuantity] = useState(1);
  const [isLicense, setIsLicense] = useState(false);
  const [licenseSchool, setLicenseSchool] = useState("");
  const [licenseType, setLicenseType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCountry, setCustomerCountry] = useState("ES");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [customerBirthDate, setCustomerBirthDate] = useState("");
  const [customerDocType, setCustomerDocType] = useState("");
  const [customerDocNumber, setCustomerDocNumber] = useState("");
  const [marketingSource, setMarketingSource] = useState("");

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerSearchRow[]>([]);
  const [customerSearchBusy, setCustomerSearchBusy] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);

  const [manualDiscountEuros, setManualDiscountEuros] = useState<number>(0);
  const [manualDiscountReason, setManualDiscountReason] = useState<string>("");

  const applyPrefillReservation = useCallback(
    (res: {
      customerName?: string | null;
      pax?: number | null;
      quantity?: number | null;
      isLicense?: boolean | null;
      serviceId?: string | null;
      optionId?: string | null;
      channelId?: string | null;
      licenseSchool?: string | null;
      licenseType?: string | null;
      licenseNumber?: string | null;
      customerPhone?: string | null;
      customerEmail?: string | null;
      customerCountry?: string | null;
      customerAddress?: string | null;
      customerPostalCode?: string | null;
      customerBirthDate?: string | null;
      customerDocType?: string | null;
      customerDocNumber?: string | null;
      marketing?: string | null;
      companionsCount?: number | null;
    }) => {
      setCustomerName(res.customerName ?? "");
      setPax(Number(res.pax ?? 1));
      setQuantity(Number(res.quantity ?? 1));
      setIsLicense(Boolean(res.isLicense));
      setServiceId(res.serviceId ?? "");
      setOptionId(res.optionId ?? "");
      setChannelId(res.channelId ?? "");
      setLicenseSchool(res.licenseSchool ?? "");
      setLicenseType(res.licenseType ?? "");
      setLicenseNumber(res.licenseNumber ?? "");
      setCustomerPhone(res.customerPhone ?? "");
      setCustomerEmail(res.customerEmail ?? "");
      setCustomerCountry(res.customerCountry ?? "ES");
      setCustomerAddress(res.customerAddress ?? "");
      setCustomerPostalCode(res.customerPostalCode ?? "");
      setCustomerBirthDate(res.customerBirthDate ? new Date(res.customerBirthDate).toISOString().slice(0, 10) : "");
      setCustomerDocType(res.customerDocType ?? "");
      setCustomerDocNumber(res.customerDocNumber ?? "");
      setMarketingSource(res.marketing ?? "");
      setCompanions(res.companionsCount ?? 0);
    },
    []
  );

  const { migrateLoading, migrateError, migrateFlags } = useReservationPrefill({
    prefillReservationId,
    optionsLength: options.length,
    applyReservation: applyPrefillReservation,
    setDateStr,
    setTimeStr,
  });

  const {
  contractsLoading,
  contractsError,
  contracts,
  requiredUnits,
  readyCount,
  refreshContracts,
} = useContractsState({
  isMigrateMode,
  prefillReservationId,
  isHistorical: Boolean(migrateFlags?.isHistorical),
});

  const { availability, availabilityLoading, availabilityError } = useAvailability(dateStr, availabilityTick);

  // opcional: si entras en edit y ya hay customerName, lo separa "a lo bestia" una vez
  useEffect(() => {
    const t = String(customerName ?? "").trim();
    if (!t) return;
    const parts = t.split(/\s+/);
    if (!firstName && !lastName && parts.length) {
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName]);

  // Cuando cambia el "contexto" (servicio/categoría/pack), limpiamos la hora seleccionada
  useEffect(() => {
    setTimeStr("");
  }, [serviceId, category, optionId]);

  useEffect(() => {
    if (isEditMode || isMigrateMode) return;

    const u = new URL(window.location.href);
    const isToday = dateStr === todayMadridYMD();

    u.searchParams.set("mode", isToday ? "today" : "future");
    window.history.replaceState({}, "", u.toString());
  }, [dateStr, isEditMode, isMigrateMode]);

  // Cargar catálogo
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      setLoadingCatalog(true);
      setError(null);

  try {
    const [catalogRes, assetsData] = await Promise.all([
      fetch("/api/pos/catalog?origin=STORE", { cache: "no-store", signal: ac.signal }),
      getAssetAvailability(),
    ]);

    if (!catalogRes.ok) throw new Error(await catalogRes.text());
    const data = await catalogRes.json();

    const sm = (data?.servicesMain ?? []) as ServiceMain[];
    const op = (data?.options ?? []) as Option[];
    const ch = (data?.channels ?? []) as Channel[];

    setServicesMain(sm);
    setOptions(op);
    setChannels(ch);
    setCategoriesMain(((data?.categories?.main ?? []) as string[]) ?? []);
    setAssetAvailability(assetsData.rows ?? []);

    if (!migrateReservationId) {
      const main0 = (data.servicesMain ?? [])[0];
      if (main0) {
        setServiceId(main0.id);
        const firstOpt =
          ((data.options ?? []) as Option[]).find((o) => o.serviceId === main0.id) ??
          null;
        setOptionId(firstOpt?.id ?? "");
      } else {
        setServiceId("");
        setOptionId("");
      }

      const ch0 = (data.channels ?? [])[0];
      setChannelId(ch0?.id ?? "");
    }
  } catch (e: unknown) {
    if (isAbortError(e)) return;
    setError(errorMessage(e, "No se pudo cargar el catálogo"));
  } finally {
    setLoadingCatalog(false);
  }
    })();

    return () => ac.abort();
  }, [migrateReservationId]);

  useEffect(() => {
    if (!isLicense) {
      setLicenseSchool("");
      setLicenseType("");
      setLicenseNumber("");
    }
  }, [isLicense]);
          
  // Hora por defecto si es hoy
  useEffect(() => {
    const today = todayMadridYMD();
    if (dateStr === today && (!timeStr || !timeStr.trim())) {
      setTimeStr(hhmmNowRounded(5));
    }
  }, [dateStr, timeStr]);

  const selectedService = useMemo(
    () => servicesMain.find((s) => s.id === serviceId) ?? null,
    [servicesMain, serviceId]
  );

  useEffect(() => {
    if (!selectedService) return;
    setIsLicense(Boolean(selectedService.isLicense));
  }, [selectedService]);

  const isPackMode = (selectedService?.category ?? "").toUpperCase() === "PACK";
  const canAddToCart = !isPackMode && !!serviceId && !!optionId && Number(quantity) > 0 && Number(pax) > 0;
  
  useEffect(() => {
    if (isPackMode) setCartItems([]);
  }, [isPackMode]);

  // Filtrar servicios por categoría (solo modo normal)
  const servicesMainFiltered = useMemo(() => {
    if (!category) return servicesMain;
    return servicesMain.filter((s) => (s.category ?? "") === category);
  }, [servicesMain, category]);

  // Categoría real del servicio seleccionado (fuente de verdad para availability)
  const selectedCategory = useMemo(() => {
    if (!serviceId) return "";
    const svc = servicesMain.find((s) => s.id === serviceId);
    return String(svc?.category ?? "").toUpperCase();
  }, [serviceId, servicesMain]);

  // Opciones del servicio seleccionado (en tu API ya vienen filtradas por servicios visibles)
  const filteredOptions = useMemo(() => {
    if (!serviceId) return [];
    return options.filter((o) => o.serviceId === serviceId);
  }, [options, serviceId]);

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const cartSubtotalCents = useMemo(() => {
    if (isPackMode) return 0; // pack se calcula aparte

    if (!cartItems.length) {
      const opt = optionById.get(optionId);
      const unit = Number(opt?.basePriceCents ?? 0) || 0;
      return unit * Number(quantity || 0);
    }

    let sum = 0;
    for (const it of cartItems) {
      const opt = optionById.get(it.optionId);
      const unit = Number(opt?.basePriceCents ?? 0) || 0;
      sum += unit * Number(it.quantity || 0);
    }
    return sum;
  }, [isPackMode, cartItems, optionId, quantity, optionById]);

  function normalizeAssetName(v: string) {
    return String(v ?? "").trim().toUpperCase();
  }

  function isGoProName(v: string) {
    const s = normalizeAssetName(v);
    return s.includes("GOPRO");
  }

  function isWetsuitName(v: string) {
    const s = normalizeAssetName(v);
    return s.includes("NEOPRENO");
  }

  function extractWetsuitSize(v: string): string | null {
    const s = normalizeAssetName(v);
    const match = s.match(/\b(XXS|XS|S|M|L|XL|XXL)\b/);
    return match?.[1] ?? null;
  }

  function getAvailableGoPro() {
    const row = assetAvailability.find((r) => r.type === "GOPRO");
    return row?.available ?? 0;
  }

  function getAvailableWetsuit(size: string | null) {
    const row = assetAvailability.find(
      (r) => r.type === "WETSUIT" && (r.size ?? null) === (size ?? null)
    );
    return row?.available ?? 0;
  }

  function getServiceNameById(serviceId: string) {
    return servicesMain.find((s) => s.id === serviceId)?.name ?? "";
  }

  function getMaxAllowedForCartItem(item: CartItem) {
    const serviceName = getServiceNameById(item.serviceId);

    if (isGoProName(serviceName)) {
      return getAvailableGoPro();
    }

    if (isWetsuitName(serviceName)) {
      const size = extractWetsuitSize(serviceName);
      return getAvailableWetsuit(size);
    }

    return Number.POSITIVE_INFINITY;
  }

  // Si cambia service, ajustar optionId (solo normal)
  useEffect(() => {
    if (!filteredOptions.length) {
      setOptionId("");
      return;
    }

    if (!filteredOptions.some((o) => o.id === optionId)) {
      const withPrice =
        filteredOptions.find((o) => (o.hasPrice ?? true) && (o.basePriceCents ?? 0) > 0) ??
        filteredOptions[0];

      setOptionId(withPrice.id);
    }
  }, [filteredOptions, optionId]);

  const selectedOpt = useMemo(() => options.find((o) => o.id === optionId) ?? null, [options, optionId]);

  useEffect(() => {
    // si no hay serviceId elegido, elige el primero según categoría actual
    if (!serviceId) {
      const list = category
        ? servicesMain.filter((s) => (s.category ?? "") === category)
        : servicesMain;
      const s0 = list[0];
      if (s0) setServiceId(s0.id);
    }

    // fuerza a elegir hora de nuevo al salir de pack (evita arrastres)
    setTimeStr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, servicesMain]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPackPreview(null);
      if (selectedCategory !== "PACK" || !serviceId) return;
      const r = await fetch(`/api/store/packs?serviceId=${serviceId}`, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (alive) setPackPreview(j.pack);
    })();
    return () => {
      alive = false;
    };
  }, [selectedCategory, serviceId]);

  const baseTotalCents = useMemo(() => {
    if (!selectedOpt) return 0;
    const unit = Number(selectedOpt.basePriceCents ?? 0) || 0;
    return unit * Number(quantity || 0);
  }, [selectedOpt, quantity]);

  const canCreate = Boolean(
    serviceId &&
    optionId &&
    selectedOpt &&
    (selectedOpt.hasPrice ?? true) &&
    (Number(selectedOpt.basePriceCents ?? 0) || 0) > 0
  );

const { discountPreview, discountLoading } = useDiscountPreview({
    isEditMode,
    isMigrateMode,
    cartItemsLength: cartItems.length,
    canCreate,
    baseTotalCents,
    serviceId,
    optionId,
    quantity,
    pax,
    customerCountry,
  });


  useEffect(() => {
    if (!showBoothBadge) return;
    if (isMigrateMode) return;

    // Si viene de booth pero no está en migrate, forzamos visualmente el modo
    const u = new URL(window.location.href);
    if (!u.searchParams.get("migrateFrom")) {
      // No redirigimos fuerte, solo avisamos.
      console.warn("Reserva recibida sin migrateFrom. Se recomienda formalizar.");
    }
  }, [showBoothBadge, isMigrateMode]);

  const isTodayMadridSelected = dateStr === todayMadridYMD();
  const normalizedTime = timeStr?.trim() ? timeStr.trim() : null;
  const shouldAutoFormalizeSelection = shouldAutoFormalize({
    date: dateStr,
    time: normalizedTime,
    tz: BUSINESS_TZ,
    marginMinutes: 5,
  });

  // Si es hoy pero la hora aun es futura, se trata como CREATE (pendiente de formalizar).
  const wantsTodayUi = modeParam !== "future" && shouldAutoFormalizeSelection;

  const uiMode: UIMode =
    isEditMode ? "EDIT"
    : isMigrateMode ? "FORMALIZE"
    : wantsTodayUi ? "FORMALIZE"
    : "CREATE";

  const strictFormalizeBlocked =
    uiMode === "FORMALIZE" && !isMigrateMode && !isEditMode && !isTodayMadridSelected;

  const primaryLabel =
    uiMode === "EDIT" ? "Guardar cambios"
    : uiMode === "FORMALIZE" ? "Formalizar"
    : "Crear";

  // licencia obligatoria solo al formalizar
  const isFormalizeMode = uiMode === "FORMALIZE" && !migrateFlags?.isHistorical;
  const isCreateMode = uiMode === "CREATE";

  const isContractsOnlyMode = Boolean(migrateReservationId);
  const isVoucherFormalizeFlow =
    isContractsOnlyMode && (Boolean(showGiftBadge) || Boolean(migrateFlags?.isGift) || Boolean(migrateFlags?.isPass));
  // (si quieres incluir edit, usa: Boolean(migrateReservationId || editReservationId))

  const formalizeNeedsFullData = useMemo(() => {
    return needsContractForCategory(selectedCategory, false);
  }, [selectedCategory]);

  const phoneRequired = isFormalizeMode || (!isMigrateMode && !isEditMode);
  const formalizeAllRequired = isFormalizeMode && formalizeNeedsFullData;

  const requiredCreateMissing =
    isCreateMode && (!customerName.trim() || !customerPhone.trim());

  const requiredFormalizeMissing = isFormalizeMode && (
    !customerName.trim() ||
    !customerPhone.trim() ||
    (formalizeAllRequired && (
      !customerEmail.trim() ||
      !customerCountry.trim()
    ))
  );
  const contractsReadyForFormalize =
    !isMigrateMode || requiredUnits <= 0 || readyCount >= requiredUnits;

  const primaryDisabledReason =
    migrateFlags?.isHistorical
      ? "Reserva histórica: no se puede formalizar."
      : strictFormalizeBlocked
        ? "Solo puedes formalizar el mismo día."
        : isFormalizeMode && !contractsReadyForFormalize
          ? `Faltan contratos por completar: ${readyCount}/${requiredUnits} listos.`
        : requiredFormalizeMissing
          ? (formalizeAllRequired
              ? "Para formalizar con contrato faltan datos básicos del cliente (teléfono, email y país). Los datos legales se completan en contratos."
              : "Para formalizar faltan datos mínimos (nombre y teléfono).")
          : requiredCreateMissing
            ? "Para crear faltan datos mínimos (nombre y teléfono)."
            : (isCreateMode && !canCreate)
              ? "Esta opción no tiene precio vigente."
              : null;

  const primaryDisabled = Boolean(primaryDisabledReason);

  const countryOptions = useMemo(() => getCountryOptionsEs(), []);
  const selectedCountryOpt = useMemo(
    () => countryOptions.find((o) => o.value === (customerCountry || "").toUpperCase()) ?? null,
    [countryOptions, customerCountry]
  );
  
  const useCart = cartItems.length > 0;
  
  const shownBaseCents = useCart
  ? cartSubtotalCents
  : (discountPreview?.baseTotalCents ?? baseTotalCents);

  const shownDiscountCents = useCart
    ? 0
    : (discountPreview?.autoDiscountCents ?? 0);

  const shownFinalCents = useCart
    ? cartSubtotalCents
    : (discountPreview?.finalTotalCents ?? Math.max(0, shownBaseCents - shownDiscountCents));

  const shownReason = discountPreview?.reason ?? null;

  const MANUAL_DISC_MAX_PCT = 30;
  const maxManualDiscountCents = Math.floor((shownBaseCents * MANUAL_DISC_MAX_PCT) / 100);

  const manualDiscountCentsRaw = Math.round(Number(manualDiscountEuros || 0) * 100);
  const manualDiscountCents = Math.max(0, Math.min(manualDiscountCentsRaw, maxManualDiscountCents));
  const shownFinalCentsWithManual = Math.max(0, shownFinalCents - manualDiscountCents);

  function addToCart() {
    if (!serviceId) throw new Error("Servicio requerido");
    if (!optionId) throw new Error("Duración requerida");
    if (Number(quantity) < 1) throw new Error("Cantidad inválida");
    if (Number(pax) < 1) throw new Error("PAX inválido");

    const serviceName = getServiceNameById(serviceId);

    if (isGoProName(serviceName)) {
      const available = getAvailableGoPro();
      const existingQty = cartItems
        .filter((x) => x.serviceId === serviceId && x.optionId === optionId)
        .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

      const requested = existingQty + Number(quantity);

      if (requested > available) {
        throw new Error(`Solo quedan ${available} GoPro disponibles.`);
      }
    }

    if (isWetsuitName(serviceName)) {
      const size = extractWetsuitSize(serviceName);
      const available = getAvailableWetsuit(size);

      const existingQty = cartItems
        .filter((x) => x.serviceId === serviceId && x.optionId === optionId)
        .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

      const requested = existingQty + Number(quantity);

      if (requested > available) {
        throw new Error(
          `Solo quedan ${available} neoprenos${size ? ` talla ${size}` : ""} disponibles.`
        );
      }
    }

    setCartItems((prev) => {
      const idx = prev.findIndex((x) => x.serviceId === serviceId && x.optionId === optionId);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + Number(quantity) };
        return copy;
      }

    return [
      ...prev,
      {
        id: crypto.randomUUID(),
        serviceId,
        optionId,
        quantity: Number(quantity),
        pax: Number(pax),
      },
    ];
  });
}

  function removeFromCart(id: string) {
      setCartItems((prev) => prev.filter((x) => x.id !== id));
    }

  function updateCartItem(id: string, patch: Partial<Pick<CartItem, "quantity" | "pax">>) {
    setCartItems((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;

        const next = { ...x, ...patch };
        const serviceName = getServiceNameById(next.serviceId);

        if (patch.quantity !== undefined) {
          if (isGoProName(serviceName)) {
            const available = getAvailableGoPro();
            next.quantity = Math.max(1, Math.min(Number(next.quantity || 1), available));
          }

          if (isWetsuitName(serviceName)) {
            const size = extractWetsuitSize(serviceName);
            const available = getAvailableWetsuit(size);
            next.quantity = Math.max(1, Math.min(Number(next.quantity || 1), available));
          }
        }

        return next;
      })
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  async function handleEditSubmit() {
    if (!editReservationId) return;
    validateBeforeSubmit({
      flow: "EDIT",
      customerName,
      quantity,
      pax,
      isVoucherFormalizeFlow,
      serviceId,
      optionId,
      channelId,
      cartItemsLength: cartItems.length,
      canCreate,
      uiMode,
      dateStr,
      todayYmd: todayMadridYMD(),
    });

    const body = buildEditUpdateBody({
      pax,
      isLicense: Boolean(isLicense),
      channelId,
      dateStr,
      timeStr,
      serviceId,
      optionId,
      quantity,
      companions,
      cartItems,
      customerPhone,
      customerEmail,
      customerCountry,
      customerAddress,
      customerPostalCode,
      customerBirthDate,
      customerDocType,
      customerDocNumber,
      marketingSource,
      licenseSchool,
      licenseType,
      licenseNumber,
    });

    const res = await fetch(`/api/store/reservations/${editReservationId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await ensureOkResponse(res, "No se pudo actualizar la reserva");
    const j = await res.json();
    router.push(`/store?reservationId=${j.id}`);
  }

  async function handleMigrateSubmit() {
    if (!migrateReservationId) return;
    validateBeforeSubmit({
      flow: "MIGRATE",
      customerName,
      quantity,
      pax,
      isVoucherFormalizeFlow,
      serviceId,
      optionId,
      channelId,
      cartItemsLength: cartItems.length,
      canCreate,
      uiMode,
      dateStr,
      todayYmd: todayMadridYMD(),
    });

    const body = buildFormalizeBody({
      customerName,
      customerPhone,
      customerEmail,
      customerCountry,
      marketingSource,
      isVoucherFormalizeFlow,
      serviceId,
      optionId,
      channelId,
      quantity,
      pax,
      companions,
      dateStr,
      timeStr,
    });

    const res = await fetch(`/api/store/reservations/${migrateReservationId}/formalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await ensureOkResponse(res, "No se pudo formalizar la reserva");
    const j = await res.json();
    router.push(`/store?reservationId=${j.id}`);
  }

  const searchCustomers = useCallback(async (term: string) => {
    const q = term.trim();

    if (q.length < 2) {
      setCustomerMatches([]);
      setCustomerSearchError(null);
      return;
    }

    try {
      setCustomerSearchBusy(true);
      setCustomerSearchError(null);

      const res = await fetch(
        `/api/store/customers/search?q=${encodeURIComponent(q)}&take=8`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setCustomerMatches(data.rows ?? []);
    } catch (e: unknown) {
      setCustomerSearchError(
        e instanceof Error ? e.message : "Error buscando clientes"
      );
    } finally {
      setCustomerSearchBusy(false);
    }
  }, []);

  useEffect(() => {
    const q = customerSearch.trim();

    if (q.length < 2) {
      setCustomerMatches([]);
      setCustomerSearchError(null);
      return;
    }

    const t = setTimeout(() => {
      searchCustomers(q);
    }, 350);

    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  async function applyCustomerProfile(reservationId: string) {
    try {
      setCustomerSearchError(null);

      const res = await fetch(
        `/api/store/customers/profile?reservationId=${encodeURIComponent(reservationId)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      const p = data.profile;

      if (p.customerName != null) setCustomerName(p.customerName);
      if (p.email != null) setCustomerEmail(p.email);
      if (p.phone != null) setCustomerPhone(p.phone);
      if (p.customerDocNumber != null) setCustomerDocNumber(p.customerDocNumber);
      if (p.country != null) setCustomerCountry(p.country);
      if (p.birthDate != null) setCustomerBirthDate(p.birthDate);
      if (p.address != null) setCustomerAddress(p.address);
      if (p.postalCode != null) setCustomerPostalCode(p.postalCode);
      if (p.licenseNumber != null) setLicenseNumber(p.licenseNumber);

      setCustomerMatches([]);
      setCustomerSearch("");
    } catch (e: unknown) {
      setCustomerSearchError(
        e instanceof Error ? e.message : "Error cargando ficha"
      );
    }
  }

  async function handleCreateSubmit() {
    validateBeforeSubmit({
      flow: "CREATE",
      customerName,
      quantity,
      pax,
      isVoucherFormalizeFlow,
      serviceId,
      optionId,
      channelId,
      cartItemsLength: cartItems.length,
      canCreate,
      uiMode,
      dateStr,
      todayYmd: todayMadridYMD(),
    });

    const time = (timeStr ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throwValidationError("Hora requerida (HH:MM)");
    }

    const itemsToSend = buildItemsToSend({
      isPackMode,
      cartItems,
      serviceId,
      optionId,
      quantity,
      pax,
    });

    validateItemsForCreate(itemsToSend);

    const body = buildCreateBody({
      customerName,
      customerPhone,
      customerEmail,
      customerCountry,
      customerAddress,
      customerPostalCode,
      customerBirthDate,
      customerDocType,
      customerDocNumber,
      marketingSource,
      isLicense: Boolean(isLicense),
      licenseSchool,
      licenseType,
      licenseNumber,
      channelId,
      dateStr,
      time,
      pax,
      companions,
      manualDiscountCents,
      manualDiscountReason,
      itemsToSend,
    });

    const res = await fetch("/api/store/reservations/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await ensureOkResponse(res, "No se pudo crear la reserva");
    const j = await res.json();

    if (!j.autoFormalized) {
      router.push(`/store/calendar?day=${dateStr}`);
      return;
    }
    if (Number(j.requiredContractUnits ?? 0) > 0) {
      router.push(`/store/create?migrateFrom=${j.id}#contracts`);
      return;
    }

    router.push(`/store?reservationId=${j.id}`);
  }

  async function createReservation(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAvailabilityTick((x) => x + 1);

    try {
      if (isEditMode && editReservationId) {
        await handleEditSubmit();
        return;
      }

      if (isMigrateMode && migrateFlags?.isHistorical) {
        router.push(`/store?reservationId=${migrateReservationId}`);
        return;
      }

      if (isMigrateMode && migrateReservationId) {
        await handleMigrateSubmit();
        return;
      }

      await handleCreateSubmit();
      return;
    } catch (err: unknown) {
      const msg = errorMessage(err, "Error");
      const kind = err instanceof Error ? err.name : "UnknownError";
      console.error("[store/create] submit failed", {
        kind,
        message: msg,
        uiMode,
        isEditMode,
        isMigrateMode,
        isVoucherFormalizeFlow,
        migrateReservationId,
        editReservationId,
      });
      setError(msg);
    }
  }

  function updateFullName(nextFirst: string, nextLast: string) {
    const full = `${String(nextFirst ?? "").trim()} ${String(nextLast ?? "").trim()}`.trim();
    setCustomerName(full);
  }

  function handleFirstNameChange(value: string) {
    setFirstName(value);
    updateFullName(value, lastName);
  }

  function handleLastNameChange(value: string) {
    setLastName(value);
    updateFullName(firstName, value);
  }

  function handleCategoryChange(next: string) {
    setCategory(next);

    const list = next ? servicesMain.filter((svc) => (svc.category ?? "") === next) : servicesMain;
    const firstService = list[0] ?? null;
    setServiceId(firstService?.id ?? "");

    const firstOption =
      options.find((opt) => opt.serviceId === (firstService?.id ?? "") && (opt.hasPrice ?? true) && (opt.basePriceCents ?? 0) > 0) ??
      options.find((opt) => opt.serviceId === (firstService?.id ?? "")) ??
      null;
    setOptionId(firstOption?.id ?? "");
  }

  const reservationBasicsSectionProps = {
    values: {
      firstName,
      lastName,
      customerPhone,
      customerEmail,
      customerCountry,
      customerPostalCode,
      marketingSource,
      category,
      serviceId,
      optionId,
      channelId,
      quantity,
      pax,
      companions,
    },
    flags: {
      isEditMode,
      phoneRequired,
      formalizeAllRequired,
      isVoucherFormalizeFlow,
      selectedCategory,
    },
    lists: {
      countryOptions,
      selectedCountryOpt,
      categoriesMain,
      servicesMainFiltered,
      packPreview,
      filteredOptions,
      selectedOpt,
      channels,
    },
    handlers: {
      onFirstNameChange: handleFirstNameChange,
      onLastNameChange: handleLastNameChange,
      onCustomerPhoneChange: setCustomerPhone,
      onCustomerEmailChange: setCustomerEmail,
      onCustomerCountryChange: setCustomerCountry,
      onCustomerAddressChange: setCustomerAddress,
      onCustomerPostalCodeChange: setCustomerPostalCode,
      onCustomerBirthDateChange: setCustomerBirthDate,
      onCustomerDocTypeChange: setCustomerDocType,
      onCustomerDocNumberChange: setCustomerDocNumber,
      onMarketingSourceChange: setMarketingSource,
      onCategoryChange: handleCategoryChange,
      onServiceChange: setServiceId,
      onOptionChange: setOptionId,
      onChannelChange: setChannelId,
      onQuantityChange: setQuantity,
      onPaxChange: setPax,
      onCompanionsChange: setCompanions,
    },
  };

  const shellStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 1040,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  };
  const panelStyle: React.CSSProperties = {
    border: "1px solid #dbe4ea",
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  };
  const secondaryButtonStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontWeight: 900,
    borderRadius: 12,
    border: "1px solid #d0d9e4",
    background: "#fff",
    color: "#111827",
  };
  const badgeStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
  };
  const heroPillStyle: React.CSSProperties = {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid rgba(125, 211, 252, 0.35)",
    background: "rgba(15, 23, 42, 0.24)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
  };
  const statCardStyle: React.CSSProperties = {
    ...panelStyle,
    padding: 16,
    display: "grid",
    gap: 6,
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  };

  return (
    <div style={shellStyle}>
      <section
        style={{
          ...panelStyle,
          padding: 24,
          display: "grid",
          gap: 18,
          background:
            "radial-gradient(circle at top left, rgba(125, 211, 252, 0.22), transparent 28%), radial-gradient(circle at right bottom, rgba(15, 118, 110, 0.14), transparent 24%), linear-gradient(135deg, #0f172a 0%, #0f766e 55%, #082f49 100%)",
          color: "#e0f2fe",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8, maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: "#7dd3fc" }}>
              Store
            </div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, color: "#fff" }}>
              {uiMode === "EDIT" ? "Editar reserva" : uiMode === "FORMALIZE" ? "Formalizar reserva" : "Crear reserva"}
            </h1>
            <div style={{ fontSize: 14, color: "#bae6fd", maxWidth: 700 }}>
              {uiMode === "EDIT"
                ? "Actualiza la reserva sin alterar el flujo operativo. El formulario mantiene el comportamiento actual."
                : uiMode === "FORMALIZE"
                  ? "Completa los datos mínimos, valida contratos y deja la reserva lista para la operativa de tienda."
                  : "Prepara la reserva, revisa precio y disponibilidad y continúa después con el cobro y la operación."}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/store")} style={{ ...secondaryButtonStyle, background: "rgba(255,255,255,0.92)" }}>
              Volver a tienda
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={heroPillStyle}>Modo: {primaryLabel}</span>
          <span style={heroPillStyle}>Fecha: {dateStr}</span>
          <span style={heroPillStyle}>Hora: {timeStr || "--:--"}</span>
          <span style={heroPillStyle}>Carrito: {cartItems.length}</span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={statCardStyle}>
          <div style={summaryMetricLabel}>Disponibilidad</div>
          <div style={summaryMetricValue}>{availabilityLoading ? "..." : availabilityError ? "Error" : "OK"}</div>
        </div>
        <div style={statCardStyle}>
          <div style={summaryMetricLabel}>Precio actual</div>
          <div style={summaryMetricValue}>{euros(shownFinalCentsWithManual)}</div>
        </div>
        <div style={statCardStyle}>
          <div style={summaryMetricLabel}>Contratos</div>
          <div style={summaryMetricValue}>{requiredUnits > 0 ? `${readyCount}/${requiredUnits}` : "No aplica"}</div>
        </div>
        <div style={statCardStyle}>
          <div style={summaryMetricLabel}>Canal</div>
          <div style={summaryMetricValue}>{channels.find((ch) => ch.id === channelId)?.name ?? "Sin canal"}</div>
        </div>
      </section>

      {(isMigrateMode || showBoothBadge || showGiftBadge) ? (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {isMigrateMode ? (
            <div style={{ ...panelStyle, padding: 16, display: "grid", gap: 6, background: migrateFlags?.isHistorical ? "#fff7ed" : "#f8fafc" }}>
              <div style={{ ...badgeStyle, color: migrateFlags?.isHistorical ? "#c2410c" : "#0369a1" }}>
                {migrateFlags?.isHistorical ? "Histórica" : "Formalización"}
              </div>
              <div style={{ fontWeight: 900 }}>
                {migrateFlags?.isHistorical ? "Reserva histórica" : "Formalización desde calendario"}
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                {migrateFlags?.isHistorical
                  ? "Esta reserva es de un día anterior. Se abre en modo consulta o edición operativa."
                  : "Completa los campos mínimos y pulsa Formalizar para continuar en Tienda."}
              </div>
            </div>
          ) : null}

          {showBoothBadge ? (
            <div style={{ ...panelStyle, padding: 16, display: "grid", gap: 6, background: "#f8fafc" }}>
              <div style={{ ...badgeStyle, color: "#0f766e" }}>Carpa / Taxiboat</div>
              <div style={{ fontWeight: 900 }}>Código recibido: {boothCodeParam}</div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                {isMigrateMode
                  ? "Estás formalizando una reserva recibida en carpa."
                  : "Cliente marcado como recibido. Debes formalizar la reserva."}
              </div>
            </div>
          ) : null}

          {showGiftBadge ? (
            <div style={{ ...panelStyle, padding: 16, display: "grid", gap: 6, background: "#fffbeb" }}>
              <div style={{ ...badgeStyle, color: "#a16207" }}>Regalo</div>
              <div style={{ fontWeight: 900 }}>Código: {giftCodeParam}</div>
              <div style={{ fontSize: 13, color: "#475569" }}>Voucher pendiente de formalización.</div>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 14, color: "#991b1b", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {migrateLoading ? <div style={{ color: "#64748b" }}>Cargando reserva...</div> : null}
      {migrateError ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fee2e2", borderRadius: 14, color: "#991b1b", fontWeight: 700 }}>
          {migrateError}
        </div>
      ) : null}

      <section style={panelStyle}>
        <div style={{ padding: 18, borderBottom: "1px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Datos principales</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              Disponibilidad, cliente, carrito y condiciones de formalización en una sola pantalla.
            </div>
          </div>
          {isVoucherFormalizeFlow ? (
            <div style={{ padding: "8px 12px", borderRadius: 999, background: "#fffbeb", color: "#a16207", fontWeight: 900 }}>
              Bono o regalo
            </div>
          ) : null}
        </div>

        <form onSubmit={createReservation} style={{ padding: 18, display: "grid", gap: 16 }}>
          {loadingCatalog ? <div style={{ color: "#64748b" }}>Cargando catálogo...</div> : null}

          {isVoucherFormalizeFlow ? (
            <div style={{ padding: 12, border: "1px solid #fde68a", borderRadius: 14, background: "#fffbeb", fontSize: 13, color: "#713f12" }}>
              Bono o regalo: servicio, duración y cantidad quedan fijados por el canje. Solo completa contratos y formaliza.
            </div>
          ) : null}

          <AvailabilitySection
            dateStr={dateStr}
            onDateChange={setDateStr}
            availabilityLoading={availabilityLoading}
            availabilityError={availabilityError}
            availability={availability}
            selectedCategory={selectedCategory}
            timeStr={timeStr}
            onTimeSelect={setTimeStr}
          />

            <div
              style={{
                border: "1px solid #dde4ee",
                borderRadius: 16,
                background: "#fff",
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Cliente repetidor / recuperar ficha
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar por nombre o documento"
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #d0d9e4",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchCustomers(customerSearch);
                    }
                  }}
                />
              </div>

              {customerSearchBusy ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Buscando coincidencias...</div>
              ) : null}

              {customerSearch.trim().length >= 2 && !customerSearchBusy && customerMatches.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  No se encontraron clientes previos.
                </div>
              ) : null}

              {customerSearchError ? (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #fecaca",
                    background: "#fff1f2",
                    color: "#991b1b",
                  }}
                >
                  {customerSearchError}
                </div>
              ) : null}

              {customerMatches.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {customerMatches.map((c) => (
                    <div
                      key={c.reservationId}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 800 }}>{c.customerName || "Sin nombre"}</div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>
                          {c.customerDocNumber || "Sin documento"} · {c.phone || "Sin teléfono"} · {c.email || "Sin email"}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.65 }}>
                          Última actividad:{" "}
                          {c.lastActivityAt
                            ? new Date(c.lastActivityAt).toLocaleDateString("es-ES")
                            : "—"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyCustomerProfile(c.reservationId)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid #e5e7eb",
                          background: "#fff",
                          fontWeight: 900,
                        }}
                      >
                        Usar ficha
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 12, color: "#16a34a" }}>
              Ficha recuperada de cliente previo
            </div>

          {isContractsOnlyMode ? (
            <details
              open={false}
              style={{
                padding: 16,
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                background: "#fff",
              }}
            >
              <summary style={{ fontWeight: 900, cursor: "pointer" }}>
                Editar datos de cliente y reserva
              </summary>
              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                <ReservationBasicsSection {...reservationBasicsSectionProps} />
              </div>
            </details>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <ReservationBasicsSection {...reservationBasicsSectionProps} />
            </div>
          )}

          {isMigrateMode && !migrateFlags?.isHistorical && prefillReservationId ? (
            <ContractsSection
              reservationId={prefillReservationId}
              readyCount={readyCount}
              requiredUnits={requiredUnits}
              contracts={contracts}
              contractsLoading={contractsLoading}
              contractsError={contractsError}
              requiresLicense={Boolean(isLicense)}
              customer={{
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
                country: customerCountry,
                postalCode: customerPostalCode,
              }}
              onRefresh={() =>
                prefillReservationId
                  ? refreshContracts(prefillReservationId)
                  : Promise.resolve()
              }
            />
          ) : null}

          <CartSection
            isPackMode={isPackMode}
            canAddToCart={canAddToCart}
            cartItems={cartItems}
            servicesMain={servicesMain}
            options={options}
            assetAvailability={assetAvailability}
            getServiceNameById={getServiceNameById}
            onAddToCart={addToCart}
            onClearCart={clearCart}
            onRemoveFromCart={removeFromCart}
            onUpdateCartItem={updateCartItem}
            onError={setError}
          />

          <PricingSection
            discountLoading={discountLoading}
            shownFinalCents={shownFinalCents}
            maxManualDiscountCents={maxManualDiscountCents}
            manualDiscountEuros={manualDiscountEuros}
            onManualDiscountEurosChange={setManualDiscountEuros}
            manualDiscountReason={manualDiscountReason}
            onManualDiscountReasonChange={setManualDiscountReason}
            shownFinalCentsWithManual={shownFinalCentsWithManual}
            manualDiscountCentsRaw={manualDiscountCentsRaw}
            shownDiscountCents={shownDiscountCents}
            shownBaseCents={shownBaseCents}
            shownReason={shownReason ?? ""}
          />

          <SubmitSection
            primaryDisabled={primaryDisabled}
            primaryLabel={primaryLabel}
            primaryDisabledReason={primaryDisabledReason}
          />
        </form>
      </section>

      <div style={{ fontSize: 12, color: "#64748b" }}>
        Nota: extras, contrato y formalización completa seguirán en la pantalla de la reserva (<b>/store?reservationId=...</b>).
      </div>
    </div>
  );
}

export default function StoreCreatePage() {
  return (
    <React.Suspense fallback={<div style={{ padding: 24, color: "#64748b" }}>Cargando...</div>}>
      <StoreCreatePageInner />
    </React.Suspense>
  );
}

function euros(cents: number) {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} €`;
}

const summaryMetricLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const summaryMetricValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 950,
  color: "#0f172a",
};
