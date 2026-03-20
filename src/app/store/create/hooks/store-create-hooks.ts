// src/app/store/create/hooks/store-create-hooks.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AvailabilityData,
  ContractDraftState,
  ContractDto,
  ContractsState,
  DiscountPreview,
  MigrateFlags,
} from "../types";
import { errorMessage, isAbortError } from "../utils/errors";
import {
  ensureContracts as ensureContractsRequest,
  fetchContracts,
  patchContract,
} from "../services/contracts";

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
          licenseSchool: c.licenseSchool ?? "",
          licenseType: c.licenseType ?? "",
          licenseNumber: c.licenseNumber ?? "",
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

      await patchContract(contractId, {
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
      });

      await loadContractsBlock(reservationId);
    },
    [contractDrafts, loadContractsBlock]
  );

  const handleReadyContract = useCallback(
    async (contractId: string, reservationId: string) => {
      const d = contractDrafts[contractId];
      if (!d) return;

      await patchContract(contractId, {
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
        status: "READY",
      });

      await loadContractsBlock(reservationId);
    },
    [contractDrafts, loadContractsBlock]
  );

  const handleDraftContract = useCallback(
    async (contractId: string, reservationId: string) => {
      await patchContract(contractId, { status: "DRAFT" });
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
            quantity,
            pax,
            customerCountry: (customerCountry || "ES").trim().toUpperCase(),
            promoCode: null,
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
  }, [isEditMode, isMigrateMode, cartItemsLength, canCreate, baseTotalCents, serviceId, optionId, quantity, pax, customerCountry]);

  return { discountPreview, discountLoading };
}