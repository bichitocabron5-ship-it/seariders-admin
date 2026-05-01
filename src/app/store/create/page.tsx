// src/app/store/create/page.tsx
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCountryOptionsEs } from "@/lib/countries";
import { BUSINESS_TZ, shouldAutoFormalize } from "@/lib/tz-business";
import { needsContractForCategory } from "@/lib/reservation-rules";
import { getReservationWorkflowState, type ReservationWorkflowResult } from "@/lib/reservation-workflow";
import { opsStyles } from "@/components/ops-ui";
import { computeCommissionableBase, resolveDiscountPolicy } from "@/lib/commission";
import { AvailabilitySection, FutureReservationPaymentsSection, PricingSection, SubmitSection } from "./components/form-sections";
import { ReservationBasicsSection } from "./components/reservation-basics-section";
import { CartSection, ContractsSection } from "./components/store-sections";
import { StoreCreateCustomerProfileSection, StoreCreateSummaryStrip } from "./components/store-create-overview";
import { useAvailability, useContractsState, useCustomerProfileSearch, useDiscountPreview, useReservationPrefill, useStoreCreateCatalog, useStoreCreateSelection } from "./hooks/store-create-hooks";
import { submitStoreCreateCreateFlow, submitStoreCreateEditFlow, submitStoreCreateMigrateFlow } from "./services/store-create-submit-flow";
import { errorMessage } from "./utils/errors";
import type { CartItem, Channel, JetskiLicenseMode, Option, RecoveredContractProfile, ServiceMain, StoreCreateDraft, UIMode } from "./types";
import type { AssetAvailability } from "../services/assets";

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

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

