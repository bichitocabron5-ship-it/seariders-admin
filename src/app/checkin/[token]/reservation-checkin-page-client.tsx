"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PublicBrandHeader } from "@/components/brand";
import { BirthDateField, PhoneWithCountryField } from "@/components/customer-inputs";
import { ActionButton, AlertBanner, SectionCard, StatusBadge as BrandStatusBadge } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";
import { getCountryOptionsEs } from "@/lib/countries";
import {
  formatPublicDate,
  formatPublicTime,
  getPublicCopy,
  type PublicLanguage,
} from "@/lib/public-links/i18n";

const COUNTRY_OPTIONS = getCountryOptionsEs();

type ReservationView = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  marketing: string | null;
  customerCountry: string | null;
  customerAddress: string | null;
  customerPostalCode: string | null;
  customerBirthDate: string | null;
  customerDocType: string | null;
  customerDocNumber: string | null;
  isLicense: boolean;
  activityDate: string;
  scheduledTime: string | null;
  serviceName: string;
  serviceCategory: string | null;
  durationMinutes: number | null;
  requiredUnits: number;
  readyCount: number;
  signedCount: number;
};

type ContractView = {
  id: string;
  unitIndex: number;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  driverEmail: string | null;
  driverCountry: string | null;
  driverAddress: string | null;
  driverPostalCode: string | null;
  driverDocType: string | null;
  driverDocNumber: string | null;
  driverBirthDate: string | null;
  minorNeedsAuthorization: boolean;
  minorAuthorizationProvided: boolean;
  minorAuthorizationFileKey?: string | null;
  minorAuthorizationFileName: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  imageConsentAccepted: boolean;
  signedAt: string | null;
  signatureSignedBy: string | null;
  preparedResourceLabel: string;
  renderedHtml: string;
};

type Snapshot = {
  reservation: ReservationView;
  contracts: ContractView[];
};

type DraftContract = {
  id: string;
  driverName: string;
  driverPhone: string;
  driverEmail: string;
  driverCountry: string;
  driverAddress: string;
  driverPostalCode: string;
  driverDocType: string;
  driverDocNumber: string;
  driverBirthDate: string;
  minorAuthorizationProvided: boolean;
  imageConsentAccepted: boolean;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
};

type ContractFieldErrors = {
  driverName?: string | null;
  driverPhone?: string | null;
  driverAddress?: string | null;
  driverBirthDate?: string | null;
  driverDocType?: string | null;
  driverDocNumber?: string | null;
  minorAuthorizationProvided?: string | null;
  minorAuthorizationFile?: string | null;
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  action?: string | null;
};

function getCheckinValidationText(language: PublicLanguage) {
  if (language === "en") {
    return {
      driverName: "Enter the driver's full name.",
      driverPhone: "Enter the driver's phone number.",
      driverAddress: "Enter the driver's address.",
      driverBirthDate: "Enter the driver's birth date.",
      driverDocType: "Select the document type.",
      driverDocNumber: "Enter the document number.",
      minorAuthorizationProvided: "You must confirm the parent or guardian authorization.",
      minorAuthorizationFile: "The authorization document must be validated in store before signing.",
      licenseSchool: "Enter the license issuer or school.",
      licenseType: "Enter the license type.",
      licenseNumber: "Enter the license number.",
      under16: "A contract cannot be signed for a driver under 16 years old.",
      completeBeforeSign: "Complete the required fields before signing this contract.",
    };
  }

  return {
    driverName: "Indica el nombre completo del conductor.",
    driverPhone: "Indica el telefono del conductor.",
    driverAddress: "Indica la direccion del conductor.",
    driverBirthDate: "Indica la fecha de nacimiento del conductor.",
    driverDocType: "Selecciona el tipo de documento.",
    driverDocNumber: "Indica el numero de documento.",
    minorAuthorizationProvided: "Debes confirmar la autorizacion del padre, madre o tutor.",
    minorAuthorizationFile: "La autorizacion debe validarse en tienda antes de poder firmar.",
    licenseSchool: "Indica la escuela o emisor de la licencia.",
    licenseType: "Indica el tipo de licencia.",
    licenseNumber: "Indica el numero de licencia.",
    under16: "No se puede firmar un contrato para un menor de 16 anos.",
    completeBeforeSign: "Completa los campos obligatorios antes de firmar este contrato.",
  };
}

