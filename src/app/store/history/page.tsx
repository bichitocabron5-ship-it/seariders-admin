"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { opsStyles } from "@/components/ops-ui";
import { StoreMetricCard, StoreMetricGrid, storeStyles } from "@/components/store-ui";
import { Button, Card, Input, Pill, Select, styles } from "@/components/ui";
import StoreHistoryResultsSection from "./_components/StoreHistoryResultsSection";

type HistoryIncident = {
  id: string;
  type: string;
  level: string;
  status: string;
  isOpen: boolean;
  retainDeposit: boolean;
  retainDepositCents: number | null;
  description: string | null;
  notes: string | null;
  maintenanceEventId: string | null;
  createdAt: string;
  entityType: string | null;
  jetskiId: string | null;
  assetId: string | null;
};

type ManualContractAttachment = {
  id: string;
  fileKey: string | null;
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
};

type HistoryRow = {
  id: string;
  status: string;
  storeFlowStage: string | null;
  activityDate: string;
  scheduledTime: string | null;
  arrivalAt: string | null;
  customerName: string | null;
  customerCountry: string | null;
  primaryDriverName: string | null;
  driverNamesSummary: string | null;
  contractsCount: number;
  readyContractsCount: number;
  signedContractsCount: number;
  quantity: number | null;
  pax: number | null;
  isLicense: boolean | null;
  totalPriceCents: number | null;
  depositCents: number | null;
  depositHeld: boolean;
  depositHoldReason: string | null;
  isManualEntry: boolean;
  manualEntryNote: string | null;
  manualContractAttachments: ManualContractAttachment[];
  financialAdjustmentNote: string | null;
  financialAdjustedAt: string | null;
  source: string | null;
  formalizedAt: string | null;
  channelName: string | null;
  serviceName: string | null;
  serviceCategory: string | null;
  durationMinutes: number | null;
  paidCents: number;
  paidDepositCents: number;
  depositCollectedCents: number;
  depositReturnedCents: number;
  depositRetainedCents: number;
  totalToChargeCents: number;
  incidents: HistoryIncident[];
};

type PassHistoryRow = {
  id: string;
  code: string;
  soldAt: string;
  expiresAt: string | null;
  salePriceCents: number;
  paidCents: number;
  minutesTotal: number;
  minutesRemaining: number;
  buyerName: string | null;
  buyerPhone: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  product: { name: string | null };
};

type GiftHistoryRow = {
  id: string;
  code: string;
  soldAt: string;
  expiresAt: string | null;
  paidCents: number;
  buyerName: string | null;
  buyerPhone: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  redeemedAt: string | null;
  product: { name: string | null; priceCents: number };
};

type CatalogService = { id: string; name?: string | null; category?: string | null };
type CatalogOption = { id: string; serviceId: string; durationMinutes?: number | null; paxMax?: number | null };
type CatalogChannel = { id: string; name: string };
type InternalStaffEmployee = { id: string; fullName: string; code?: string | null; kind?: string | null; jobTitle?: string | null };
type ManualPaymentDraft = { amountEuros: string; method: "CASH" | "CARD" | "BIZUM" | "TRANSFER"; isDeposit: boolean; direction: "IN" | "OUT" };
type ManualPresetId = "COMPLETED_PAID" | "COMPLETED_WITH_DEPOSIT" | "PENDING_COLLECTION" | "RECORD_ONLY" | "STAFF_INTERNAL";

function historyRowTimestamp(row: Pick<HistoryRow, "scheduledTime" | "activityDate" | "arrivalAt" | "formalizedAt">) {
  return (
    Date.parse(row.scheduledTime ?? "") ||
    Date.parse(row.activityDate ?? "") ||
    Date.parse(row.arrivalAt ?? "") ||
    Date.parse(row.formalizedAt ?? "") ||
    0
  );
}

function sortHistoryRowsNewestFirst(rows: HistoryRow[]) {
  return [...rows].sort((a, b) => historyRowTimestamp(b) - historyRowTimestamp(a));
}

function euros(cents: number | null | undefined) {
  return `${((Number(cents ?? 0)) / 100).toFixed(2)} EUR`;
}