const RECOVERED_CONTRACT_PROFILE_STORAGE_KEY = "store-create-recovered-contract-profile";
const STORE_CREATE_DRAFT_STORAGE_KEY = "store-create-draft";
const STORE_CREATE_DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

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

  const [error, setError] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [dateStr, setDateStr] = useState(defaultDate);
  const [timeStr, setTimeStr] = useState<string>("");
  const [availabilityTick, setAvailabilityTick] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [assetAvailability, setAssetAvailability] = useState<AssetAvailability[]>([]);
  const [servicesMain, setServicesMain] = useState<ServiceMain[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categoriesMain, setCategoriesMain] = useState<string[]>([]);
  const [prefillServiceFallback, setPrefillServiceFallback] = useState<ServiceMain | null>(null);
  const [prefillOptionFallback, setPrefillOptionFallback] = useState<Option | null>(null);
  const [prefillChannelFallback, setPrefillChannelFallback] = useState<Channel | null>(null);
  const [prefillPricing, setPrefillPricing] = useState<{
    basePriceCents: number;
    commissionBaseCents: number;
    manualDiscountCents: number;
    autoDiscountCents: number;
    totalPriceCents: number;
  } | null>(null);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [prefillFormalizedAt, setPrefillFormalizedAt] = useState<string | null>(null);
  const [prefillStatus, setPrefillStatus] = useState<string | null>(null);
  const [prefillWorkflow, setPrefillWorkflow] = useState<ReservationWorkflowResult | null>(null);

  const [category, setCategory] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [optionId, setOptionId] = useState<string>("");
  const [channelId, setChannelId] = useState<string>("");

  const [customerName, setCustomerName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pax, setPax] = useState(2);
  const [quantity, setQuantity] = useState(1);
  const [jetskiLicenseMode, setJetskiLicenseMode] = useState<JetskiLicenseMode>("NONE");
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
  const [boothNote, setBoothNote] = useState("");
  const [recoveredContractProfile, setRecoveredContractProfile] = useState<RecoveredContractProfile | null>(null);

  const [manualDiscountEuros, setManualDiscountEuros] = useState<string>("");
  const [manualDiscountReason, setManualDiscountReason] = useState<string>("");
  const [discountResponsibility, setDiscountResponsibility] = useState<"COMPANY" | "PROMOTER" | "SHARED">("COMPANY");
  const [promoterDiscountSharePct, setPromoterDiscountSharePct] = useState<string>("50");
  const [selectedPromoCode, setSelectedPromoCode] = useState("");
  const [applyPromo, setApplyPromo] = useState(false);
  const [cartDiscountPreviews, setCartDiscountPreviews] = useState<Record<string, { baseTotalCents: number; autoDiscountCents: number; finalTotalCents: number }>>({});
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "BIZUM" | "TRANSFER">("CARD");
  const [paymentAmountEuros, setPaymentAmountEuros] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSummary, setPaymentSummary] = useState({
    totalServiceCents: 0,
    paidServiceCents: 0,
    pendingServiceCents: 0,
  });
  const [draftRecoveredAt, setDraftRecoveredAt] = useState<number | null>(null);
  const [scheduleInvalidationMessage, setScheduleInvalidationMessage] = useState<string | null>(null);
  const skipNextTimeResetRef = useRef(false);
  const scheduleContextRef = useRef<{ serviceId: string; category: string; optionId: string } | null>(null);

  const applyPrefillReservation = useCallback(
    (res: {
      customerName?: string | null;
      boothNote?: string | null;
      pax?: number | null;
      quantity?: number | null;
      isLicense?: boolean | null;
      jetskiLicenseMode?: JetskiLicenseMode | null;
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
      basePriceCents?: number | null;
      commissionBaseCents?: number | null;
      manualDiscountCents?: number | null;
      autoDiscountCents?: number | null;
      discountResponsibility?: "COMPANY" | "PROMOTER" | "SHARED" | null;
      promoterDiscountShareBps?: number | null;
      promoterDiscountCents?: number | null;
      companyDiscountCents?: number | null;
      totalPriceCents?: number | null;
      totalServiceCents?: number | null;
      paidServiceCents?: number | null;
      pendingServiceCents?: number | null;
      formalizedAt?: string | null;
      status?: string | null;
      source?: string | null;
      items?: Array<{
        serviceId: string;
        optionId: string;
        quantity?: number | null;
        pax?: number | null;
        promoCode?: string | null;
      }> | null;
      service?: ServiceMain | null;
      option?: Option | null;
      channel?: Channel | null;
    }) => {
      setCustomerName(res.customerName ?? "");
      setBoothNote(res.boothNote ?? "");
      setPax(Number(res.pax ?? 1));
      setQuantity(Number(res.quantity ?? 1));
      setJetskiLicenseMode(res.jetskiLicenseMode ?? (res.isLicense ? "YELLOW_UNLIMITED" : "NONE"));
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
      setCategory(String(res.service?.category ?? "").toUpperCase());
      setPrefillServiceFallback(res.service ?? null);
      setPrefillOptionFallback(
        res.option
          ? {
              ...res.option,
              hasPrice: Number(res.option.basePriceCents ?? 0) > 0,
            }
          : null
      );
      setPrefillChannelFallback(res.channel ?? null);
      setPrefillPricing({
        basePriceCents: Number(res.basePriceCents ?? res.option?.basePriceCents ?? 0),
        commissionBaseCents: Number(res.commissionBaseCents ?? 0),
        manualDiscountCents: Number(res.manualDiscountCents ?? 0),
        autoDiscountCents: Number(res.autoDiscountCents ?? 0),
        totalPriceCents: Number(res.totalPriceCents ?? 0),
      });
      setDiscountResponsibility(res.discountResponsibility ?? "COMPANY");
      setPromoterDiscountSharePct((Number(res.promoterDiscountShareBps ?? 0) / 100).toFixed(2));
      setPaymentSummary({
        totalServiceCents: Number(res.totalServiceCents ?? res.totalPriceCents ?? 0),
        paidServiceCents: Number(res.paidServiceCents ?? 0),
        pendingServiceCents: Number(res.pendingServiceCents ?? 0),
      });
      setPrefillSource(res.source ?? null);
      setPrefillFormalizedAt(res.formalizedAt ?? null);
      setPrefillStatus(res.status ?? null);
      setCartItems(
        (res.items ?? []).map((item) => ({
          id: crypto.randomUUID(),
          serviceId: item.serviceId,
          optionId: item.optionId,
          quantity: Number(item.quantity ?? 1),
          pax: Number(item.pax ?? res.pax ?? 1),
          applyPromo: Boolean(item.promoCode),
          promoCode: item.promoCode ?? null,
          availablePromos: [],
        }))
      );
    },
    []
  );

  const { migrateLoading, migrateError, migrateFlags, refreshPrefill } = useReservationPrefill({
    prefillReservationId,
    optionsLength: options.length,
    applyReservation: applyPrefillReservation,
    applyWorkflow: setPrefillWorkflow,
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
    enabled: Boolean(prefillReservationId),
    prefillReservationId,
    isHistorical: Boolean(migrateFlags?.isHistorical),
  });

  const { availability, availabilityLoading, availabilityError } = useAvailability(dateStr, availabilityTick);

  const {
    loadingCatalog,
    catalogError,
    servicesMain: loadedServicesMain,
    options: loadedOptions,
    channels: loadedChannels,
    categoriesMain: loadedCategoriesMain,
    assetAvailability: loadedAssetAvailability,
    initialDefaults,
  } = useStoreCreateCatalog({
    migrateReservationId,
  });

  const {
    customerSearch,
    setCustomerSearch,
    customerMatches,
    customerSearchBusy,
    customerSearchError,
    appliedCustomerProfileName,
    searchCustomers,
    applyCustomerProfile,
  } = useCustomerProfileSearch({
    onApplyProfile: (p) => {
      if (p.customerName != null) setCustomerName(p.customerName);
      if (p.email != null) setCustomerEmail(p.email);
      if (p.phone != null) setCustomerPhone(p.phone);
      if (p.customerDocType != null) setCustomerDocType(p.customerDocType);
      if (p.customerDocNumber != null) setCustomerDocNumber(p.customerDocNumber);
      if (p.country != null) setCustomerCountry(p.country);
      if (p.birthDate != null) setCustomerBirthDate(p.birthDate);
      if (p.address != null) setCustomerAddress(p.address);
      if (p.postalCode != null) setCustomerPostalCode(p.postalCode);
      if (p.licenseSchool != null) setLicenseSchool(p.licenseSchool);
      if (p.licenseType != null) setLicenseType(p.licenseType);
      if (p.licenseNumber != null) setLicenseNumber(p.licenseNumber);
      setRecoveredContractProfile(p.contractProfile ?? null);

      if (typeof window !== "undefined") {
        if (p.contractProfile) {
          window.sessionStorage.setItem(
            RECOVERED_CONTRACT_PROFILE_STORAGE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              profile: p.contractProfile,
            })
          );
        } else {
          window.sessionStorage.removeItem(RECOVERED_CONTRACT_PROFILE_STORAGE_KEY);
        }
      }
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (recoveredContractProfile) return;

    const raw = window.sessionStorage.getItem(RECOVERED_CONTRACT_PROFILE_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { savedAt?: number; profile?: RecoveredContractProfile | null };
      const savedAt = Number(parsed?.savedAt ?? 0);
      if (!parsed?.profile || !savedAt || Date.now() - savedAt > 6 * 60 * 60 * 1000) {
        window.sessionStorage.removeItem(RECOVERED_CONTRACT_PROFILE_STORAGE_KEY);
        return;
      }

      setRecoveredContractProfile(parsed.profile);
    } catch {
      window.sessionStorage.removeItem(RECOVERED_CONTRACT_PROFILE_STORAGE_KEY);
    }
  }, [recoveredContractProfile]);

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
    const nextContext = { serviceId, category, optionId };
    if (skipNextTimeResetRef.current) {
      skipNextTimeResetRef.current = false;
      scheduleContextRef.current = nextContext;
      return;
    }

    const prevContext = scheduleContextRef.current;
    scheduleContextRef.current = nextContext;

    if (!prevContext) return;
    if (
      prevContext.serviceId === nextContext.serviceId &&
      prevContext.category === nextContext.category &&
      prevContext.optionId === nextContext.optionId
    ) {
      return;
    }

    const previousSelectionWasReady = Boolean(prevContext.serviceId && prevContext.optionId);
    if (!previousSelectionWasReady) return;

    if (timeStr.trim()) {
      setScheduleInvalidationMessage("La actividad cambió y la hora anterior dejó de ser válida. Selecciona una nueva hora para recalcular disponibilidad, promociones y descuentos.");
      setTimeStr("");
    }
  }, [serviceId, category, optionId, timeStr]);

  useEffect(() => {
    if (isEditMode || isMigrateMode) return;

    const u = new URL(window.location.href);
    const isToday = dateStr === todayMadridYMD();

    u.searchParams.set("mode", isToday ? "today" : "future");
    window.history.replaceState({}, "", u.toString());
  }, [dateStr, isEditMode, isMigrateMode]);

  useEffect(() => {
    setServicesMain(loadedServicesMain);
    setOptions(loadedOptions);
    setChannels(loadedChannels);
    setCategoriesMain(loadedCategoriesMain);
    setAssetAvailability(loadedAssetAvailability);
  }, [loadedServicesMain, loadedOptions, loadedChannels, loadedCategoriesMain, loadedAssetAvailability]);

  useEffect(() => {
    if (!initialDefaults) return;
    setServiceId(initialDefaults.serviceId);
    setOptionId(initialDefaults.optionId);
    setChannelId(initialDefaults.channelId);
  }, [initialDefaults]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isEditMode && !isMigrateMode) return;

    window.localStorage.removeItem(STORE_CREATE_DRAFT_STORAGE_KEY);
    setDraftRecoveredAt(null);
  }, [isEditMode, isMigrateMode]);

  useEffect(() => {
    if (!catalogError) return;
    setError(catalogError);
  }, [catalogError]);
          
  // Hora por defecto si es hoy
  useEffect(() => {
    const today = todayMadridYMD();
    if (dateStr === today && (!timeStr || !timeStr.trim())) {
      setTimeStr(hhmmNowRounded(5));
    }
  }, [dateStr, timeStr]);

  useEffect(() => {
    if (!timeStr.trim()) return;
    setScheduleInvalidationMessage(null);
  }, [timeStr]);

  const {
    selectedService,
    isPackMode,
    canAddToCart,
    servicesMainFiltered,
    selectedCategory,
    filteredOptions,
    optionById,
    selectedOpt,
    channelsWithFallback,
    packPreview,
    handleCategoryChange,
  } = useStoreCreateSelection({
    servicesMain,
    options,
    channels,
    category,
    serviceId,
    optionId,
    jetskiLicenseMode,
    quantity,
    pax,
    prefillServiceFallback,
    prefillOptionFallback,
    prefillChannelFallback,
    setServiceId,
    setOptionId,
    setJetskiLicenseMode,
    setCartItems,
  });

  const isJetskiSelection = selectedCategory === "JETSKI";
  const pricingTier: "STANDARD" | "RESIDENT" =
    isJetskiSelection && jetskiLicenseMode === "GREEN_LIMITED" ? "RESIDENT" : "STANDARD";
  const isLicense = isJetskiSelection
    ? jetskiLicenseMode !== "NONE"
    : Boolean(selectedService?.isLicense);
  const isScheduleSelectionReady = Boolean(serviceId && optionId && selectedCategory);
  const isTodayDraftAutoTimePending =
    isScheduleSelectionReady &&
    !isEditMode &&
    !isMigrateMode &&
    !scheduleInvalidationMessage &&
    dateStr === todayMadridYMD() &&
    !timeStr.trim();
  const selectedServiceLabel = selectedService?.name ?? "";
  const selectedOptionLabel = selectedOpt?.durationMinutes ? `${selectedOpt.durationMinutes} min` : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadingCatalog || isEditMode || isMigrateMode || draftRecoveredAt) return;

    const raw = window.localStorage.getItem(STORE_CREATE_DRAFT_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { savedAt?: number; draft?: StoreCreateDraft | null };
      const savedAt = Number(parsed?.savedAt ?? 0);
      const draft = parsed?.draft;
      if (!draft || !savedAt || Date.now() - savedAt > STORE_CREATE_DRAFT_TTL_MS) {
        window.localStorage.removeItem(STORE_CREATE_DRAFT_STORAGE_KEY);
        return;
      }

      skipNextTimeResetRef.current = true;
      setDateStr(draft.dateStr || defaultDate);
      setTimeStr(draft.timeStr || "");
      setScheduleInvalidationMessage(null);
      setCategory(draft.category || "");
      setServiceId(draft.serviceId || "");
      setOptionId(draft.optionId || "");
      setChannelId(draft.channelId || "");
      setCustomerName(draft.customerName || "");
      setFirstName(draft.firstName || "");
      setLastName(draft.lastName || "");
      setCustomerPhone(draft.customerPhone || "");
      setCustomerEmail(draft.customerEmail || "");
      setCustomerCountry(draft.customerCountry || "ES");
      setCustomerAddress(draft.customerAddress || "");
      setCustomerPostalCode(draft.customerPostalCode || "");
      setCustomerBirthDate(draft.customerBirthDate || "");
      setCustomerDocType(draft.customerDocType || "");
      setCustomerDocNumber(draft.customerDocNumber || "");
      setMarketingSource(draft.marketingSource || "");
      setBoothNote(draft.boothNote || "");
      setQuantity(Math.max(1, Number(draft.quantity || 1)));
      setPax(Math.max(1, Number(draft.pax || 1)));
      setCompanions(Math.max(0, Number(draft.companions || 0)));
      setJetskiLicenseMode(draft.jetskiLicenseMode || "NONE");
      setLicenseSchool(draft.licenseSchool || "");
      setLicenseType(draft.licenseType || "");
      setLicenseNumber(draft.licenseNumber || "");
      setManualDiscountEuros(draft.manualDiscountEuros || "");
      setManualDiscountReason(draft.manualDiscountReason || "");
      setDiscountResponsibility(draft.discountResponsibility || "COMPANY");
      setPromoterDiscountSharePct(draft.promoterDiscountSharePct || "50");
      setApplyPromo(Boolean(draft.applyPromo));
      setSelectedPromoCode(draft.selectedPromoCode || "");
      setCartItems(Array.isArray(draft.cartItems) ? draft.cartItems : []);
      setDraftRecoveredAt(savedAt);
      setSubmitSuccess("Borrador recuperado. Puedes continuar donde lo dejaste.");
    } catch {
      window.localStorage.removeItem(STORE_CREATE_DRAFT_STORAGE_KEY);
    }
  }, [defaultDate, draftRecoveredAt, isEditMode, isMigrateMode, loadingCatalog]);

  useEffect(() => {
    if (!isLicense) {
      setLicenseSchool("");
      setLicenseType("");
      setLicenseNumber("");
    }
  }, [isLicense]);

  const getOptionUnitPriceCents = useCallback((nextOptionId: string, nextServiceId?: string) => {
    const opt = optionById.get(nextOptionId);
    if (!opt) return 0;
    const service = servicesMain.find((item) => item.id === (nextServiceId ?? opt.serviceId)) ?? null;
    const category = String(service?.category ?? "").toUpperCase();
    if (category === "JETSKI" && pricingTier === "RESIDENT") {
      return Number(opt.residentPriceCents ?? 0) || 0;
    }
    return Number(opt.standardPriceCents ?? opt.basePriceCents ?? 0) || 0;
  }, [optionById, servicesMain, pricingTier]);

  const cartSubtotalCents = useMemo(() => {
    if (isPackMode) return 0; // pack se calcula aparte

    if (!cartItems.length) {
      const unit = getOptionUnitPriceCents(optionId, serviceId);
      return unit * Number(quantity || 0);
    }

    let sum = 0;
    for (const it of cartItems) {
      const unit = getOptionUnitPriceCents(it.optionId, it.serviceId);
      sum += unit * Number(it.quantity || 0);
    }
    return sum;
  }, [isPackMode, cartItems, optionId, quantity, serviceId, getOptionUnitPriceCents]);

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

  const canCreate = Boolean(
    serviceId &&
    optionId &&
    selectedOpt &&
    (selectedOpt.hasPrice ?? true) &&
    getOptionUnitPriceCents(optionId, serviceId) > 0
  );