function getAgeFlagsFromBirthDate(value: string) {
  if (!value) return { isUnder16: false, needsAuthorization: false };
  const birthDate = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return { isUnder16: false, needsAuthorization: false };
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) age--;
  return {
    isUnder16: age < 16,
    needsAuthorization: age >= 16 && age < 18,
  };
}

function getContractFieldErrors({
  contract,
  draft,
  isLicense,
  language,
}: {
  contract: ContractView;
  draft: DraftContract;
  isLicense: boolean;
  language: PublicLanguage;
}): ContractFieldErrors {
  const text = getCheckinValidationText(language);
  const minor = getAgeFlagsFromBirthDate(draft.driverBirthDate);
  const errors: ContractFieldErrors = {
    driverName: draft.driverName.trim() ? null : text.driverName,
    driverPhone: null,
    driverAddress: draft.driverAddress.trim() ? null : text.driverAddress,
    driverBirthDate: draft.driverBirthDate.trim() ? null : text.driverBirthDate,
    driverDocType: draft.driverDocType.trim() ? null : text.driverDocType,
    driverDocNumber: draft.driverDocNumber.trim() ? null : text.driverDocNumber,
    minorAuthorizationProvided:
      minor.needsAuthorization && !draft.minorAuthorizationProvided ? text.minorAuthorizationProvided : null,
    minorAuthorizationFile:
      minor.needsAuthorization && !contract.minorAuthorizationFileKey ? text.minorAuthorizationFile : null,
    licenseSchool: isLicense && !draft.licenseSchool.trim() ? text.licenseSchool : null,
    licenseType: isLicense && !draft.licenseType.trim() ? text.licenseType : null,
    licenseNumber: isLicense && !draft.licenseNumber.trim() ? text.licenseNumber : null,
    action: minor.isUnder16 ? text.under16 : null,
  };

  if (!errors.action && Object.entries(errors).some(([key, value]) => key !== "action" && Boolean(value))) {
    errors.action = text.completeBeforeSign;
  }

  return errors;
}

function autosaveTone(state: "idle" | "saving" | "saved" | "error", copy: ReturnType<typeof getPublicCopy>) {
  if (state === "saving") return { label: copy.checkinPage.autosaveSaving, color: "#1d4ed8" };
  if (state === "saved") return { label: copy.checkinPage.autosaveSaved, color: "#166534" };
  if (state === "error") return { label: copy.checkinPage.autosaveError, color: "#991b1b" };
  return { label: copy.checkinPage.autosaveIdle, color: "#475569" };
}

function autosaveBadgeTone(state: "idle" | "saving" | "saved" | "error") {
  if (state === "saving") return "info" as const;
  if (state === "saved") return "success" as const;
  if (state === "error") return "danger" as const;
  return "neutral" as const;
}

function getContractStatusBadge(status: string, language: PublicLanguage) {
  if (language === "en") {
    if (status === "SIGNED") return { tone: "success" as const, label: "Signed" };
    if (status === "READY") return { tone: "info" as const, label: "Ready" };
    return { tone: "warning" as const, label: "Pending" };
  }

  if (status === "SIGNED") return { tone: "success" as const, label: "Firmado" };
  if (status === "READY") return { tone: "info" as const, label: "Listo" };
  return { tone: "warning" as const, label: "Pendiente" };
}