function dt(v: string | null | undefined) {
  if (!v) return "-";
  return new Date(v).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function reservationHref(row: Pick<HistoryRow, "id" | "source" | "formalizedAt">) {
  return row.source === "BOOTH" && !row.formalizedAt
    ? `/store/create?migrateFrom=${row.id}`
    : `/store/create?editFrom=${row.id}`;
}

function centsFromEuros(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function mechanicsDetailHref(incident: {
  entityType?: string | null;
  jetskiId?: string | null;
  assetId?: string | null;
}) {
  if (incident.entityType === "JETSKI" && incident.jetskiId) {
    return `/mechanics/jetski/${incident.jetskiId}`;
  }

  if (incident.entityType === "ASSET" && incident.assetId) {
    return `/mechanics/asset/${incident.assetId}`;
  }

  return "/mechanics";
}

function mechanicsEventHref(incident: {
  entityType?: string | null;
  jetskiId?: string | null;
  assetId?: string | null;
  maintenanceEventId?: string | null;
}) {
  const base =
    incident.entityType === "JETSKI" && incident.jetskiId
      ? `/mechanics/jetski/${incident.jetskiId}`
      : incident.entityType === "ASSET" && incident.assetId
        ? `/mechanics/asset/${incident.assetId}`
        : "/mechanics";

  if (!incident.maintenanceEventId) return base;

  return `${base}?eventId=${incident.maintenanceEventId}`;
}

function statusTone(stageOrStatus: string | null | undefined) {
  switch (stageOrStatus) {
    case "COMPLETED":
      return { bg: "#ecfdf5", border: "#bbf7d0", color: "#166534" };
    case "IN_SEA":
    case "READY_FOR_PLATFORM":
      return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
    case "RETURN_PENDING_CLOSE":
      return { bg: "#fef3c7", border: "#fcd34d", color: "#92400e" };
    case "QUEUE":
    case "WAITING":
      return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    case "CANCELED":
      return { bg: "#f8fafc", border: "#cbd5e1", color: "#475569" };
    default:
      return { bg: "#f8fafc", border: "#dbe4ea", color: "#334155" };
  }
}

function incidentTone(level: string) {
  switch (level) {
    case "HIGH":
    case "CRITICAL":
      return { bg: "#fff1f2", border: "#fecdd3", color: "#be123c" };
    case "MEDIUM":
      return { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    default:
      return { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
  }
}

function countPaidServiceCents(row: HistoryRow) {
  const paidServiceCents = Math.max(0, Number(row.paidCents ?? 0) - Number(row.paidDepositCents ?? 0));
  const adjustedServiceTotalCents = Math.max(0, Number(row.totalPriceCents ?? 0));
  return Math.min(paidServiceCents, adjustedServiceTotalCents);
}

function countPendingServiceCents(row: HistoryRow) {
  if (row.status === "CANCELED") return 0;
  return Math.max(0, Number(row.totalPriceCents ?? 0) - countPaidServiceCents(row));
}

function countPendingDepositCents(row: HistoryRow) {
  if (row.status === "CANCELED") return 0;
  return Math.max(0, Number(row.depositCents ?? 0) - Number(row.depositCollectedCents ?? 0));
}

function statusLabel(stageOrStatus: string | null | undefined) {
  switch (stageOrStatus) {
    case "SCHEDULED":
      return "Programada";
    case "QUEUE":
      return "Pendiente de salida";
    case "RETURN_PENDING_CLOSE":
      return "Devuelta pendiente de cierre";
    case "WAITING":
      return "En espera";
    case "READY_FOR_PLATFORM":
      return "Lista para platform";
    case "IN_SEA":
      return "En mar";
    case "COMPLETED":
      return "Completada";
    case "CANCELED":
      return "Cancelada";
    default:
      return status;
  }
}

export default function StoreHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [passRows, setPassRows] = useState<PassHistoryRow[]>([]);
  const [giftRows, setGiftRows] = useState<GiftHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [catalogChannels, setCatalogChannels] = useState<CatalogChannel[]>([]);
  const [internalStaffEmployees, setInternalStaffEmployees] = useState<InternalStaffEmployee[]>([]);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualPreset, setManualPreset] = useState<ManualPresetId>("COMPLETED_PAID");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("12:00");
  const [manualServiceId, setManualServiceId] = useState("");
  const [manualOptionId, setManualOptionId] = useState("");
  const [manualChannelId, setManualChannelId] = useState("");
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualPax, setManualPax] = useState(1);
  const [manualStatus, setManualStatus] = useState("COMPLETED");
  const [manualCountry, setManualCountry] = useState("ES");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualInternalDetail, setManualInternalDetail] = useState("");
  const [manualTotalEuros, setManualTotalEuros] = useState("");
  const [manualDepositEuros, setManualDepositEuros] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [manualPayments, setManualPayments] = useState<ManualPaymentDraft[]>([
    { amountEuros: "", method: "CASH", isDeposit: false, direction: "IN" },
  ]);
  const [adjustTarget, setAdjustTarget] = useState<HistoryRow | null>(null);
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustTotalEuros, setAdjustTotalEuros] = useState("");
  const [adjustDepositEuros, setAdjustDepositEuros] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [manualContractBusyId, setManualContractBusyId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [hasIncident, setHasIncident] = useState("ALL");
  const [depositHeld, setDepositHeld] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status !== "ALL") p.set("status", status);
    if (hasIncident !== "ALL") p.set("hasIncident", hasIncident);
    if (depositHeld !== "ALL") p.set("depositHeld", depositHeld);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    p.set("take", "100");
    return p.toString();
  }, [q, status, hasIncident, depositHeld, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/store/reservations/history?${queryString}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setRows(sortHistoryRowsNewestFirst(data.rows ?? []));
      setPassRows(data.passVouchers ?? []);
      setGiftRows(data.giftVouchers ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error cargando histórico");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!manualOpen || catalogServices.length > 0) return;

    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      try {
        const [catalogRes, staffRes] = await Promise.all([
          fetch("/api/pos/catalog?origin=STORE", { cache: "no-store" }),
          fetch("/api/admin/reservations/manual/staff-options", { cache: "no-store" }),
        ]);
        if (!catalogRes.ok) throw new Error(await catalogRes.text());
        if (!staffRes.ok) throw new Error(await staffRes.text());
        const [data, staffJson] = await Promise.all([catalogRes.json(), staffRes.json()]);
        if (cancelled) return;
        const services = (data.servicesMain ?? []) as CatalogService[];
        const options = (data.options ?? []) as CatalogOption[];
        const channels = (data.channels ?? []) as CatalogChannel[];
        const employees = (staffJson.rows ?? []) as InternalStaffEmployee[];
        setCatalogServices(services);
        setCatalogOptions(options);
        setCatalogChannels(channels);
        setInternalStaffEmployees(employees);
        if (!manualServiceId && services[0]?.id) setManualServiceId(services[0].id);
        if (!manualChannelId && channels[0]?.id) setManualChannelId(channels[0].id);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "No se pudo cargar catálogo");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manualOpen, catalogServices.length, manualServiceId, manualChannelId]);

  useEffect(() => {
    if (!manualOpen || !manualServiceId) return;
    const firstOption = catalogOptions.find((option) => option.serviceId === manualServiceId);
    if (firstOption && (!manualOptionId || !catalogOptions.some((option) => option.id === manualOptionId && option.serviceId === manualServiceId))) {
      setManualOptionId(firstOption.id);
    }
  }, [manualOpen, manualServiceId, manualOptionId, catalogOptions]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.withIncidents += row.incidents.length > 0 ? 1 : 0;
        acc.depositHeld += row.depositHeld ? 1 : 0;
        acc.serviceChargedCents += countPaidServiceCents(row);
        acc.pendingCents += countPendingServiceCents(row) + countPendingDepositCents(row);
        return acc;
      },
      {
        total: 0,
        withIncidents: 0,
        depositHeld: 0,
        serviceChargedCents: 0,
        pendingCents: 0,
      },
    );
  }, [rows]);

  const selectedService = useMemo(
    () => catalogServices.find((service) => service.id === manualServiceId) ?? null,
    [catalogServices, manualServiceId],
  );

  const selectedOption = useMemo(
    () => catalogOptions.find((option) => option.id === manualOptionId) ?? null,
    [catalogOptions, manualOptionId],
  );

  const selectedChannel = useMemo(
    () => catalogChannels.find((channel) => channel.id === manualChannelId) ?? null,
    [catalogChannels, manualChannelId],
  );

  const expectedManualContracts = useMemo(
    () => Math.max(1, Number(manualQuantity || 1)),
    [manualQuantity],
  );

  const manualServiceTotalCents = useMemo(() => centsFromEuros(manualTotalEuros), [manualTotalEuros]);
  const manualDepositTotalCents = useMemo(() => centsFromEuros(manualDepositEuros), [manualDepositEuros]);

  const manualPaymentsSummary = useMemo(() => {
    return manualPayments.reduce(
      (acc, payment) => {
        const amountCents = centsFromEuros(payment.amountEuros);
        if (amountCents <= 0) return acc;
        if (payment.isDeposit) {
          acc.depositCents += payment.direction === "OUT" ? -amountCents : amountCents;
        } else {
          acc.serviceCents += payment.direction === "OUT" ? -amountCents : amountCents;
        }
        return acc;
      },
      { serviceCents: 0, depositCents: 0 },
    );
  }, [manualPayments]);

  const activeFilterCount = useMemo(() => {
    return [q.trim(), status !== "ALL", hasIncident !== "ALL", depositHeld !== "ALL", dateFrom, dateTo].filter(Boolean)
      .length;
  }, [q, status, hasIncident, depositHeld, dateFrom, dateTo]);

  function resetFilters() {
    setQ("");
    setStatus("ALL");
    setHasIncident("ALL");
    setDepositHeld("ALL");
    setDateFrom("");
    setDateTo("");
  }

  function resetManualForm() {
    setManualPreset("COMPLETED_PAID");
    setManualCustomerName("");
    setManualDate("");
    setManualTime("12:00");
    setManualQuantity(1);
    setManualPax(1);
    setManualStatus("COMPLETED");
    setManualCountry("ES");
    setManualPhone("");
    setManualEmail("");
    setManualEmployeeId("");
    setManualInternalDetail("");
    setManualTotalEuros("");
    setManualDepositEuros("");
    setManualNote("");
    setManualPayments([{ amountEuros: "", method: "CASH", isDeposit: false, direction: "IN" }]);
  }

  function manualPresetLabel(preset: ManualPresetId) {
    switch (preset) {
      case "COMPLETED_PAID":
        return "Completada y cobrada";
      case "COMPLETED_WITH_DEPOSIT":
        return "Completada con fianza cobrada";
      case "PENDING_COLLECTION":
        return "Pendiente de cobro";
      case "RECORD_ONLY":
        return "Solo constancia";
      case "STAFF_INTERNAL":
        return "Salida interna staff";
      default:
        return preset;
    }
  }

  function buildPaymentsForPreset(preset: ManualPresetId): ManualPaymentDraft[] {
    const serviceAmount = manualTotalEuros.trim();
    const depositAmount = manualDepositEuros.trim();

    switch (preset) {
      case "COMPLETED_PAID":
        return [{ amountEuros: serviceAmount, method: "CARD", isDeposit: false, direction: "IN" }];
      case "COMPLETED_WITH_DEPOSIT":
        return ([
          { amountEuros: serviceAmount, method: "CARD", isDeposit: false, direction: "IN" },
          { amountEuros: depositAmount, method: "CARD", isDeposit: true, direction: "IN" },
        ] satisfies ManualPaymentDraft[]).filter((payment) => centsFromEuros(payment.amountEuros) > 0);
      case "PENDING_COLLECTION":
      case "RECORD_ONLY":
      case "STAFF_INTERNAL":
        return [{ amountEuros: "", method: "CASH", isDeposit: false, direction: "IN" }];
      default:
        return [{ amountEuros: "", method: "CASH", isDeposit: false, direction: "IN" }];
    }
  }

  function applyManualPreset(preset: ManualPresetId) {
    setManualPreset(preset);
    if (preset === "STAFF_INTERNAL") {
      setManualStatus("READY_FOR_PLATFORM");
      setManualChannelId("");
      setManualTotalEuros("0.00");
      setManualDepositEuros("0.00");
      setManualNote("Salida interna staff");
    } else {
      setManualStatus(preset === "PENDING_COLLECTION" ? "WAITING" : "COMPLETED");
    }
    setManualPayments(buildPaymentsForPreset(preset));
  }

  function refillManualPaymentsFromPreset() {
    setManualPayments(buildPaymentsForPreset(manualPreset));
  }

  async function createManualReservation() {
    setManualBusy(true);
    setError(null);
    try {
      if (!manualCustomerName.trim()) throw new Error("Falta el cliente");
      if (!manualDate) throw new Error("Falta la fecha");
      if (!manualServiceId) throw new Error("Falta el servicio");
      if (!manualOptionId) throw new Error("Falta la opción");

      const baseManualNote =
        manualNote.trim() ||
        (manualPreset === "STAFF_INTERNAL" ? "Salida interna staff" : "Alta manual historica");
      const internalDetail = manualInternalDetail.trim();
      const effectiveManualNote = internalDetail
        ? `${baseManualNote} | ${internalDetail}`
        : baseManualNote;

      const payments = manualPayments
        .map((payment) => ({
          amountCents: centsFromEuros(payment.amountEuros),
          method: payment.method,
          isDeposit: payment.isDeposit,
          direction: payment.direction,
        }))
        .filter((payment) => payment.amountCents > 0);

      const res = await fetch("/api/admin/reservations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityDate: manualDate,
          time: manualTime || null,
          status: manualStatus,
          internalUsage: manualPreset === "STAFF_INTERNAL",
          employeeId: manualPreset === "STAFF_INTERNAL" ? manualEmployeeId || null : null,
          customerName: manualCustomerName,
          customerCountry: manualCountry,
          customerPhone: manualPhone || null,
          customerEmail: manualEmail || null,
          serviceId: manualServiceId,
          optionId: manualOptionId,
          channelId: manualChannelId || null,
          quantity: manualQuantity,
          pax: manualPax,
          totalPriceCents: centsFromEuros(manualTotalEuros),
          depositCents: centsFromEuros(manualDepositEuros),
          note: effectiveManualNote,
          payments,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      resetManualForm();
      setManualOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo crear la reserva manual");
    } finally {
      setManualBusy(false);
    }
  }

  function openAdjustment(row: HistoryRow) {
    setAdjustTarget(row);
    setAdjustTotalEuros((Number(row.totalPriceCents ?? 0) / 100).toFixed(2));
    setAdjustDepositEuros((Number(row.depositCents ?? 0) / 100).toFixed(2));
    setAdjustNote(row.financialAdjustmentNote ?? "");
  }

  async function submitAdjustment() {
    if (!adjustTarget) return;
    setAdjustBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reservations/${adjustTarget.id}/financial-adjustment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPriceCents: centsFromEuros(adjustTotalEuros),
          depositCents: centsFromEuros(adjustDepositEuros),
          note: adjustNote,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAdjustTarget(null);
      setAdjustNote("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo ajustar la reserva");
    } finally {
      setAdjustBusy(false);
    }
  }

  async function uploadManualContract(row: HistoryRow, files: File[]) {
    setManualContractBusyId(row.id);
    setError(null);
    try {
      if (!files.length) return;
      const currentCount = row.manualContractAttachments.length;
      const maxContracts = Math.max(1, Number(row.quantity ?? 1));

      if (currentCount + files.length > maxContracts) {
        throw new Error(`Esta reserva admite ${maxContracts} contrato(s) manual(es) y ya tiene ${currentCount}.`);
      }

      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);

        const res = await fetch(`/api/admin/reservations/${row.id}/manual-contract`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(await res.text());
      }

      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo adjuntar el contrato manual");
    } finally {
      setManualContractBusyId(null);
    }
  }

  async function downloadManualContract(row: HistoryRow, attachmentId: string) {
    setManualContractBusyId(row.id);
    setError(null);
    try {
      const params = new URLSearchParams({ attachmentId });
      const res = await fetch(`/api/admin/reservations/${row.id}/manual-contract/download?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el contrato manual");
    } finally {
      setManualContractBusyId(null);
    }
  }

  return (
    <div style={page}>
      <section style={heroCard}>
        <div style={heroHeader}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={eyebrow}>Store</div>
            <h1 style={heroTitle}>Histórico de reservas</h1>
            <div style={heroSubtitle}>
              Consulta devoluciones, incidencias, cobros y retenciones en una vista ordenada y alineada con la operativa
              de tienda.
            </div>
            <div style={heroInfoGrid}>
              <div style={heroInfoCard}>
                <strong>Servicio</strong>
                <span>Importe ya cobrado frente al servicio que sigue pendiente de caja.</span>
              </div>
              <div style={heroInfoCard}>
                <strong>Fianza</strong>
                <span>Se ve aparte lo cobrado, lo devuelto y lo retenido para que histórico y cierre cuadren.</span>
              </div>
              <div style={heroInfoCard}>
                <strong>Trazabilidad</strong>
                <span>Las reservas manuales quedan identificadas y pueden llevar contrato escaneado adjunto.</span>
              </div>
            </div>
          </div>

          <div style={opsStyles.actionGrid}>
            <a href="/store" style={secondaryLink}>
              Volver a Store
            </a>
            <button onClick={() => setManualOpen((prev) => !prev)} style={secondaryLink}>
              {manualOpen ? "Cerrar manual" : "Nueva reserva manual"}
            </button>
            <button onClick={load} style={primaryButton} disabled={loading}>
              {loading ? "Actualizando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <StoreMetricGrid>
          <StoreMetricCard label="Reservas listadas" value={summary.total} />
          <StoreMetricCard label="Bonos" value={passRows.length} />
          <StoreMetricCard label="Regalos" value={giftRows.length} />
          <StoreMetricCard label="Con incidencia" value={summary.withIncidents} />
          <StoreMetricCard label="Fianza retenida" value={summary.depositHeld} />
          <StoreMetricCard label="Servicio cobrado" value={euros(summary.serviceChargedCents)} />
          <StoreMetricCard label="Pendiente total" value={euros(summary.pendingCents)} />
        </StoreMetricGrid>
      </section>

      {manualOpen ? (
        <Card title="Alta manual histórica">
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Usa esta alta para reservas reales no registradas o para crear una <b>salida interna staff</b> que entre en Platform sin pasar por caja. Quedaran marcadas como <b>reserva manual</b>.
            </div>
            {catalogLoading ? <div style={mutedText}>Cargando catálogo...</div> : null}
            <div style={sectionCard}>
              <div style={sectionHeader}>
                <div style={sectionTitle}>Tipo de registro</div>
                <div style={mutedText}>Aplica un preset y luego ajusta solo lo que cambie del caso real.</div>
              </div>
              <div style={filtersGrid}>
                <label style={field}>
                  <span style={fieldLabel}>Preset</span>
                  <Select value={manualPreset} onChange={(e) => applyManualPreset(e.target.value as ManualPresetId)}>
                    <option value="COMPLETED_PAID">Completada y cobrada</option>
                    <option value="COMPLETED_WITH_DEPOSIT">Completada con fianza cobrada</option>
                    <option value="PENDING_COLLECTION">Pendiente de cobro</option>
                    <option value="RECORD_ONLY">Solo constancia sin caja</option>
                    <option value="STAFF_INTERNAL">Salida interna staff</option>
                  </Select>
                </label>
                <label style={field}>
                  <span style={fieldLabel}>Estado</span>
                  <Select value={manualStatus} onChange={(e) => setManualStatus(e.target.value)}>
                    <option value="COMPLETED">{statusLabel("COMPLETED")}</option>
                    <option value="WAITING">{statusLabel("WAITING")}</option>
                    <option value="READY_FOR_PLATFORM">{statusLabel("READY_FOR_PLATFORM")}</option>
                    <option value="IN_SEA">{statusLabel("IN_SEA")}</option>
                    <option value="CANCELED">{statusLabel("CANCELED")}</option>
                  </Select>
                </label>
              </div>
              <div style={presetHint}>
                Preset activo: <b>{manualPresetLabel(manualPreset)}</b>. Si cambias importes, pulsa <b>Autocompletar pagos</b>.{manualPreset === "STAFF_INTERNAL" ? " Se deja lista para Platform con importes a cero y sin caja." : ""}
              </div>
            </div>

            <div style={sectionCard}>
              <div style={sectionHeader}>
                <div style={sectionTitle}>Reserva</div>
                <div style={mutedText}>Mismos datos base que una reserva normal: cliente, servicio, capacidad y momento operativo.</div>
              </div>
              <div style={filtersGrid}>
                <label style={field}><span style={fieldLabel}>Cliente</span><Input value={manualCustomerName} onChange={(e) => setManualCustomerName(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Fecha</span><Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Hora</span><Input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Servicio</span><Select value={manualServiceId} onChange={(e) => setManualServiceId(e.target.value)}>{catalogServices.map((service) => <option key={service.id} value={service.id}>{service.name ?? service.id}</option>)}</Select></label>
                <label style={field}><span style={fieldLabel}>Opción</span><Select value={manualOptionId} onChange={(e) => setManualOptionId(e.target.value)}>{catalogOptions.filter((option) => option.serviceId === manualServiceId).map((option) => <option key={option.id} value={option.id}>{option.durationMinutes ?? "-"} min · pax {option.paxMax ?? "-"}</option>)}</Select></label>
                <label style={field}><span style={fieldLabel}>Canal</span><Select value={manualChannelId} onChange={(e) => setManualChannelId(e.target.value)}><option value="">Sin canal / interno</option>{catalogChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}</Select></label>
                <label style={field}><span style={fieldLabel}>Trabajador</span><Select value={manualEmployeeId} onChange={(e) => setManualEmployeeId(e.target.value)} disabled={manualPreset !== "STAFF_INTERNAL"}><option value="">{manualPreset === "STAFF_INTERNAL" ? "Sin vincular" : "Solo para salida interna"}</option>{internalStaffEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}{employee.code ? ` | ${employee.code}` : ""}{employee.kind ? ` | ${employee.kind}` : ""}</option>)}</Select></label>
                <label style={field}><span style={fieldLabel}>País</span><Input value={manualCountry} onChange={(e) => setManualCountry(e.target.value.toUpperCase())} maxLength={2} /></label>
                <label style={field}><span style={fieldLabel}>Teléfono</span><Input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Email</span><Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Detalle interno</span><Input value={manualInternalDetail} onChange={(e) => setManualInternalDetail(e.target.value.slice(0, 80))} placeholder="Ej: Carlos + amigo, test gasolina, validacion post-taller..." maxLength={80} /></label>
                <label style={field}><span style={fieldLabel}>Cantidad</span><Input type="number" min={1} value={manualQuantity} onChange={(e) => setManualQuantity(Number(e.target.value || 1))} /></label>
                <label style={field}><span style={fieldLabel}>PAX</span><Input type="number" min={1} value={manualPax} onChange={(e) => setManualPax(Number(e.target.value || 1))} /></label>
              </div>
              <div style={summaryStrip}>
                <Pill>Salida {manualDate || "--/--/----"} {manualTime || "--:--"}</Pill>
                <Pill>Cantidad {manualQuantity}</Pill>
                <Pill>PAX {manualPax}</Pill>
                <Pill>Contratos esperados {expectedManualContracts}</Pill>
              </div>
            </div>

            <div style={sectionCard}>
              <div style={sectionHeader}>
                <div style={sectionTitle}>Importes y caja</div>
                <div style={mutedText}>{manualPreset === "STAFF_INTERNAL" ? "Para staff interno se propone todo a cero y sin pagos, pero puedes ajustarlo si hace falta." : "Registra el total real y la fianza; luego genera la caja sugerida si hace falta."}</div>
              </div>
              <div style={filtersGrid}>
                <label style={field}><span style={fieldLabel}>Total servicio EUR</span><Input value={manualTotalEuros} onChange={(e) => setManualTotalEuros(e.target.value)} /></label>
                <label style={field}><span style={fieldLabel}>Fianza EUR</span><Input value={manualDepositEuros} onChange={(e) => setManualDepositEuros(e.target.value)} /></label>
              </div>
              <div style={summaryStrip}>
                <Pill>Servicio {euros(manualServiceTotalCents)}</Pill>
                <Pill>Fianza {euros(manualDepositTotalCents)}</Pill>
                <Pill>Caja servicio {euros(manualPaymentsSummary.serviceCents)}</Pill>
                <Pill>Caja fianza {euros(manualPaymentsSummary.depositCents)}</Pill>
                {selectedService ? <Pill>{selectedService.name ?? selectedService.id}</Pill> : null}
                {selectedOption ? <Pill>{selectedOption.durationMinutes ?? "-"} min</Pill> : null}
                {selectedChannel ? <Pill>{selectedChannel.name}</Pill> : null}
              </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>Pagos a registrar</div>
                <Button onClick={refillManualPaymentsFromPreset}>Autocompletar pagos</Button>
                <Button onClick={() => setManualPayments((prev) => [...prev, { amountEuros: "", method: "CARD", isDeposit: false, direction: "IN" }])}>Añadir pago</Button>
              </div>
              <div style={mutedText}>Sugerencia según preset: <b>{manualPresetLabel(manualPreset)}</b>.</div>
              {manualPayments.map((payment, index) => (
                <div key={index} style={paymentRow}>
                  <Select value={payment.method} onChange={(e) => setManualPayments((prev) => prev.map((line, i) => i === index ? { ...line, method: e.target.value as ManualPaymentDraft["method"] } : line))}>
                    <option value="CASH">Efectivo</option>
                    <option value="CARD">Tarjeta</option>
                    <option value="BIZUM">Bizum</option>
                    <option value="TRANSFER">Transfer</option>
                  </Select>
                  <Select value={payment.isDeposit ? "DEPOSIT" : "SERVICE"} onChange={(e) => setManualPayments((prev) => prev.map((line, i) => i === index ? { ...line, isDeposit: e.target.value === "DEPOSIT" } : line))}>
                    <option value="SERVICE">Servicio</option>
                    <option value="DEPOSIT">Fianza</option>
                  </Select>
                  <Select value={payment.direction} onChange={(e) => setManualPayments((prev) => prev.map((line, i) => i === index ? { ...line, direction: e.target.value as ManualPaymentDraft["direction"] } : line))}>
                    <option value="IN">Entrada</option>
                    <option value="OUT">Salida</option>
                  </Select>
                  <Input value={payment.amountEuros} onChange={(e) => setManualPayments((prev) => prev.map((line, i) => i === index ? { ...line, amountEuros: e.target.value } : line))} placeholder="Importe EUR" />
                  <Button onClick={() => setManualPayments((prev) => prev.filter((_, i) => i !== index))} disabled={manualPayments.length === 1}>Quitar</Button>
                </div>
              ))}
            </div>
            </div>

            <label style={field}>
              <span style={fieldLabel}>Motivo / nota</span>
              <Input value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="Ej: fallo de luz, registro omitido, venta recuperada a cierre..." />
            </label>

            <div style={mutedText}>
              Tras crear la reserva manual, podrás adjuntar en el histórico hasta <b>{expectedManualContracts} contrato(s)</b>, uno por unidad si aplica.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button onClick={() => { setManualOpen(false); resetManualForm(); }} disabled={manualBusy}>Cancelar</Button>
              <Button onClick={() => void createManualReservation()} disabled={manualBusy}>{manualBusy ? "Guardando..." : "Crear reserva manual"}</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {adjustTarget ? (
        <Card title={`Ajuste económico · ${adjustTarget.customerName || adjustTarget.id}`}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Ajusta el total real cobrado y la fianza manteniendo trazabilidad. El sistema registrará la corrección como ajuste financiero.
            </div>
            <div style={filtersGrid}>
              <label style={field}><span style={fieldLabel}>Total servicio EUR</span><Input value={adjustTotalEuros} onChange={(e) => setAdjustTotalEuros(e.target.value)} /></label>
              <label style={field}><span style={fieldLabel}>Fianza EUR</span><Input value={adjustDepositEuros} onChange={(e) => setAdjustDepositEuros(e.target.value)} /></label>
              <label style={{ ...field, gridColumn: "1 / -1" }}><span style={fieldLabel}>Motivo del ajuste</span><Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="Ej: descuento del mes no aplicado en sistema, cobro real inferior al registrado..." /></label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button onClick={() => setAdjustTarget(null)} disabled={adjustBusy}>Cancelar</Button>
              <Button onClick={() => void submitAdjustment()} disabled={adjustBusy}>{adjustBusy ? "Guardando..." : "Aplicar ajuste"}</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card
        title="Filtros"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill>{activeFilterCount} filtros activos</Pill>
            <Button onClick={resetFilters} disabled={activeFilterCount === 0}>
              Limpiar
            </Button>
          </div>
        }
      >
        <div style={{ ...mutedText, marginBottom: 14 }}>
          Filtra por estado, incidencias, fianza retenida o fechas para revisar cobro y trazabilidad sin mezclar casos.
        </div>
        <div style={filtersGrid}>
          <label style={field}>
            <span style={fieldLabel}>Buscar cliente</span>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del cliente" />
          </label>

          <label style={field}>
            <span style={fieldLabel}>Estado</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">Todos</option>
              <option value="SCHEDULED">{statusLabel("SCHEDULED")}</option>
              <option value="WAITING">{statusLabel("WAITING")}</option>
              <option value="READY_FOR_PLATFORM">{statusLabel("READY_FOR_PLATFORM")}</option>
              <option value="IN_SEA">{statusLabel("IN_SEA")}</option>
              <option value="COMPLETED">{statusLabel("COMPLETED")}</option>
              <option value="CANCELED">{statusLabel("CANCELED")}</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Incidencia</span>
            <Select value={hasIncident} onChange={(e) => setHasIncident(e.target.value)}>
              <option value="ALL">Todas</option>
              <option value="true">Con incidencia</option>
              <option value="false">Sin incidencia</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Fianza retenida</span>
            <Select value={depositHeld} onChange={(e) => setDepositHeld(e.target.value)}>
              <option value="ALL">Todas</option>
              <option value="true">Retenida</option>
              <option value="false">No retenida</option>
            </Select>
          </label>

          <label style={field}>
            <span style={fieldLabel}>Desde</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>

          <label style={field}>
            <span style={fieldLabel}>Hasta</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card title={`Bonos (${passRows.length})`}>
          <div style={{ display: "grid", gap: 10 }}>
            {passRows.length === 0 ? (
              <div style={mutedText}>Sin bonos en este rango.</div>
            ) : (
              passRows.map((row) => (
                <a key={row.id} href={`/store/bonos?code=${encodeURIComponent(row.code)}`} style={historyCommerceCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{row.product?.name ?? "Bono"}</strong>
                    <span>{row.code}</span>
                  </div>
                  <div style={mutedText}>
                    Vendido: <b>{dt(row.soldAt)}</b> | Cobrado: <b>{euros(row.paidCents)}</b>
                  </div>
                  <div style={mutedText}>
                    {row.isVoided ? `Anulado${row.voidedAt ? ` · ${dt(row.voidedAt)}` : ""}` : `Restante: ${row.minutesRemaining} / ${row.minutesTotal} min`}
                  </div>
                </a>
              ))
            )}
          </div>
        </Card>

        <Card title={`Regalos (${giftRows.length})`}>
          <div style={{ display: "grid", gap: 10 }}>
            {giftRows.length === 0 ? (
              <div style={mutedText}>Sin regalos en este rango.</div>
            ) : (
              giftRows.map((row) => (
                <a key={row.id} href="/store/gifts" style={historyCommerceCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong>{row.product?.name ?? "Regalo"}</strong>
                    <span>{row.code}</span>
                  </div>
                  <div style={mutedText}>
                    Vendido: <b>{dt(row.soldAt)}</b> | Cobrado: <b>{euros(row.paidCents)}</b>
                  </div>
                  <div style={mutedText}>
                    {row.isVoided ? `Anulado${row.voidedAt ? ` · ${dt(row.voidedAt)}` : ""}` : row.redeemedAt ? `Canjeado · ${dt(row.redeemedAt)}` : "Pendiente de canje"}
                  </div>
                </a>
              ))
            )}
          </div>
        </Card>
      </div>

      <StoreHistoryResultsSection
        rows={rows}
        loading={loading}
        error={error}
        euros={euros}
        dt={dt}
        statusTone={statusTone}
        incidentTone={incidentTone}
        countPaidServiceCents={countPaidServiceCents}
        countPendingServiceCents={countPendingServiceCents}
        statusLabel={statusLabel}
        mechanicsDetailHref={mechanicsDetailHref}
        mechanicsEventHref={mechanicsEventHref}
        reservationHref={reservationHref}
        cell={cell}
        mutedText={mutedText}
        mutedStack={mutedStack}
        detailBlock={detailBlock}
        badgeBase={badgeBase}
        moneyValue={moneyValue}
        incidentCard={incidentCard}
        incidentSummary={incidentSummary}
        actionLink={actionLink}
        emptyState={emptyState}
        onAdjustFinancials={openAdjustment}
        onUploadManualContract={uploadManualContract}
        onDownloadManualContract={downloadManualContract}
        manualContractBusyId={manualContractBusyId}
      />
    </div>
  );
}

const page: CSSProperties = {
  ...storeStyles.shell,
  width: "min(1760px, 100%)",
  display: "grid",
  gap: 18,
};

const heroCard: CSSProperties = {
  ...storeStyles.panel,
  background: "linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)",
  borderRadius: 26,
  padding: 22,
  display: "grid",
  gap: 18,
};

const heroHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 18,
};

const historyCommerceCard: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  fontWeight: 900,
  color: "#58708f",
};

const heroTitle: CSSProperties = {
  ...opsStyles.heroTitle,
  margin: 0,
  fontSize: "clamp(2rem, 4vw, 3rem)",
  lineHeight: 1,
  color: "#142033",
};

const heroSubtitle: CSSProperties = {
  fontSize: 14,
  color: "#51627b",
  maxWidth: 760,
};

const heroInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginTop: 4,
};

const heroInfoCard: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #dbe4ea",
  background: "rgba(255, 255, 255, 0.9)",
  fontSize: 12,
  color: "#475569",
};

const secondaryLink: CSSProperties = {
  ...storeStyles.secondaryButton,
  padding: "10px 12px",
  color: "#111",
  fontWeight: 900,
  textDecoration: "none",
};

const primaryButton: CSSProperties = {
  ...storeStyles.primaryButton,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
  alignItems: "end",
};

const field: CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const sectionCard: CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const sectionHeader: CSSProperties = {
  display: "grid",
  gap: 4,
};

const sectionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0f172a",
};

const presetHint: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e3a8a",
  fontSize: 12,
};

const summaryStrip: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const paymentRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr)) auto",
  gap: 10,
};

const emptyState: CSSProperties = {
  padding: "26px 10px",
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const cell: CSSProperties = {
  ...styles.td,
  padding: "16px 12px",
};

const mutedText: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
};

const mutedStack: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 12,
  color: "#64748b",
};

const detailBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid #edf2f7",
  borderRadius: 12,
  background: "#f8fafc",
  fontSize: 12,
  color: "#334155",
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid transparent",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const moneyValue: CSSProperties = {
  fontWeight: 900,
  color: "#0f172a",
};

const incidentCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 14,
  padding: 10,
};

const incidentSummary: CSSProperties = {
  cursor: "pointer",
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  listStyle: "none",
};

const actionLink: CSSProperties = {
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "9px 10px",
  borderRadius: 12,
  border: "1px solid #dbe4ea",
  background: "#fff",
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};
