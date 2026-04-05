// src/app/store/create/hooks/store-create-hooks.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AvailabilityData,
  CartItem,
  Channel,
  ContractDraftState,
  ContractDto,
  ContractsState,
  CustomerSearchRow,
  DiscountPreview,
  MigrateFlags,
  Option,
  PackPreview,
  ServiceMain,
} from "../types";
import { errorMessage, isAbortError } from "../utils/errors";
import { ensureContracts as ensureContractsRequest, fetchContracts, patchContract } from "../services/contracts";
import { getAssetAvailability, type AssetAvailability } from "../../services/assets";

export function useContractsState(args: {
  isMigrateMode: boolean;
  prefillReservationId: string | null;
  isHistorical: boolean;
}) {
  const { isMigrateMode, prefillReservationId, isHistorical } = args;

  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsBusy, setContractsBusy] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);

  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [requiredUnits, setRequiredUnits] = useState<number>(0);
  const [readyCount, setReadyCount] = useState<number>(0);

  const [contractsMeta, setContractsMeta] = useState<{
    reservationId: string;
    requiredUnits: number;
    readyCount: number;
    needsContracts: boolean;
    contractsState: ContractsState;
  } | null>(null);

  const [contractDrafts, setContractDrafts] = useState<ContractDraftState>({});

  const loadContractsBlock = useCallback(async (reservationId: string) => {
    try {
      setContractsBusy(true);
      setContractsError(null);

      await ensureContractsRequest(reservationId);
      const data = await fetchContracts(reservationId);

      setContractsMeta({
        reservationId: data.reservationId,
        requiredUnits: data.requiredUnits,
        readyCount: data.readyCount,
        needsContracts: data.needsContracts,
        contractsState: data.contractsState,
      });

      setContracts(data.contracts);
      setRequiredUnits(Number(data.requiredUnits ?? 0));
      setReadyCount(Number(data.readyCount ?? 0));

      const draftState: ContractDraftState = {};
      for (const c of data.contracts) {
        draftState[c.id] = {
          driverName: c.driverName ?? "",
          driverPhone: c.driverPhone ?? "",
          driverEmail: c.driverEmail ?? "",
          driverCountry: c.driverCountry ?? "",
          driverAddress: c.driverAddress ?? "",
          driverPostalCode: c.driverPostalCode ?? "",
          driverDocType: c.driverDocType ?? "",
          driverDocNumber: c.driverDocNumber ?? "",
          driverBirthDate: c.driverBirthDate ? c.driverBirthDate.slice(0, 10) : "",
          minorAuthorizationProvided: Boolean(c.minorAuthorizationProvided),
          imageConsentAccepted: Boolean(c.imageConsentAccepted),
          licenseSchool: c.licenseSchool ?? "",
          licenseType: c.licenseType ?? "",
          licenseNumber: c.licenseNumber ?? "",
          preparedJetskiId: c.preparedJetskiId ?? "",
          preparedAssetId: c.preparedAssetId ?? "",
        };
      }

      setContractDrafts(draftState);
    } catch (e: unknown) {
      setContractsError(errorMessage(e, "Error cargando contratos"));
    } finally {
      setContractsBusy(false);
    }
  }, []);

  const refreshContracts = useCallback(
    async (reservationId: string) => {
      setContractsError(null);
      setContractsLoading(true);
      try {
        await loadContractsBlock(reservationId);
      } finally {
        setContractsLoading(false);
      }
    },
    [loadContractsBlock]
  );

  const handleSaveContract = useCallback(
    async (contractId: string, reservationId: string) => {
      const d = contractDrafts[contractId];
      if (!d) return;

      await patchContract(reservationId, contractId, {
        driverName: d.driverName || null,
        driverPhone: d.driverPhone || null,
        driverEmail: d.driverEmail || null,
        driverCountry: d.driverCountry || null,
        driverAddress: d.driverAddress || null,
        driverPostalCode: d.driverPostalCode || null,
        driverDocType: d.driverDocType || null,
        driverDocNumber: d.driverDocNumber || null,
        driverBirthDate: d.driverBirthDate || null,
        minorAuthorizationProvided: d.minorAuthorizationProvided,
        licenseSchool: d.licenseSchool || null,
        licenseType: d.licenseType || null,
        licenseNumber: d.licenseNumber || null,
        preparedJetskiId: d.preparedJetskiId || null,
        preparedAssetId: d.preparedAssetId || null,
      });

      await loadContractsBlock(reservationId);
    },
    [contractDrafts, loadContractsBlock]
  );

  const handleReadyContract = useCallback(
    async (contractId: string, reservationId: string) => {
      const d = contractDrafts[contractId];
      if (!d) return;

      await patchContract(reservationId, contractId, {
        driverName: d.driverName || null,
        driverPhone: d.driverPhone || null,
        driverEmail: d.driverEmail || null,
        driverCountry: d.driverCountry || null,
        driverAddress: d.driverAddress || null,
        driverPostalCode: d.driverPostalCode || null,
        driverDocType: d.driverDocType || null,
        driverDocNumber: d.driverDocNumber || null,
        driverBirthDate: d.driverBirthDate || null,
        minorAuthorizationProvided: d.minorAuthorizationProvided,
        licenseSchool: d.licenseSchool || null,
        licenseType: d.licenseType || null,
        licenseNumber: d.licenseNumber || null,
        preparedJetskiId: d.preparedJetskiId || null,
        preparedAssetId: d.preparedAssetId || null,
        status: "READY",
      });

      await loadContractsBlock(reservationId);
    },
    [contractDrafts, loadContractsBlock]
  );

  const handleDraftContract = useCallback(
    async (contractId: string, reservationId: string) => {
      await patchContract(reservationId, contractId, { status: "DRAFT" });
      await loadContractsBlock(reservationId);
    },
    [loadContractsBlock]
  );

  useEffect(() => {
    if (!isMigrateMode) return;
    if (!prefillReservationId) return;
    if (isHistorical) return;
    void refreshContracts(prefillReservationId);
  }, [isMigrateMode, prefillReservationId, isHistorical, refreshContracts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#contracts") return;
    const el = document.getElementById("contracts");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return {
    contractsLoading,
    contractsBusy,
    contractsError,
    contracts,
    requiredUnits,
    readyCount,
    contractsMeta,
    contractDrafts,
    setContractDrafts,
    refreshContracts,
    loadContractsBlock,
    handleSaveContract,
    handleReadyContract,
    handleDraftContract,
  };
}

export function useReservationPrefill(args: {
  prefillReservationId: string | null;
  optionsLength: number;
  applyReservation: (res: {
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
      basePriceCents?: number | null;
      manualDiscountCents?: number | null;
      autoDiscountCents?: number | null;
      totalPriceCents?: number | null;
      service?: {
        id: string;
        name: string;
        code?: string | null;
        category?: string | null;
        isLicense?: boolean | null;
      } | null;
      option?: {
        id: string;
        serviceId: string;
        code?: string | null;
        durationMinutes?: number | null;
        paxMax?: number | null;
        contractedMinutes?: number | null;
        basePriceCents?: number | null;
      } | null;
      channel?: {
        id: string;
        name: string;
        commissionEnabled?: boolean | null;
        commissionBps?: number | null;
      } | null;
      activityDate: string;
      scheduledTime?: string | null;
    }) => void;
  setDateStr: (v: string) => void;
  setTimeStr: (v: string) => void;
}) {
  const { prefillReservationId, optionsLength, applyReservation, setDateStr, setTimeStr } = args;
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);
  const [migrateFlags, setMigrateFlags] = useState<MigrateFlags | null>(null);

  useEffect(() => {
    if (!prefillReservationId) return;
    if (optionsLength === 0) return;

    (async () => {
      setMigrateLoading(true);
      setMigrateError(null);
      try {
        const r = await fetch(`/api/store/reservations/${prefillReservationId}/prefill`, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const data = await r.json();
        const res = data.reservation;

        setMigrateFlags((data.flags ?? null) as MigrateFlags | null);
        applyReservation(res);

        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Madrid",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date(res.activityDate));
        const y = parts.find((p) => p.type === "year")?.value;
        const m = parts.find((p) => p.type === "month")?.value;
        const d = parts.find((p) => p.type === "day")?.value;
        setDateStr(`${y}-${m}-${d}`);

        if (res.scheduledTime) {
          const tParts = new Intl.DateTimeFormat("es-ES", {
            timeZone: "Europe/Madrid",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(new Date(res.scheduledTime));
          const hh = tParts.find((p) => p.type === "hour")?.value ?? "00";
          const mm = tParts.find((p) => p.type === "minute")?.value ?? "00";
          setTimeStr(`${hh}:${mm}`);
        }
      } catch (e: unknown) {
        setMigrateError(errorMessage(e, "No se pudo prellenar la reserva"));
      } finally {
        setMigrateLoading(false);
      }
    })();
  }, [prefillReservationId, optionsLength, applyReservation, setDateStr, setTimeStr]);

  return { migrateLoading, migrateError, migrateFlags };
}

export function useAvailability(dateStr: string, availabilityTick: number) {
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setAvailabilityLoading(true);
      setAvailabilityError(null);
      try {
        const r = await fetch(`/api/store/availability?date=${dateStr}&t=${availabilityTick}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        setAvailability(j as AvailabilityData);
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        setAvailabilityError(errorMessage(e, "No se pudo cargar disponibilidad"));
        setAvailability(null);
      } finally {
        setAvailabilityLoading(false);
      }
    })();
    return () => ac.abort();
  }, [dateStr, availabilityTick]);

  return { availability, availabilityLoading, availabilityError };
}

export function useDiscountPreview(args: {
  isEditMode: boolean;
  isMigrateMode: boolean;
  cartItemsLength: number;
  canCreate: boolean;
  baseTotalCents: number;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  customerCountry: string;
  channelId: string;
  promoCode?: string | null;
}) {
  const {
    isEditMode,
    isMigrateMode,
    cartItemsLength,
    canCreate,
    baseTotalCents,
    serviceId,
    optionId,
    quantity,
    pax,
    customerCountry,
    channelId,
    promoCode,
  } = args;

  const [discountPreview, setDiscountPreview] = useState<DiscountPreview | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);

  useEffect(() => {
    if (isEditMode || isMigrateMode) {
      setDiscountPreview(null);
      return;
    }

    if (cartItemsLength > 0) {
      setDiscountPreview(null);
      return;
    }

    if (!canCreate || baseTotalCents <= 0) {
      setDiscountPreview(null);
      return;
    }

    const ac = new AbortController();

    (async () => {
      setDiscountLoading(true);
      try {
        const r = await fetch("/api/store/discounts/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            serviceId,
            optionId,
            channelId: channelId || null,
            quantity,
            pax,
            customerCountry: (customerCountry || "ES").trim().toUpperCase(),
            promoCode: promoCode ?? null,
          }),
        });

        if (!r.ok) {
          setDiscountPreview(null);
          return;
        }

        const data = (await r.json()) as DiscountPreview;
        setDiscountPreview(data);
      } catch (e: unknown) {
        if (!isAbortError(e)) setDiscountPreview(null);
      } finally {
        setDiscountLoading(false);
      }
    })();

    return () => ac.abort();
  }, [isEditMode, isMigrateMode, cartItemsLength, canCreate, baseTotalCents, serviceId, optionId, channelId, quantity, pax, customerCountry, promoCode]);

  return { discountPreview, discountLoading };
}

export function useCustomerProfileSearch(args: {
  onApplyProfile: (profile: {
    customerName?: string | null;
    email?: string | null;
    phone?: string | null;
    customerDocNumber?: string | null;
    country?: string | null;
    birthDate?: string | null;
    address?: string | null;
    postalCode?: string | null;
    licenseNumber?: string | null;
  }) => void;
}) {
  const { onApplyProfile } = args;

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerSearchRow[]>([]);
  const [customerSearchBusy, setCustomerSearchBusy] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [appliedCustomerProfileName, setAppliedCustomerProfileName] = useState<string | null>(null);

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
      void searchCustomers(q);
    }, 350);

    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  const applyCustomerProfile = useCallback(async (reservationId: string) => {
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
      const p = data.profile ?? {};

      onApplyProfile(p);
      setCustomerMatches([]);
      setCustomerSearch("");
      setAppliedCustomerProfileName(p.customerName?.trim() || "Cliente previo");
    } catch (e: unknown) {
      setCustomerSearchError(
        e instanceof Error ? e.message : "Error cargando ficha"
      );
    }
  }, [onApplyProfile]);

  return {
    customerSearch,
    setCustomerSearch,
    customerMatches,
    customerSearchBusy,
    customerSearchError,
    appliedCustomerProfileName,
    searchCustomers,
    applyCustomerProfile,
  };
}

export function useStoreCreateCatalog(args: {
  migrateReservationId: string | null;
}) {
  const { migrateReservationId } = args;

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [servicesMain, setServicesMain] = useState<ServiceMain[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categoriesMain, setCategoriesMain] = useState<string[]>([]);
  const [assetAvailability, setAssetAvailability] = useState<AssetAvailability[]>([]);
  const [initialDefaults, setInitialDefaults] = useState<{
    serviceId: string;
    optionId: string;
    channelId: string;
  } | null>(null);

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      setLoadingCatalog(true);
      setCatalogError(null);

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
          const main0 = sm[0] ?? null;
          const firstOpt = main0 ? op.find((o) => o.serviceId === main0.id) ?? null : null;
          const ch0 = ch[0] ?? null;

          setInitialDefaults({
            serviceId: main0?.id ?? "",
            optionId: firstOpt?.id ?? "",
            channelId: ch0?.id ?? "",
          });
        } else {
          setInitialDefaults(null);
        }
      } catch (e: unknown) {
        if (isAbortError(e)) return;
        setCatalogError(errorMessage(e, "No se pudo cargar el catálogo"));
      } finally {
        setLoadingCatalog(false);
      }
    })();

    return () => ac.abort();
  }, [migrateReservationId]);

  return {
    loadingCatalog,
    catalogError,
    servicesMain,
    options,
    channels,
    categoriesMain,
    assetAvailability,
    initialDefaults,
  };
}

export function useStoreCreateSelection(args: {
  servicesMain: ServiceMain[];
  options: Option[];
  channels: Channel[];
  category: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  prefillServiceFallback: ServiceMain | null;
  prefillOptionFallback: Option | null;
  prefillChannelFallback: Channel | null;
  setServiceId: (value: string) => void;
  setOptionId: (value: string) => void;
  setIsLicense: (value: boolean) => void;
  setTimeStr: (value: string) => void;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
}) {
  const {
    servicesMain,
    options,
    channels,
    category,
    serviceId,
    optionId,
    quantity,
    pax,
    prefillServiceFallback,
    prefillOptionFallback,
    prefillChannelFallback,
    setServiceId,
    setOptionId,
    setIsLicense,
    setTimeStr,
    setCartItems,
  } = args;

  const [packPreview, setPackPreview] = useState<PackPreview | null>(null);

  const selectedService = useMemo(
    () => servicesMain.find((s) => s.id === serviceId) ?? (prefillServiceFallback?.id === serviceId ? prefillServiceFallback : null),
    [servicesMain, serviceId, prefillServiceFallback]
  );

  const isPackMode = (selectedService?.category ?? "").toUpperCase() === "PACK";
  const canAddToCart = !isPackMode && !!serviceId && !!optionId && Number(quantity) > 0 && Number(pax) > 0;

  const servicesMainFiltered = useMemo(() => {
    const list = !category ? servicesMain : servicesMain.filter((s) => (s.category ?? "") === category);
    if (
      prefillServiceFallback &&
      prefillServiceFallback.id === serviceId &&
      !list.some((s) => s.id === prefillServiceFallback.id) &&
      (!category || (prefillServiceFallback.category ?? "") === category)
    ) {
      return [prefillServiceFallback, ...list];
    }
    return list;
  }, [servicesMain, category, prefillServiceFallback, serviceId]);

  const selectedCategory = useMemo(() => {
    if (!serviceId) return "";
    const svc = servicesMain.find((s) => s.id === serviceId) ?? (prefillServiceFallback?.id === serviceId ? prefillServiceFallback : null);
    return String(svc?.category ?? "").toUpperCase();
  }, [serviceId, servicesMain, prefillServiceFallback]);

  const filteredOptions = useMemo(() => {
    if (!serviceId) return [];
    const list = options.filter((o) => o.serviceId === serviceId);
    if (
      prefillOptionFallback &&
      prefillOptionFallback.serviceId === serviceId &&
      !list.some((o) => o.id === prefillOptionFallback.id)
    ) {
      return [prefillOptionFallback, ...list];
    }
    return list;
  }, [options, serviceId, prefillOptionFallback]);

  const optionById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  const selectedOpt = useMemo(
    () => options.find((o) => o.id === optionId) ?? (prefillOptionFallback?.id === optionId ? prefillOptionFallback : null),
    [options, optionId, prefillOptionFallback]
  );

  const channelsWithFallback = useMemo(() => {
    if (!prefillChannelFallback || channels.some((c) => c.id === prefillChannelFallback.id)) return channels;
    return [prefillChannelFallback, ...channels];
  }, [channels, prefillChannelFallback]);

  const baseTotalCents = useMemo(() => {
    if (!selectedOpt) return 0;
    const unit = Number(selectedOpt.basePriceCents ?? 0) || 0;
    return unit * Number(quantity || 0);
  }, [selectedOpt, quantity]);

  useEffect(() => {
    if (!selectedService) return;
    setIsLicense(Boolean(selectedService.isLicense));
  }, [selectedService, setIsLicense]);

  useEffect(() => {
    if (isPackMode) setCartItems([]);
  }, [isPackMode, setCartItems]);

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
  }, [filteredOptions, optionId, setOptionId]);

  useEffect(() => {
    if (!serviceId) {
      const list = category
        ? servicesMain.filter((s) => (s.category ?? "") === category)
        : servicesMain;
      const s0 = list[0];
      if (s0) setServiceId(s0.id);
    }

    setTimeStr("");
  }, [category, servicesMain, serviceId, setServiceId, setTimeStr]);

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

  function handleCategoryChange(next: string) {
    const list = next ? servicesMain.filter((svc) => (svc.category ?? "") === next) : servicesMain;
    const firstService = list[0] ?? null;
    setServiceId(firstService?.id ?? "");

    const firstOption =
      options.find((opt) => opt.serviceId === (firstService?.id ?? "") && (opt.hasPrice ?? true) && (opt.basePriceCents ?? 0) > 0) ??
      options.find((opt) => opt.serviceId === (firstService?.id ?? "")) ??
      null;
    setOptionId(firstOption?.id ?? "");
  }

  return {
    selectedService,
    isPackMode,
    canAddToCart,
    servicesMainFiltered,
    selectedCategory,
    filteredOptions,
    optionById,
    selectedOpt,
    channelsWithFallback,
    baseTotalCents,
    packPreview,
    handleCategoryChange,
  };
}