export function ReservationCheckinPageClient({
  token,
  language,
}: {
  token: string;
  language: PublicLanguage;
}) {
  const copy = getPublicCopy(language);
  const sigRefs = useRef<Record<string, SignatureCanvas | null>>({});
  const lastSavedPayloadRef = useRef<string>("");
  const autosaveTimerRef = useRef<number | null>(null);
  const reservationDraftRef = useRef({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    marketing: "",
    customerCountry: "",
    customerAddress: "",
    customerPostalCode: "",
    customerBirthDate: "",
    customerDocType: "",
    customerDocNumber: "",
  });
  const contractDraftsRef = useRef<Record<string, DraftContract>>({});
  const saveRequestSeqRef = useRef(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window === "undefined" ? 1280 : window.innerWidth);
  const [attemptedSignContracts, setAttemptedSignContracts] = useState<Record<string, boolean>>({});
  const [contractActionErrors, setContractActionErrors] = useState<Record<string, string | null>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [reservationDraft, setReservationDraft] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    marketing: "",
    customerCountry: "",
    customerAddress: "",
    customerPostalCode: "",
    customerBirthDate: "",
    customerDocType: "",
    customerDocNumber: "",
  });
  const [contractDrafts, setContractDrafts] = useState<Record<string, DraftContract>>({});

  useEffect(() => {
    reservationDraftRef.current = reservationDraft;
  }, [reservationDraft]);

  useEffect(() => {
    contractDraftsRef.current = contractDrafts;
  }, [contractDrafts]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateViewport = () => setViewportWidth(window.innerWidth);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  const serializePayload = useCallback((reservation: typeof reservationDraft, drafts: Record<string, DraftContract>) => {
    return JSON.stringify({
      reservation,
      contracts: Object.values(drafts)
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id)),
    });
  }, []);

  const hydrate = useCallback((data: Snapshot) => {
    setSnapshot(data);
    const nextReservationDraft = {
      customerName: data.reservation.customerName ?? "",
      customerPhone: data.reservation.customerPhone ?? "",
      customerEmail: data.reservation.customerEmail ?? "",
      marketing: data.reservation.marketing ?? "",
      customerCountry: data.reservation.customerCountry ?? "ES",
      customerAddress: data.reservation.customerAddress ?? "",
      customerPostalCode: data.reservation.customerPostalCode ?? "",
      customerBirthDate: data.reservation.customerBirthDate ? data.reservation.customerBirthDate.slice(0, 10) : "",
      customerDocType: data.reservation.customerDocType ?? "",
      customerDocNumber: data.reservation.customerDocNumber ?? "",
    };
    setReservationDraft(nextReservationDraft);

    const nextDrafts: Record<string, DraftContract> = {};
    for (const contract of data.contracts) {
      nextDrafts[contract.id] = {
        id: contract.id,
        driverName: contract.driverName ?? "",
        driverPhone: contract.driverPhone ?? "",
        driverEmail: contract.driverEmail ?? "",
        driverCountry: contract.driverCountry ?? data.reservation.customerCountry ?? "ES",
        driverAddress: contract.driverAddress ?? "",
        driverPostalCode: contract.driverPostalCode ?? "",
        driverDocType: contract.driverDocType ?? "",
        driverDocNumber: contract.driverDocNumber ?? "",
        driverBirthDate: contract.driverBirthDate ? contract.driverBirthDate.slice(0, 10) : "",
        minorAuthorizationProvided: Boolean(contract.minorAuthorizationProvided),
        imageConsentAccepted: Boolean(contract.imageConsentAccepted),
        licenseSchool: contract.licenseSchool ?? "",
        licenseType: contract.licenseType ?? "",
        licenseNumber: contract.licenseNumber ?? "",
      };
    }
    setContractDrafts(nextDrafts);
    setAttemptedSignContracts({});
    setContractActionErrors({});
    reservationDraftRef.current = nextReservationDraft;
    contractDraftsRef.current = nextDrafts;
    lastSavedPayloadRef.current = serializePayload(nextReservationDraft, nextDrafts);
    setAutosaveState("idle");
  }, [serializePayload]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { reservation: ReservationView; contracts: ContractView[] };
        hydrate(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : copy.checkinPage.loadFailed);
      } finally {
        setLoading(false);
      }
    })();
  }, [copy.checkinPage.loadFailed, hydrate, language, token]);

  const persistAll = useCallback(async (mode: "manual" | "autosave") => {
    try {
      if (mode === "manual") {
        setSaving(true);
        setError(null);
        setSuccess(null);
      } else {
        setAutosaveState("saving");
      }

      const serialized = serializePayload(reservationDraft, contractDrafts);
      const requestSeq = ++saveRequestSeqRef.current;
      const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation: {
            ...reservationDraft,
            customerBirthDate: reservationDraft.customerBirthDate ? new Date(`${reservationDraft.customerBirthDate}T00:00:00.000Z`).toISOString() : null,
          },
          contracts: Object.values(contractDrafts).map((draft) => ({
            ...draft,
            driverBirthDate: draft.driverBirthDate ? new Date(`${draft.driverBirthDate}T00:00:00.000Z`).toISOString() : null,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Snapshot;
      const latestSerialized = serializePayload(reservationDraftRef.current, contractDraftsRef.current);
      const isLatestRequest = requestSeq === saveRequestSeqRef.current;
      const hasLocalChangesSinceRequest = latestSerialized !== serialized;

      if (mode === "manual" || (isLatestRequest && !hasLocalChangesSinceRequest)) {
        hydrate(data);
        lastSavedPayloadRef.current = serialized;
      } else {
        lastSavedPayloadRef.current = serialized;
      }

      if (mode === "manual") {
        setSuccess(copy.checkinPage.saved);
      } else {
        setAutosaveState(hasLocalChangesSinceRequest ? "idle" : "saved");
      }
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : copy.checkinPage.loadFailed;
      setError(message);
      if (mode === "autosave") setAutosaveState("error");
      return false;
    } finally {
      if (mode === "manual") setSaving(false);
    }
  }, [contractDrafts, copy.checkinPage.loadFailed, copy.checkinPage.saved, hydrate, language, reservationDraft, serializePayload, token]);

  const saveAll = useCallback(async () => await persistAll("manual"), [persistAll]);

  async function signContract(contractId: string) {
    const signature = sigRefs.current[contractId];
    const draft = contractDrafts[contractId];
    const contract = snapshot?.contracts.find((item) => item.id === contractId);
    if (!draft) return;

    try {
      setSigningId(contractId);
      setError(null);
      setSuccess(null);
      setAttemptedSignContracts((current) => ({ ...current, [contractId]: true }));

      if (contract) {
        const fieldErrors = getContractFieldErrors({
          contract,
          draft,
          isLicense: snapshot?.reservation.isLicense ?? false,
          language,
        });
        if (fieldErrors.action) {
          setContractActionErrors((current) => ({ ...current, [contractId]: fieldErrors.action ?? null }));
          return;
        }
      }

      const saved = await persistAll("manual");
      if (!saved) return;
      if (!signature || signature.isEmpty()) throw new Error(copy.signPage.errors.signatureEmpty);
      if (!draft.driverName.trim() && !reservationDraft.customerName.trim()) throw new Error(copy.signPage.errors.signerRequired);

      const signerName = draft.driverName.trim() || reservationDraft.customerName.trim();
      const res = await fetch(`/api/public/checkin/${encodeURIComponent(token)}/contracts/${contractId}/signature?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          imageDataUrl: signature.getTrimmedCanvas().toDataURL("image/png"),
        }),
      });
      if (!res.ok) throw new Error(await res.text());

      const refresh = await fetch(`/api/public/checkin/${encodeURIComponent(token)}?lang=${encodeURIComponent(language)}`, {
        cache: "no-store",
      });
      if (!refresh.ok) throw new Error(await refresh.text());
      const data = (await refresh.json()) as Snapshot;
      hydrate(data);
      signature.clear();
      setContractActionErrors((current) => ({ ...current, [contractId]: null }));
      setSuccess(copy.checkinPage.signedBanner(signerName, formatPublicDate(new Date().toISOString(), language)));
    } catch (e: unknown) {
      setContractActionErrors((current) => ({
        ...current,
        [contractId]: e instanceof Error ? e.message : copy.checkinPage.loadFailed,
      }));
      setError(e instanceof Error ? e.message : copy.checkinPage.loadFailed);
    } finally {
      setSigningId(null);
    }
  }

  function copyHolderToContract(contractId: string) {
    setContractActionErrors((current) => ({ ...current, [contractId]: null }));
    setContractDrafts((current) => {
      const draft = current[contractId];
      if (!draft) return current;

      return {
        ...current,
        [contractId]: {
          ...draft,
          driverName: reservationDraft.customerName,
          driverPhone: reservationDraft.customerPhone,
          driverEmail: reservationDraft.customerEmail,
          driverCountry: reservationDraft.customerCountry,
          driverAddress: reservationDraft.customerAddress,
          driverPostalCode: reservationDraft.customerPostalCode,
          driverDocType: reservationDraft.customerDocType,
          driverDocNumber: reservationDraft.customerDocNumber,
          driverBirthDate: reservationDraft.customerBirthDate,
        },
      };
    });
  }

  function updateContractDraft(contractId: string, patch: Partial<DraftContract>) {
    setContractActionErrors((current) => ({ ...current, [contractId]: null }));
    setContractDrafts((current) => {
      const draft = current[contractId];
      if (!draft) return current;
      return {
        ...current,
        [contractId]: {
          ...draft,
          ...patch,
        },
      };
    });
  }

  useEffect(() => {
    if (!snapshot || loading) return;
    if (saving || signingId) return;

    const serialized = serializePayload(reservationDraft, contractDrafts);
    if (serialized === lastSavedPayloadRef.current) return;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistAll("autosave");
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [snapshot, loading, saving, signingId, reservationDraft, contractDrafts, persistAll, serializePayload]);

  if (loading) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#475569" }}>{copy.checkinPage.loading}</main>;
  }

  if (!snapshot) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#991b1b", padding: 24 }}>{error ?? copy.checkinPage.loadFailed}</main>;
  }

  const autosave = autosaveTone(autosaveState, copy);
  const isMobile = viewportWidth < 640;
  const signatureCanvasWidth = Math.max(280, Math.min(900, viewportWidth - (isMobile ? 48 : 120)));
  const signatureCanvasHeight = isMobile ? 220 : 260;
  const holderSummary = [
    snapshot.reservation.customerName,
    snapshot.reservation.customerPhone,
    snapshot.reservation.customerEmail,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: brand.gradients.publicHero,
        padding: isMobile ? "16px 12px 32px" : "24px 16px 40px",
      }}
    >
      <section
        style={{
          width: "min(1120px, 100%)",
          margin: "0 auto",
          display: "grid",
          gap: 16,
        }}
      >
        <PublicBrandHeader
          eyebrow={copy.checkinPage.eyebrow}
          title={copy.checkinPage.title}
          subtitle="Revision de datos, pre-checkin y firma de contratos dentro del ecosistema SeaRiders."
        />
        <SectionCard
          eyebrow="Pre-checkin"
          title={copy.checkinPage.title}
          action={<BrandStatusBadge tone={autosaveBadgeTone(autosaveState)}>{autosave.label}</BrandStatusBadge>}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontSize: 14 }}>
              {snapshot.reservation.serviceName}
              {snapshot.reservation.durationMinutes ? ` | ${snapshot.reservation.durationMinutes} min` : ""}
              {` | ${formatPublicDate(snapshot.reservation.activityDate, language)} | ${formatPublicTime(snapshot.reservation.scheduledTime, language)}`}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <BrandStatusBadge tone="neutral">{snapshot.reservation.serviceName}</BrandStatusBadge>
              {snapshot.reservation.durationMinutes ? <BrandStatusBadge tone="neutral">{snapshot.reservation.durationMinutes} min</BrandStatusBadge> : null}
              <BrandStatusBadge tone="neutral">{formatPublicDate(snapshot.reservation.activityDate, language)}</BrandStatusBadge>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <MetricCard label={copy.checkinPage.metrics.contracts} value={`${snapshot.reservation.signedCount}/${snapshot.reservation.requiredUnits}`} description={copy.checkinPage.metrics.signed} />
            <MetricCard label={copy.checkinPage.metrics.ready} value={`${snapshot.reservation.readyCount}/${snapshot.reservation.requiredUnits}`} description={copy.checkinPage.metrics.prepared} />
            <MetricCard label={copy.checkinPage.metrics.holder} value={snapshot.reservation.customerName || copy.checkinPage.metrics.pending} description={copy.checkinPage.metrics.holder} />
          </div>

          <AlertBanner tone="info">{copy.checkinPage.intro}</AlertBanner>

          {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
          {success ? <AlertBanner tone="success">{success}</AlertBanner> : null}

          <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{copy.checkinPage.holderTitle}</h2>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              {copy.checkinPage.holderHelp}
            </div>
            {holderSummary ? <ReadOnlyField label={copy.checkinPage.bookingSummary} value={holderSummary} /> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <SelectField label={copy.common.marketingLabel} value={reservationDraft.marketing} options={copy.common.marketingOptions} onChange={(value) => setReservationDraft((current) => ({ ...current, marketing: value }))} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <ActionButton onClick={() => void saveAll()} disabled={saving} style={saving ? { opacity: 0.7 } : undefined}>
                {saving ? copy.checkinPage.saving : copy.checkinPage.save}
              </ActionButton>
            </div>
          </section>
        </SectionCard>

        {snapshot.contracts.map((contract) => {
          const draft = contractDrafts[contract.id];
          const disabled = contract.status === "SIGNED";
          const statusBadge = getContractStatusBadge(contract.status, language);
          const fieldErrors = draft
            ? getContractFieldErrors({
                contract,
                draft,
                isLicense: snapshot.reservation.isLicense,
                language,
              })
            : {};
          const showFieldErrors = Boolean(attemptedSignContracts[contract.id]) && !disabled;
          const actionError = contractActionErrors[contract.id] ?? (showFieldErrors ? fieldErrors.action ?? null : null);
          return (
            <details
              key={contract.id}
              open={snapshot.contracts.length === 1 || contract.status !== "SIGNED"}
              style={{
                background: "#fff",
                borderRadius: 22,
                border: "1px solid #e2e8f0",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  padding: 18,
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900, fontSize: 20 }}>{copy.checkinPage.unitTitle(contract.unitIndex)}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {draft?.driverName || copy.checkinPage.pendingDriver}
                    {contract.signedAt ? ` | ${copy.checkinPage.signedOn(formatPublicDate(contract.signedAt, language))}` : ""}
                  </div>
                </div>
                <BrandStatusBadge tone={statusBadge.tone}>{statusBadge.label}</BrandStatusBadge>
              </summary>

              <div style={{ display: "grid", gap: 16, padding: "0 18px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <ActionButton onClick={() => copyHolderToContract(contract.id)} disabled={disabled} variant="secondary">
                    {copy.checkinPage.useHolder}
                  </ActionButton>
                  <ActionButton
                    href={`/api/public/checkin/${encodeURIComponent(token)}/contracts/${contract.id}/pdf?lang=${encodeURIComponent(language)}`}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                  >
                    {copy.checkinPage.printable}
                  </ActionButton>
                </div>

                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                  {copy.checkinPage.contractHelp}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  <ReadOnlyField label={copy.checkinPage.scheduledTime} value={formatPublicTime(snapshot.reservation.scheduledTime, language)} />
                  <ReadOnlyField label={copy.checkinPage.duration} value={snapshot.reservation.durationMinutes ? `${snapshot.reservation.durationMinutes} min` : copy.checkinPage.accordingToReservation} />
                  <ReadOnlyField label={copy.checkinPage.assignedResource} value={contract.preparedResourceLabel} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <Field label={copy.checkinPage.driverName} value={draft?.driverName ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.driverName : null} onChange={(value) => updateContractDraft(contract.id, { driverName: value })} />
                  <PhoneWithCountryField
                    label={copy.checkinPage.driverPhone}
                    country={draft?.driverCountry ?? ""}
                    phone={draft?.driverPhone ?? ""}
                    disabled={disabled}
                    onCountryChange={(value) => updateContractDraft(contract.id, { driverCountry: value })}
                    onPhoneChange={(value) => updateContractDraft(contract.id, { driverPhone: value })}
                    countryOptions={COUNTRY_OPTIONS}
                    inputStyle={showFieldErrors && fieldErrors.driverPhone ? errorInputStyle : inputStyle}
                    phonePlaceholder="Ej: 612345678"
                    error={showFieldErrors ? fieldErrors.driverPhone : null}
                  />
                  <Field label={copy.checkinPage.driverEmail} value={draft?.driverEmail ?? ""} disabled={disabled} onChange={(value) => updateContractDraft(contract.id, { driverEmail: value })} />
                  <Field label={copy.checkinPage.driverAddress} value={draft?.driverAddress ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.driverAddress : null} onChange={(value) => updateContractDraft(contract.id, { driverAddress: value })} />
                  <Field label={copy.checkinPage.driverPostalCode} value={draft?.driverPostalCode ?? ""} disabled={disabled} onChange={(value) => updateContractDraft(contract.id, { driverPostalCode: value })} />
                  <BirthDateField label={copy.checkinPage.driverBirthDate} value={draft?.driverBirthDate ?? ""} disabled={disabled} onChange={(value) => updateContractDraft(contract.id, { driverBirthDate: value })} style={showFieldErrors && fieldErrors.driverBirthDate ? errorInputStyle : inputStyle} error={showFieldErrors ? fieldErrors.driverBirthDate : null} />
                  <SelectField label={`${copy.common.documentTypeLabel} *`} value={draft?.driverDocType ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.driverDocType : null} options={copy.common.documentTypeOptions} onChange={(value) => updateContractDraft(contract.id, { driverDocType: value })} />
                  <Field label={`${copy.common.documentNumberLabel} *`} value={draft?.driverDocNumber ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.driverDocNumber : null} onChange={(value) => updateContractDraft(contract.id, { driverDocNumber: value })} />
                  {snapshot.reservation.isLicense ? (
                    <>
                      <Field label={copy.checkinPage.licenseSchool} value={draft?.licenseSchool ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.licenseSchool : null} onChange={(value) => updateContractDraft(contract.id, { licenseSchool: value })} />
                      <Field label={copy.checkinPage.licenseType} value={draft?.licenseType ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.licenseType : null} onChange={(value) => updateContractDraft(contract.id, { licenseType: value })} />
                      <Field label={copy.checkinPage.licenseNumber} value={draft?.licenseNumber ?? ""} disabled={disabled} error={showFieldErrors ? fieldErrors.licenseNumber : null} onChange={(value) => updateContractDraft(contract.id, { licenseNumber: value })} />
                    </>
                  ) : null}
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={Boolean(draft?.imageConsentAccepted)}
                    disabled={disabled}
                    onChange={(e) => updateContractDraft(contract.id, { imageConsentAccepted: e.target.checked })}
                    style={{ marginTop: 2 }}
                  />
                  <span>{copy.checkinPage.imageConsent}</span>
                </label>

                {contract.minorNeedsAuthorization || draft?.minorAuthorizationProvided ? (
                  <label
                    style={{
                      ...checkboxLabelStyle,
                      border: showFieldErrors && (fieldErrors.minorAuthorizationProvided || fieldErrors.minorAuthorizationFile) ? "1px solid #ef4444" : "1px solid #fde68a",
                      background: showFieldErrors && (fieldErrors.minorAuthorizationProvided || fieldErrors.minorAuthorizationFile) ? "#fff5f5" : "#fffbeb",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(draft?.minorAuthorizationProvided)}
                      disabled={disabled}
                      onChange={(e) => updateContractDraft(contract.id, { minorAuthorizationProvided: e.target.checked })}
                      style={{ marginTop: 2 }}
                    />
                    <span>{copy.checkinPage.tutorAuthorization(contract.minorAuthorizationFileName)}</span>
                  </label>
                ) : null}
                {showFieldErrors && fieldErrors.minorAuthorizationProvided ? <div style={inlineErrorStyle}>{fieldErrors.minorAuthorizationProvided}</div> : null}
                {showFieldErrors && fieldErrors.minorAuthorizationFile ? <div style={inlineErrorStyle}>{fieldErrors.minorAuthorizationFile}</div> : null}

                <div style={documentFrameStyle}>
                  <iframe
                    title={`Contract ${contract.unitIndex}`}
                    srcDoc={contract.renderedHtml}
                    style={{
                      width: "100%",
                      height: isMobile ? "58vh" : "min(72vh, 980px)",
                      border: 0,
                      display: "block",
                      background: "#fff",
                    }}
                  />
                </div>

                {!disabled ? (
                  <>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={signatureTitleStyle}>{copy.checkinPage.signatureTitle}</div>
                      <div style={signatureHelpStyle}>
                        {copy.checkinPage.signatureHelp}
                      </div>
                    </div>

                    <div style={signatureFrameStyle}>
                      <SignatureCanvas
                        ref={(instance) => {
                          sigRefs.current[contract.id] = instance;
                        }}
                        penColor="black"
                        canvasProps={{
                          width: signatureCanvasWidth,
                          height: signatureCanvasHeight,
                          style: {
                            width: "100%",
                            height: signatureCanvasHeight,
                            display: "block",
                            background: "#fff",
                            touchAction: "none",
                          },
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <ActionButton
                        onClick={() => sigRefs.current[contract.id]?.clear()}
                        variant="secondary"
                      >
                        {copy.checkinPage.clearSignature}
                      </ActionButton>
                      <ActionButton
                        onClick={() => void signContract(contract.id)}
                        disabled={signingId === contract.id}
                        style={signingId === contract.id ? { opacity: 0.7 } : undefined}
                      >
                        {signingId === contract.id ? copy.checkinPage.signing : copy.checkinPage.signContract}
                      </ActionButton>
                    </div>
                    {actionError ? <AlertBanner tone="danger">{actionError}</AlertBanner> : null}
                  </>
                ) : (
                  <AlertBanner tone="success">
                    {copy.checkinPage.signedBanner(contract.signatureSignedBy || contract.driverName || "customer", formatPublicDate(contract.signedAt, language))}
                  </AlertBanner>
                )}
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricDescriptionStyle}>{description}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={error ? errorInputStyle : inputStyle} />
      {error ? <div style={inlineErrorStyle}>{error}</div> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={error ? errorInputStyle : inputStyle}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <div style={inlineErrorStyle}>{error}</div> : null}
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      <div
        style={{
          ...inputStyle,
          color: "#475569",
          background: "#f8fafc",
          minHeight: 48,
          display: "flex",
          alignItems: "center",
        }}
      >
        {value}
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${brand.colors.border}`,
  fontSize: 15,
  background: "#fff",
};

const errorInputStyle: React.CSSProperties = {
  ...inputStyle,
  border: "1px solid #ef4444",
  background: "#fff5f5",
};

const inlineErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#b91c1c",
  fontWeight: 700,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${brand.colors.border}`,
  background: "#f8fbfd",
  fontSize: 14,
  color: "#0f172a",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: brand.colors.primary,
};

const metricCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: `1px solid ${brand.colors.border}`,
  background: "linear-gradient(180deg, #fbfdff 0%, #f4f8fb 100%)",
  boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)",
  display: "grid",
  gap: 4,
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#64748b",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: brand.colors.primary,
};

const metricDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#475569",
  lineHeight: 1.45,
};

const documentFrameStyle: React.CSSProperties = {
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 18,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
};

const signatureFrameStyle: React.CSSProperties = {
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 18,
  overflow: "hidden",
  background: "#fff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
};

const signatureTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: brand.colors.primary,
};

const signatureHelpStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  lineHeight: 1.5,
};