const { discountPreview, discountLoading } = useDiscountPreview({
    isEditMode,
    isMigrateMode,
    cartItemsLength: cartItems.length,
    canCreate,
    baseTotalCents: cartSubtotalCents,
    serviceId,
    optionId,
    channelId,
    quantity,
    pax,
    date: dateStr,
    time: timeStr,
    customerCountry,
    jetskiLicenseMode,
    promoCode: applyPromo ? selectedPromoCode || null : null,
  });

  useEffect(() => {
    const availableCodes = new Set((discountPreview?.availablePromos ?? []).map((promo) => String(promo.code ?? "")));
    if (selectedPromoCode && !availableCodes.has(selectedPromoCode)) {
      setSelectedPromoCode("");
      setApplyPromo(false);
    }
  }, [discountPreview?.availablePromos, selectedPromoCode]);

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === channelId) ?? null,
    [channels, channelId]
  );

  useEffect(() => {
    if ((isEditMode || isMigrateMode) && prefillPricing) return;
    const policy = resolveDiscountPolicy({ channel: selectedChannel });
    setDiscountResponsibility(policy.discountResponsibility);
    setPromoterDiscountSharePct((policy.promoterDiscountShareBps / 100).toFixed(2));
  }, [isEditMode, isMigrateMode, prefillPricing, selectedChannel]);

  useEffect(() => {
    if (selectedChannel?.allowsPromotions === false) {
      setApplyPromo(false);
      setSelectedPromoCode("");
    }
  }, [selectedChannel?.allowsPromotions]);

  useEffect(() => {
    if (cartItems.length === 0 || isEditMode || isMigrateMode) {
      setCartDiscountPreviews({});
      return;
    }

    let active = true;
    void (async () => {
      const nextEntries = await Promise.all(
        cartItems.map(async (item) => {
          try {
            const res = await fetch("/api/store/discounts/preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                serviceId: item.serviceId,
                optionId: item.optionId,
                channelId: channelId || null,
                quantity: item.quantity,
                pax: item.pax,
                date: dateStr,
                time: timeStr || null,
                customerCountry: (customerCountry || "ES").trim().toUpperCase(),
                jetskiLicenseMode,
                promoCode: item.applyPromo ? item.promoCode ?? null : null,
              }),
            });
            if (!res.ok) return [item.id, null] as const;
            const data = await res.json();
            return [item.id, {
              baseTotalCents: Number(data.baseTotalCents ?? 0),
              autoDiscountCents: Number(data.autoDiscountCents ?? 0),
              finalTotalCents: Number(data.finalTotalCents ?? 0),
            }] as const;
          } catch {
            return [item.id, null] as const;
          }
        })
      );

      if (!active) return;
      const next: Record<string, { baseTotalCents: number; autoDiscountCents: number; finalTotalCents: number }> = {};
      for (const [id, value] of nextEntries) {
        if (value) next[id] = value;
      }
      setCartDiscountPreviews(next);
    })();

    return () => {
      active = false;
    };
  }, [cartItems, channelId, customerCountry, dateStr, timeStr, isEditMode, isMigrateMode, jetskiLicenseMode]);


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
  const shouldForceFormalizeBooth =
    isEditMode &&
    prefillSource === "BOOTH" &&
    !prefillFormalizedAt &&
    !Boolean(migrateFlags?.isReadOnly);

  const uiMode: UIMode =
    shouldForceFormalizeBooth ? "FORMALIZE"
    : isEditMode ? "EDIT"
    : isMigrateMode ? "FORMALIZE"
    : wantsTodayUi ? "FORMALIZE"
    : "CREATE";

  const strictFormalizeBlocked =
    uiMode === "FORMALIZE" && !isMigrateMode && !isEditMode && !isTodayMadridSelected;

  const primaryLabel =
    migrateFlags?.isReadOnly ? "Solo lectura"
    : uiMode === "EDIT" ? "Guardar cambios"
    : uiMode === "FORMALIZE" ? "Formalizar"
    : "Crear";

  // licencia obligatoria solo al formalizar
  const isFormalizeMode = uiMode === "FORMALIZE" && !migrateFlags?.isHistorical;
  const isCreateMode = uiMode === "CREATE";
  const isReadOnlyReservation = Boolean(migrateFlags?.isReadOnly);

  const isContractsOnlyMode = Boolean(migrateReservationId || shouldForceFormalizeBooth);
  const isVoucherFormalizeFlow =
    isContractsOnlyMode && (Boolean(showGiftBadge) || Boolean(migrateFlags?.isGift) || Boolean(migrateFlags?.isPass));
  // (si quieres incluir edit, usa: Boolean(migrateReservationId || editReservationId))
  const hasReadyContracts = contracts.some((contract) => contract.status === "READY");
  const hasSignedContracts = contracts.some((contract) => contract.status === "SIGNED");

  const formalizeNeedsFullData = useMemo(() => {
    return needsContractForCategory(selectedCategory, false);
  }, [selectedCategory]);

  const customerCountryRequired = isCreateMode || (isFormalizeMode && formalizeNeedsFullData);
  const customerAddressRequired = false;
  const customerDocumentRequired = isCreateMode || isFormalizeMode;

  const requiredCreateMissing =
    isCreateMode &&
    (!customerName.trim() || !customerPhone.trim());

  const requiredFormalizeMissing = isFormalizeMode && (
    !customerName.trim() ||
    !customerPhone.trim()
  );
  const contractsReadyForFormalize =
    !isMigrateMode || requiredUnits <= 0 || readyCount >= requiredUnits;

  const customerFieldErrors = {
    firstName: firstName.trim() ? null : "Indica el nombre.",
    lastName: null,
    customerPhone: customerPhone.trim() ? null : "Indica el telefono.",
  };

  const softPrimaryBlockedReason =
    isFormalizeMode && !contractsReadyForFormalize
      ? `Faltan contratos por completar: ${readyCount}/${requiredUnits} listos.`
      : requiredFormalizeMissing
        ? "Para formalizar faltan datos mínimos (nombre y teléfono)."
        : requiredCreateMissing
          ? "Para crear faltan datos mínimos (nombre y teléfono)."
          : null;

  const hardPrimaryDisabledReason =
    isReadOnlyReservation
      ? migrateFlags?.isCanceled
        ? "Reserva cancelada: ficha en solo lectura."
        : "Reserva histórica: ficha en solo lectura."
      : migrateFlags?.isHistorical
      ? "Reserva histórica: no se puede formalizar."
      : strictFormalizeBlocked
          ? "Solo puedes formalizar el mismo día."
          : (isCreateMode && !canCreate)
            ? "Esta opción no tiene precio vigente."
            : null;

  const primaryDisabledReason = hardPrimaryDisabledReason ?? softPrimaryBlockedReason;
  const primaryDisabled = Boolean(hardPrimaryDisabledReason);

  const countryOptions = useMemo(() => getCountryOptionsEs(), []);
  const selectedCountryOpt = useMemo(
    () => countryOptions.find((o) => o.value === (customerCountry || "").toUpperCase()) ?? null,
    [countryOptions, customerCountry]
  );
  
  const useCart = cartItems.length > 0;
  
  const shownBaseCents = useCart
  ? (cartItems.reduce((sum, item) => sum + Number(cartDiscountPreviews[item.id]?.baseTotalCents ?? 0), 0) || cartSubtotalCents)
  : (discountPreview?.baseTotalCents ?? (isMigrateMode ? Number(prefillPricing?.basePriceCents ?? cartSubtotalCents) : cartSubtotalCents));

  const shownDiscountCents = useCart
    ? cartItems.reduce((sum, item) => sum + Number(cartDiscountPreviews[item.id]?.autoDiscountCents ?? 0), 0)
    : (discountPreview?.autoDiscountCents ?? (isMigrateMode ? Number((prefillPricing?.manualDiscountCents ?? 0) + (prefillPricing?.autoDiscountCents ?? 0)) : 0));

  const shownFinalCents = useCart
    ? (cartItems.reduce((sum, item) => sum + Number(cartDiscountPreviews[item.id]?.finalTotalCents ?? 0), 0) || cartSubtotalCents)
    : (discountPreview?.finalTotalCents ?? (isMigrateMode ? Number(prefillPricing?.totalPriceCents ?? Math.max(0, shownBaseCents - shownDiscountCents)) : Math.max(0, shownBaseCents - shownDiscountCents)));

  const shownReason = discountPreview?.reason ?? (isMigrateMode && shownDiscountCents > 0 ? "Precio heredado de la pre-reserva de carpa." : null);
  const pricingMeta = discountPreview?.pricingMeta ?? (
    serviceId && optionId
      ? {
          pricingTier,
          unitPriceCents: getOptionUnitPriceCents(optionId, serviceId),
          quantity,
          modeLabel:
            pricingTier === "RESIDENT"
              ? "Tarifa residente / llave verde"
              : "Tarifa estándar / llave amarilla o sin licencia",
        }
      : null
  );
  const canEditPricing = !isMigrateMode && !isEditMode;
  const canEditReservationForm = !isReadOnlyReservation;
  const isBoothReservation = showBoothBadge || prefillSource === "BOOTH";
  const showFuturePaymentsSection = isEditMode && !migrateFlags?.isHistorical && !isReadOnlyReservation;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isCreateMode || isEditMode || isMigrateMode) return;

    const hasDraftContent = Boolean(
      customerName.trim() ||
      firstName.trim() ||
      lastName.trim() ||
      customerPhone.trim() ||
      customerEmail.trim() ||
      customerDocNumber.trim() ||
      boothNote.trim() ||
      marketingSource.trim() ||
      serviceId ||
      optionId ||
      channelId ||
      cartItems.length > 0 ||
      manualDiscountEuros.trim() ||
      manualDiscountReason.trim() ||
      selectedPromoCode.trim()
    );

    if (!hasDraftContent) {
      window.localStorage.removeItem(STORE_CREATE_DRAFT_STORAGE_KEY);
      return;
    }

    const draft: StoreCreateDraft = {
      dateStr,
      timeStr,
      category,
      serviceId,
      optionId,
      channelId,
      customerName,
      firstName,
      lastName,
      customerPhone,
      customerEmail,
      customerCountry,
      customerAddress,
      customerPostalCode,
      customerBirthDate,
      customerDocType,
      customerDocNumber,
      marketingSource,
      boothNote,
      quantity,
      pax,
      companions,
      jetskiLicenseMode,
      licenseSchool,
      licenseType,
      licenseNumber,
      manualDiscountEuros,
      manualDiscountReason,
      discountResponsibility,
      promoterDiscountSharePct,
      applyPromo,
      selectedPromoCode,
      cartItems,
    };

    window.localStorage.setItem(
      STORE_CREATE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        draft,
      })
    );
  }, [
    applyPromo,
    boothNote,
    cartItems,
    category,
    channelId,
    companions,
    customerAddress,
    customerBirthDate,
    customerCountry,
    customerDocNumber,
    customerDocType,
    customerEmail,
    customerName,
    customerPhone,
    customerPostalCode,
    dateStr,
    discountResponsibility,
    firstName,
    isCreateMode,
    isEditMode,
    isMigrateMode,
    jetskiLicenseMode,
    lastName,
    licenseNumber,
    licenseSchool,
    licenseType,
    manualDiscountEuros,
    manualDiscountReason,
    marketingSource,
    optionId,
    pax,
    promoterDiscountSharePct,
    quantity,
    selectedPromoCode,
    serviceId,
    timeStr,
  ]);
  const boothPricingNote = isBoothReservation
    ? "Reservas de Booth: el descuento heredado solo se conserva al ampliar la misma actividad original. Si añades otra actividad distinta o extras, esas líneas no reciben descuento de carpa."
    : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#payments") return;
    const el = document.getElementById("payments");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showFuturePaymentsSection]);

  const MANUAL_DISC_MAX_PCT = 50;
  const maxManualDiscountCents = Math.floor((shownBaseCents * MANUAL_DISC_MAX_PCT) / 100);

  const manualDiscountCentsRaw = Math.round(Number(String(manualDiscountEuros || "").replace(",", ".")) * 100) || 0;
  const manualDiscountCents = Math.max(0, Math.min(manualDiscountCentsRaw, maxManualDiscountCents));
  const shownFinalCentsWithManual = canEditPricing
    ? Math.max(0, shownFinalCents - manualDiscountCents)
    : shownFinalCents;
  const commissionBreakdown = useMemo(
    () =>
      computeCommissionableBase({
        grossBaseCents: shownBaseCents,
        totalDiscountCents: canEditPricing
          ? shownDiscountCents + manualDiscountCents
          : Number((prefillPricing?.manualDiscountCents ?? 0) + (prefillPricing?.autoDiscountCents ?? 0)),
        responsibility: canEditPricing ? discountResponsibility : prefillPricing ? discountResponsibility : "COMPANY",
        promoterDiscountShareBps: Math.round(Number(promoterDiscountSharePct || "0") * 100),
      }),
    [
      canEditPricing,
      discountResponsibility,
      manualDiscountCents,
      prefillPricing,
      promoterDiscountSharePct,
      shownBaseCents,
      shownDiscountCents,
    ]
  );
  const storeCommissionPct = useMemo(() => {
    if (useCart) return 0;
    if (!selectedChannel?.commissionEnabled || !selectedService?.id) return 0;
    const specificRule = selectedChannel.commissionRules?.find((rule) => rule.serviceId === selectedService.id);
    const channelPct = specificRule?.commissionPct != null
      ? Number(specificRule.commissionPct)
      : Number(selectedChannel.commissionBps ?? 0) / 100;
    return selectedChannel.kind === "EXTERNAL_ACTIVITY"
      ? clampPct(100 - channelPct)
      : clampPct(channelPct);
  }, [selectedChannel, selectedService, useCart]);
  const storePromoterBasePct = useMemo(() => {
    if (useCart) return 0;
    if (!selectedChannel?.commissionEnabled || !selectedService?.id) return 0;
    const specificRule = selectedChannel.commissionRules?.find((rule) => rule.serviceId === selectedService.id);
    return clampPct(
      specificRule?.commissionPct != null
        ? Number(specificRule.commissionPct)
        : Number(selectedChannel.commissionBps ?? 0) / 100
    );
  }, [selectedChannel, selectedService, useCart]);
  const storeCommissionCents = useMemo(
    () => Math.round(commissionBreakdown.commissionBaseCents * (storeCommissionPct / 100)),
    [commissionBreakdown.commissionBaseCents, storeCommissionPct]
  );
  const storePromoterNominalPct = useMemo(() => storePromoterBasePct, [storePromoterBasePct]);
  const storePromoterEffectivePct = useMemo(
    () =>
      shownBaseCents > 0
        ? selectedChannel?.kind === "EXTERNAL_ACTIVITY"
          ? clampPct(((shownFinalCentsWithManual - storeCommissionCents) / shownBaseCents) * 100)
          : clampPct((storeCommissionCents / shownBaseCents) * 100)
        : 0,
    [selectedChannel?.kind, shownBaseCents, shownFinalCentsWithManual, storeCommissionCents]
  );
  const workflowState = useMemo(() => {
    const current = getReservationWorkflowState({
      uiMode,
      reservationId: prefillReservationId,
      status: prefillStatus,
      formalizedAt: prefillFormalizedAt,
      customerName,
      customerPhone,
      isReadOnly: isReadOnlyReservation,
      isCanceled: Boolean(migrateFlags?.isCanceled),
      isCompleted: Boolean(migrateFlags?.isCompleted),
      requiredUnits,
      readyCount,
      signedCount: contracts.filter((contract) => contract.status === "SIGNED").length,
      pendingServiceCents: paymentSummary.pendingServiceCents,
      pendingDepositCents: 0,
    });
    return current.visibleState === "draft" && prefillWorkflow ? { ...current, description: prefillWorkflow.description } : current;
  }, [
    uiMode,
    prefillReservationId,
    prefillStatus,
    prefillFormalizedAt,
    customerName,
    customerPhone,
    isReadOnlyReservation,
    migrateFlags?.isCanceled,
    migrateFlags?.isCompleted,
    requiredUnits,
    readyCount,
    contracts,
    paymentSummary.pendingServiceCents,
    prefillWorkflow,
  ]);

  const workflowSubmitLabel =
    workflowState.primaryAction.kind === "submit"
      ? workflowState.primaryAction.label
      : primaryLabel;

  const workflowActionTargetId =
    workflowState.primaryAction.kind === "contracts" || workflowState.primaryAction.kind === "payments"
      ? workflowState.primaryAction.targetId ?? null
      : null;

  const handleWorkflowAction = useCallback(() => {
    if (!workflowActionTargetId) return;
    const el = document.getElementById(workflowActionTargetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState({}, "", `#${workflowActionTargetId}`);
    }
  }, [workflowActionTargetId]);

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
      const effectivePromoCode = applyPromo ? selectedPromoCode || null : null;
      const idx = prev.findIndex((x) => x.serviceId === serviceId && x.optionId === optionId && (x.promoCode ?? null) === effectivePromoCode);
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
        applyPromo,
        promoCode: effectivePromoCode,
        availablePromos: discountPreview?.availablePromos ?? [],
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

  function updateCartPromo(id: string, patch: Partial<Pick<CartItem, "applyPromo" | "promoCode">>) {
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function createReservation(e: FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setError(null);
    setSubmitSuccess(null);
    if (primaryDisabledReason) return;
    setSubmitBusy(true);
    setAvailabilityTick((x) => x + 1);

    try {
      if (isReadOnlyReservation) {
        setError(
          migrateFlags?.isCanceled
            ? "La reserva está cancelada y solo se puede consultar."
            : "La reserva es histórica y solo se puede consultar."
        );
        return;
      }

      if (shouldForceFormalizeBooth && editReservationId) {
        await submitStoreCreateMigrateFlow({
          migrateReservationId: editReservationId,
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
          companions,
          timeStr,
          isLicense: Boolean(isLicense),
          jetskiLicenseMode,
          pricingTier,
          licenseSchool,
          licenseType,
          licenseNumber,
          promoCode: applyPromo ? selectedPromoCode || null : null,
          router,
        });
        return;
      }

      if (isEditMode && editReservationId) {
        const updated = await submitStoreCreateEditFlow({
          editReservationId,
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
          isLicense: Boolean(isLicense),
          jetskiLicenseMode,
          pricingTier,
          timeStr,
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
          promoCode: applyPromo ? selectedPromoCode || null : null,
        });
        await refreshPrefill();
        await refreshContracts(editReservationId);
        router.replace(
          Number(updated.requiredUnits ?? 0) > Number(updated.readyCount ?? 0)
            ? `/store/create?editFrom=${updated.id}#contracts`
            : `/store/create?editFrom=${updated.id}`,
          { scroll: false }
        );
        setSubmitSuccess("Cambios guardados.");
        return;
      }

      if (isMigrateMode && migrateFlags?.isHistorical) {
        router.push(`/store/create?editFrom=${migrateReservationId}`);
        return;
      }

      if (isMigrateMode && migrateReservationId) {
        await submitStoreCreateMigrateFlow({
          migrateReservationId,
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
          companions,
          timeStr,
          isLicense: Boolean(isLicense),
          jetskiLicenseMode,
          pricingTier,
          licenseSchool,
          licenseType,
          licenseNumber,
          promoCode: applyPromo ? selectedPromoCode || null : null,
          router,
        });
        return;
      }

      await submitStoreCreateCreateFlow({
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
        isPackMode,
        cartItems,
        timeStr,
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
        jetskiLicenseMode,
        pricingTier,
        licenseSchool,
        licenseType,
        licenseNumber,
        companions,
        manualDiscountCents,
        manualDiscountReason,
        discountResponsibility,
        promoterDiscountShareBps: Math.round(Number(promoterDiscountSharePct || "0") * 100),
        promoCode: applyPromo ? selectedPromoCode || null : null,
        router,
      });
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
    } finally {
      setSubmitBusy(false);
    }
  }

  async function registerFutureReservationPayment() {
    if (!editReservationId) return;

    const amountCents = Math.round(Number(String(paymentAmountEuros || "").replace(",", ".")) * 100) || 0;
    if (amountCents <= 0) {
      setPaymentError("Introduce un importe valido.");
      return;
    }
    if (amountCents > Number(paymentSummary.pendingServiceCents ?? 0)) {
      setPaymentError("El importe supera el pendiente del servicio.");
      return;
    }

    setPaymentBusy(true);
    setPaymentError(null);
    try {
      const res = await fetch("/api/store/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: editReservationId,
          amountCents,
          method: paymentMethod,
          origin: "STORE",
          isDeposit: false,
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      setPaymentSummary((prev) => ({
        totalServiceCents: prev.totalServiceCents,
        paidServiceCents: prev.paidServiceCents + amountCents,
        pendingServiceCents: Math.max(0, prev.pendingServiceCents - amountCents),
      }));
      setPaymentAmountEuros("");
      await refreshPrefill();
      if (editReservationId) {
        await refreshContracts(editReservationId);
      }
      setSubmitSuccess("Cobro registrado. Estado actualizado.");
    } catch (e: unknown) {
      setPaymentError(errorMessage(e, "No se pudo registrar el cobro"));
    } finally {
      setPaymentBusy(false);
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

  function handleCategorySelection(next: string) {
    setCategory(next);
    handleCategoryChange(next);
  }

  const reservationBasicsSectionProps = {
    values: {
      firstName,
      lastName,
      customerPhone,
      customerEmail,
      customerCountry,
      customerAddress,
      customerPostalCode,
      customerDocType,
      customerDocNumber,
      marketingSource,
      boothNote,
      category,
      serviceId,
      optionId,
      channelId,
      quantity,
      pax,
      companions,
      jetskiLicenseMode,
      pricingTier,
    },
    flags: {
      isEditMode,
      customerCountryRequired,
      customerAddressRequired,
      customerDocumentRequired,
      isVoucherFormalizeFlow,
      selectedCategory,
      isJetskiSelection,
    },
    validation: {
      showErrors: submitAttempted && Boolean(requiredCreateMissing || requiredFormalizeMissing),
      ...customerFieldErrors,
    },
    lists: {
      countryOptions,
      selectedCountryOpt,
      categoriesMain,
      servicesMainFiltered,
      packPreview,
      filteredOptions,
      selectedOpt,
      channels: channelsWithFallback,
    },
    handlers: {
      onFirstNameChange: handleFirstNameChange,
      onLastNameChange: handleLastNameChange,
      onCustomerPhoneChange: setCustomerPhone,
      onCustomerEmailChange: setCustomerEmail,
      onCustomerCountryChange: setCustomerCountry,
      onCustomerAddressChange: setCustomerAddress,
      onCustomerPostalCodeChange: setCustomerPostalCode,
      onCustomerDocTypeChange: setCustomerDocType,
      onCustomerDocNumberChange: setCustomerDocNumber,
      onMarketingSourceChange: setMarketingSource,
      onCategoryChange: handleCategorySelection,
      onServiceChange: setServiceId,
      onOptionChange: setOptionId,
      onChannelChange: setChannelId,
      onQuantityChange: setQuantity,
      onPaxChange: setPax,
      onCompanionsChange: setCompanions,
      onJetskiLicenseModeChange: setJetskiLicenseMode,
    },
  };

  const shellStyle: React.CSSProperties = {
    ...opsStyles.pageShell,
    width: "min(1240px, 100%)",
  };
  const panelStyle: React.CSSProperties = {
    ...opsStyles.sectionCard,
    borderRadius: 20,
    background: "#fff",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.06)",
  };
  const secondaryButtonStyle: React.CSSProperties = {
    ...opsStyles.ghostButton,
    color: "#111827",
  };
  const badgeStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
  };
  const heroPillStyle: React.CSSProperties = {
    ...opsStyles.heroPill,
    border: "1px solid rgba(125, 211, 252, 0.35)",
    background: "rgba(15, 23, 42, 0.24)",
  };
  const summaryCards = [
    {
      label: "Disponibilidad",
      value: availabilityLoading ? "..." : availabilityError ? "Error" : "OK",
    },
    {
      label: "Precio actual",
      value: euros(shownFinalCentsWithManual),
    },
    {
      label: "Contratos",
      value: requiredUnits > 0 ? `${readyCount}/${requiredUnits}` : "No aplica",
    },
    {
      label: "Canal",
      value: channels.find((ch) => ch.id === channelId)?.name ?? "Sin canal",
    },
    {
      label: "Borrador",
      value: isCreateMode ? (draftRecoveredAt ? "Recuperado" : "Activo") : "No aplica",
    },
  ];

  return (
    <div style={shellStyle}>
      <section
        style={{
          ...opsStyles.heroCard,
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
            <h1 style={opsStyles.heroTitle}>
              {isReadOnlyReservation
                ? "Ficha de reserva"
                : uiMode === "EDIT"
                  ? "Editar reserva"
                  : uiMode === "FORMALIZE"
                    ? "Formalizar reserva"
                    : "Crear reserva"}
            </h1>
            <div style={{ fontSize: 14, color: "#bae6fd", maxWidth: 700 }}>
              {isReadOnlyReservation
                ? migrateFlags?.isCanceled
                  ? "Reserva cancelada en modo consulta. Puedes revisar datos, pero no modificarla."
                  : "Reserva histórica en modo consulta. Se muestran los datos guardados sin permitir edición."
                : uiMode === "EDIT"
                ? "Puedes editar la reserva antes de preparar contratos. Si ya existen contratos listos o firmados, la edición se bloquea para no dejar documentación desalineada."
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
          {isReadOnlyReservation ? <span style={heroPillStyle}>Bloqueada</span> : null}
        </div>
      </section>

      {isReadOnlyReservation ? (
        <section
          style={{
            ...panelStyle,
            padding: 16,
            border: migrateFlags?.isCanceled ? "1px solid #fecaca" : "1px solid #fed7aa",
            background: migrateFlags?.isCanceled ? "#fff1f2" : "#fff7ed",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ ...badgeStyle, color: migrateFlags?.isCanceled ? "#b91c1c" : "#c2410c" }}>
            {migrateFlags?.isCanceled ? "Cancelada · solo lectura" : "Histórica · solo lectura"}
          </div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            La ficha está abierta en modo consulta.
          </div>
          <div style={{ fontSize: 13, color: "#475569" }}>
            No se permiten cambios de datos, cobros, contratos ni formalización en esta reserva.
          </div>
        </section>
      ) : null}

      <StoreCreateSummaryStrip cards={summaryCards} />

      {uiMode === "EDIT" && hasSignedContracts ? (
        <section
          style={{
            ...panelStyle,
            padding: 16,
            border: "1px solid #cbd5e1",
            background: "#f8fafc",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ ...badgeStyle, color: "#334155" }}>Nueva versión de contratos</div>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            Esta reserva ya tiene contratos firmados.
          </div>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Si cambias actividad, duración o cantidad, los contratos firmados actuales se conservarán como histórico y el sistema generará nuevos contratos para volver a firmar la versión actualizada.
          </div>
        </section>
      ) : null}

      {uiMode === "EDIT" && !hasSignedContracts && hasReadyContracts ? (
        <section
          style={{
            ...panelStyle,
            padding: 16,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ ...badgeStyle, color: "#a16207" }}>Regeneración de contratos</div>
          <div style={{ fontWeight: 900, color: "#713f12" }}>
            Esta reserva ya tiene contratos en estado READY.
          </div>
          <div style={{ fontSize: 13, color: "#92400e" }}>
            Si cambias la duración dentro de la misma actividad, los contratos READY volverán a DRAFT para regenerarse. Si ya hubiera contratos firmados, la edición seguiría bloqueada.
          </div>
        </section>
      ) : null}

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
        <div style={{ padding: "18px clamp(18px, 3vw, 24px)", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
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

        <form onSubmit={createReservation} style={{ padding: "18px clamp(18px, 3vw, 24px) 24px", display: "grid", gap: 16 }}>
          {loadingCatalog ? <div style={{ color: "#64748b" }}>Cargando catálogo...</div> : null}

          {isVoucherFormalizeFlow ? (
            <div style={{ padding: 12, border: "1px solid #fde68a", borderRadius: 14, background: "#fffbeb", fontSize: 13, color: "#713f12" }}>
              Bono o regalo: servicio, duración y cantidad quedan fijados por el canje. Solo completa contratos y formaliza.
            </div>
          ) : null}

          <div style={{ opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
            <StoreCreateCustomerProfileSection
              customerSearch={customerSearch}
              customerMatches={customerMatches}
              customerSearchBusy={customerSearchBusy}
              customerSearchError={customerSearchError}
              appliedCustomerProfileName={appliedCustomerProfileName}
              onCustomerSearchChange={setCustomerSearch}
              onSearchSubmit={() => searchCustomers(customerSearch)}
              onApplyCustomerProfile={applyCustomerProfile}
            />
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
              <div style={{ marginTop: 14, display: "grid", gap: 12, opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
                <ReservationBasicsSection {...reservationBasicsSectionProps} />
              </div>
            </details>
          ) : (
            <div style={{ display: "grid", gap: 12, opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
              <ReservationBasicsSection {...reservationBasicsSectionProps} />
            </div>
          )}

          <div style={{ opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
            <AvailabilitySection
              dateStr={dateStr}
              onDateChange={setDateStr}
              availabilityLoading={availabilityLoading}
              availabilityError={availabilityError}
              availability={availability}
              selectedCategory={selectedCategory}
              selectedServiceLabel={selectedServiceLabel}
              selectedOptionLabel={selectedOptionLabel}
              isSelectionReady={isScheduleSelectionReady}
              invalidationMessage={scheduleInvalidationMessage}
              timeStr={timeStr}
              onTimeSelect={(nextTime) => {
                setScheduleInvalidationMessage(null);
                setTimeStr(nextTime);
              }}
            />
          </div>

          {prefillReservationId && !migrateFlags?.isHistorical && !isReadOnlyReservation ? (
            <ContractsSection
              reservationId={prefillReservationId}
              readyCount={readyCount}
              requiredUnits={requiredUnits}
              contracts={contracts}
              contractsLoading={contractsLoading}
              contractsError={contractsError}
              requiresLicense={Boolean(isLicense)}
              recoveredContractProfile={recoveredContractProfile}
              onRecoveredContractProfileApplied={() => {
                setRecoveredContractProfile(null);
                if (typeof window !== "undefined") {
                  window.sessionStorage.removeItem(RECOVERED_CONTRACT_PROFILE_STORAGE_KEY);
                }
              }}
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

          <div style={{ opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
            <CartSection
              isPackMode={isPackMode}
              canAddToCart={canEditReservationForm && canAddToCart}
              cartItems={cartItems}
              servicesMain={servicesMain}
              options={options}
              assetAvailability={assetAvailability}
              getServiceNameById={getServiceNameById}
              onAddToCart={addToCart}
              onClearCart={clearCart}
              onRemoveFromCart={removeFromCart}
              onUpdateCartItem={updateCartItem}
              onUpdateCartPromo={updateCartPromo}
              onError={setError}
            />
          </div>

          <div style={{ opacity: canEditReservationForm ? 1 : 0.72, pointerEvents: canEditReservationForm ? "auto" : "none" }}>
            <PricingSection
              discountLoading={discountLoading}
              canEditPricing={canEditReservationForm && canEditPricing}
              isTimeSelectionReady={Boolean(timeStr.trim()) || isTodayDraftAutoTimePending}
              boothPricingNote={boothPricingNote}
              shownFinalCents={shownFinalCents}
              maxManualDiscountCents={maxManualDiscountCents}
              manualDiscountEuros={manualDiscountEuros}
              onManualDiscountEurosChange={setManualDiscountEuros}
              manualDiscountReason={manualDiscountReason}
              onManualDiscountReasonChange={setManualDiscountReason}
              discountResponsibility={discountResponsibility}
              onDiscountResponsibilityChange={setDiscountResponsibility}
              promoterDiscountSharePct={promoterDiscountSharePct}
              onPromoterDiscountSharePctChange={setPromoterDiscountSharePct}
              shownFinalCentsWithManual={shownFinalCentsWithManual}
              manualDiscountCentsRaw={manualDiscountCentsRaw}
              shownDiscountCents={shownDiscountCents}
              shownBaseCents={shownBaseCents}
              shownReason={shownReason ?? ""}
              commissionBaseCents={commissionBreakdown.commissionBaseCents}
              promoterDiscountCents={commissionBreakdown.promoterDiscountCents}
              companyDiscountCents={commissionBreakdown.companyDiscountCents}
              promoterNominalPct={storePromoterNominalPct}
              promoterEffectivePct={storePromoterEffectivePct}
              pricingMeta={pricingMeta}
              channelPricingSummary={discountPreview?.channelPricingSummary ?? null}
              availablePromos={canEditReservationForm && canEditPricing ? (discountPreview?.availablePromos ?? []) : []}
              applyPromo={applyPromo}
              selectedPromoCode={selectedPromoCode}
              onApplyPromoChange={setApplyPromo}
              onPromoCodeChange={setSelectedPromoCode}
            />
          </div>

          {showFuturePaymentsSection ? (
            <div id="payments">
              <FutureReservationPaymentsSection
                totalServiceCents={paymentSummary.totalServiceCents}
                paidServiceCents={paymentSummary.paidServiceCents}
                pendingServiceCents={paymentSummary.pendingServiceCents}
                paymentMethod={paymentMethod}
                paymentAmountEuros={paymentAmountEuros}
                paymentBusy={paymentBusy}
                paymentError={paymentError}
                onPaymentMethodChange={setPaymentMethod}
                onPaymentAmountEurosChange={setPaymentAmountEuros}
                onFillPendingAmount={() =>
                  setPaymentAmountEuros(((paymentSummary.pendingServiceCents ?? 0) / 100).toFixed(2))
                }
                onCharge={() => void registerFutureReservationPayment()}
              />
            </div>
          ) : null}

          <SubmitSection
            primaryDisabled={primaryDisabled}
            primaryLabel={workflowSubmitLabel}
            primaryDisabledReason={primaryDisabledReason}
            primaryBusy={submitBusy}
            successMessage={submitSuccess}
            showPrimaryDisabledReason={Boolean(hardPrimaryDisabledReason) || submitAttempted}
            workflowLabel={workflowState.label}
            workflowDescription={workflowState.description}
            workflowMissingRequirements={workflowState.missingRequirements}
            workflowActionLabel={
              workflowState.primaryAction.kind === "contracts" || workflowState.primaryAction.kind === "payments"
                ? workflowState.primaryAction.label
                : null
            }
            workflowActionTargetId={workflowActionTargetId}
            onWorkflowAction={handleWorkflowAction}
          />
        </form>
      </section>

      <div style={{ fontSize: 12, color: "#64748b" }}>
        Nota: extras, contrato y formalización completa seguirán en la pantalla de la reserva (<b>/store/create?editFrom=...</b>).
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
