"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { PublicBrandHeader } from "@/components/brand";
import { BirthDateField } from "@/components/customer-inputs";
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
  quantity: number | null;
  pax: number | null;
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
  driverCountry?: string | null;
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

type WizardStep = "personal" | "license" | "conditions" | "signature";

const WIZARD_STEPS: WizardStep[] = ["personal", "license", "conditions", "signature"];

function getCheckinValidationText(language: PublicLanguage) {
  if (language === "en") {
    return {
      driverName: "Enter the driver's full name.",
      driverPhone: "Enter the driver's phone number.",
      driverCountry: "Select the driver's country.",
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
    driverCountry: "Selecciona el pais del conductor.",
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
    driverCountry: draft.driverCountry.trim() ? null : text.driverCountry,
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

function contractRequiresLicense(isReservationLicense: boolean, contract: ContractView, draft?: DraftContract) {
  return (
    isReservationLicense ||
    Boolean(contract.licenseSchool?.trim()) ||
    Boolean(contract.licenseType?.trim()) ||
    Boolean(contract.licenseNumber?.trim()) ||
    Boolean(draft?.licenseSchool.trim()) ||
    Boolean(draft?.licenseType.trim()) ||
    Boolean(draft?.licenseNumber.trim())
  );
}

function getVisibleWizardSteps(requiresLicense: boolean) {
  return requiresLicense ? WIZARD_STEPS : WIZARD_STEPS.filter((step) => step !== "license");
}

function hasPersonalErrors(errors: ContractFieldErrors) {
  return Boolean(
    errors.driverName ||
      errors.driverCountry ||
      errors.driverAddress ||
      errors.driverBirthDate ||
      errors.driverDocType ||
      errors.driverDocNumber ||
      errors.action
  );
}

function hasLicenseErrors(errors: ContractFieldErrors) {
  return Boolean(errors.licenseSchool || errors.licenseType || errors.licenseNumber);
}

function hasConditionErrors(errors: ContractFieldErrors, confirmedRead: boolean) {
  return Boolean(!confirmedRead || errors.minorAuthorizationProvided || errors.minorAuthorizationFile);
}

function hasStepErrors(step: WizardStep, errors: ContractFieldErrors, confirmedRead: boolean) {
  if (step === "personal") return hasPersonalErrors(errors);
  if (step === "license") return hasLicenseErrors(errors);
  if (step === "conditions") return hasConditionErrors(errors, confirmedRead);
  return false;
}

function firstBlockingStep(errors: ContractFieldErrors, requiresLicense: boolean, confirmedRead: boolean): WizardStep | null {
  if (hasPersonalErrors(errors)) return "personal";
  if (requiresLicense && hasLicenseErrors(errors)) return "license";
  if (hasConditionErrors(errors, confirmedRead)) return "conditions";
  return null;
}

function getStepErrorMessage({
  step,
  errors,
  confirmedRead,
  copy,
}: {
  step: WizardStep;
  errors: ContractFieldErrors;
  confirmedRead: boolean;
  copy: ReturnType<typeof getPublicCopy>;
}) {
  if (step === "personal" && errors.action) return errors.action;
  if (step === "conditions" && !confirmedRead) return copy.signPage.errors.mustRead;
  if (hasStepErrors(step, errors, confirmedRead)) return copy.checkinPage.wizard.completeStep;
  return null;
}

function getNextWizardStep(currentStep: WizardStep, requiresLicense: boolean) {
  const steps = getVisibleWizardSteps(requiresLicense);
  const currentIndex = Math.max(0, steps.indexOf(currentStep));
  return steps[Math.min(currentIndex + 1, steps.length - 1)];
}

function getPreviousWizardStep(currentStep: WizardStep, requiresLicense: boolean) {
  const steps = getVisibleWizardSteps(requiresLicense);
  const currentIndex = Math.max(0, steps.indexOf(currentStep));
  return steps[Math.max(currentIndex - 1, 0)];
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
  const contractRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollContractIdRef = useRef<string | null>(null);
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
  const [attemptedWizardSteps, setAttemptedWizardSteps] = useState<Record<string, Partial<Record<WizardStep, boolean>>>>({});
  const [contractActionErrors, setContractActionErrors] = useState<Record<string, string | null>>({});
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [wizardStepByContract, setWizardStepByContract] = useState<Record<string, WizardStep>>({});
  const [readConfirmedContracts, setReadConfirmedContracts] = useState<Record<string, boolean>>({});
  const [documentOpenContracts, setDocumentOpenContracts] = useState<Record<string, boolean>>({});
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

  const resolveExpandedContractId = useCallback((
    contracts: ContractView[],
    currentExpandedId: string | null,
    preferredExpandedId?: string | null,
  ) => {
    const pendingContracts = contracts.filter((contract) => contract.status !== "SIGNED");

    if (preferredExpandedId !== undefined) {
      if (preferredExpandedId === null) return null;
      if (pendingContracts.some((contract) => contract.id === preferredExpandedId)) return preferredExpandedId;
    }

    if (currentExpandedId && pendingContracts.some((contract) => contract.id === currentExpandedId)) {
      return currentExpandedId;
    }

    return pendingContracts[0]?.id ?? null;
  }, []);

  const getNextPendingContractId = useCallback((contracts: ContractView[], signedContractId: string) => {
    const signedIndex = contracts.findIndex((contract) => contract.id === signedContractId);
    if (signedIndex >= 0) {
      for (let index = signedIndex + 1; index < contracts.length; index += 1) {
        if (contracts[index]?.status !== "SIGNED") return contracts[index]?.id ?? null;
      }
    }

    return contracts.find((contract) => contract.status !== "SIGNED")?.id ?? null;
  }, []);

  const hydrate = useCallback((data: Snapshot, options?: { preferredExpandedId?: string | null }) => {
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
    setReadConfirmedContracts((current) => {
      const next = { ...current };
      for (const contract of data.contracts) {
        if (contract.status === "SIGNED") next[contract.id] = true;
      }
      return next;
    });
    reservationDraftRef.current = nextReservationDraft;
    contractDraftsRef.current = nextDrafts;
    lastSavedPayloadRef.current = serializePayload(nextReservationDraft, nextDrafts);
    setAutosaveState("idle");
    setExpandedContractId((current) => resolveExpandedContractId(data.contracts, current, options?.preferredExpandedId));
  }, [resolveExpandedContractId, serializePayload]);

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

  async function signContract(contractId: string) {
    const signature = sigRefs.current[contractId];
    const draft = contractDrafts[contractId];
    const contract = snapshot?.contracts.find((item) => item.id === contractId);
    if (!draft) return;

    try {
      setSigningId(contractId);
      setError(null);
      setSuccess(null);

      if (contract) {
        const requiresLicense = contractRequiresLicense(snapshot?.reservation.isLicense ?? false, contract, draft);
        const confirmedRead = Boolean(readConfirmedContracts[contractId]);
        const fieldErrors = getContractFieldErrors({
          contract,
          draft,
          isLicense: requiresLicense,
          language,
        });
        const blockingStep = firstBlockingStep(fieldErrors, requiresLicense, confirmedRead);

        if (blockingStep) {
          setAttemptedWizardSteps((current) => ({
            ...current,
            [contractId]: {
              ...current[contractId],
              [blockingStep]: true,
            },
          }));
          setWizardStepByContract((current) => ({ ...current, [contractId]: blockingStep }));
          pendingScrollContractIdRef.current = contractId;
          setContractActionErrors((current) => ({
            ...current,
            [contractId]: getStepErrorMessage({
              step: blockingStep,
              errors: fieldErrors,
              confirmedRead,
              copy,
            }),
          }));
          focusContractWizard(contractId);
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
      const nextPendingContractId = getNextPendingContractId(data.contracts, contractId);
      pendingScrollContractIdRef.current = nextPendingContractId;
      if (nextPendingContractId) {
        setWizardStepByContract((current) => ({ ...current, [nextPendingContractId]: "personal" }));
      } else if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      }
      hydrate(data, { preferredExpandedId: nextPendingContractId });
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

  function markWizardStepAttempted(contractId: string, step: WizardStep) {
    setAttemptedWizardSteps((current) => ({
      ...current,
      [contractId]: {
        ...current[contractId],
        [step]: true,
      },
    }));
  }

  function focusContractWizard(contractId: string) {
    pendingScrollContractIdRef.current = contractId;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const contractNode = contractRefs.current[contractId];
        contractNode?.scrollIntoView({ behavior: "smooth", block: "start" });
        contractNode?.focus({ preventScroll: true });
      });
    });
  }

  function goToWizardStep(contractId: string, step: WizardStep) {
    setWizardStepByContract((current) => ({ ...current, [contractId]: step }));
    setContractActionErrors((current) => ({ ...current, [contractId]: null }));
    focusContractWizard(contractId);
  }

  function continueWizard(args: {
    contractId: string;
    currentStep: WizardStep;
    requiresLicense: boolean;
    fieldErrors: ContractFieldErrors;
    confirmedRead: boolean;
  }) {
    markWizardStepAttempted(args.contractId, args.currentStep);
    const message = getStepErrorMessage({
      step: args.currentStep,
      errors: args.fieldErrors,
      confirmedRead: args.confirmedRead,
      copy,
    });

    if (message) {
      setContractActionErrors((current) => ({ ...current, [args.contractId]: message }));
      focusContractWizard(args.contractId);
      return;
    }

    goToWizardStep(args.contractId, getNextWizardStep(args.currentStep, args.requiresLicense));
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

  useEffect(() => {
    if (!expandedContractId) return;
    if (pendingScrollContractIdRef.current !== expandedContractId) return;

    const contractNode = contractRefs.current[expandedContractId];
    if (!contractNode) return;

    pendingScrollContractIdRef.current = null;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        contractNode.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, [expandedContractId, snapshot]);

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
  const countryOptions = [
    { value: "", label: copy.checkinPage.wizard.selectCountry },
    ...COUNTRY_OPTIONS,
  ];
  const activeContract =
    snapshot.contracts.find((contract) => contract.id === expandedContractId && contract.status !== "SIGNED") ??
    snapshot.contracts.find((contract) => contract.status !== "SIGNED") ??
    null;
  const activeDraft = activeContract ? contractDrafts[activeContract.id] : null;
  const summaryParticipants = [
    snapshot.reservation.pax ? copy.checkinPage.summaryParticipants(snapshot.reservation.pax) : null,
    snapshot.reservation.quantity ? copy.checkinPage.summaryQuantity(snapshot.reservation.quantity) : null,
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
          subtitle={copy.checkinPage.subtitle}
        />
        <SectionCard
          eyebrow={copy.checkinPage.bookingSummary}
          title={snapshot.reservation.serviceName}
          action={<BrandStatusBadge tone={autosaveBadgeTone(autosaveState)}>{autosave.label}</BrandStatusBadge>}
        >
          <div style={summaryGridStyle}>
            <SummaryItem label={copy.checkinPage.summaryActivity} value={snapshot.reservation.serviceName} />
            <SummaryItem label={copy.checkinPage.summaryDate} value={formatPublicDate(snapshot.reservation.activityDate, language)} />
            <SummaryItem label={copy.checkinPage.summaryTime} value={formatPublicTime(snapshot.reservation.scheduledTime, language)} />
            <SummaryItem
              label={copy.checkinPage.summaryDuration}
              value={snapshot.reservation.durationMinutes ? `${snapshot.reservation.durationMinutes} min` : copy.checkinPage.accordingToReservation}
            />
            {summaryParticipants ? (
              <SummaryItem label={copy.checkinPage.summaryPeople} value={summaryParticipants} />
            ) : null}
          </div>
        </SectionCard>

        {error ? <AlertBanner tone="danger">{error}</AlertBanner> : null}
        {success && activeContract ? <AlertBanner tone="success">{success}</AlertBanner> : null}

        {activeContract && activeDraft ? (() => {
          const requiresLicense = contractRequiresLicense(snapshot.reservation.isLicense, activeContract, activeDraft);
          const storedStep = wizardStepByContract[activeContract.id] ?? "personal";
          const currentStep = !requiresLicense && storedStep === "license" ? "conditions" : storedStep;
          const visibleSteps = getVisibleWizardSteps(requiresLicense);
          const stepIndex = Math.max(0, visibleSteps.indexOf(currentStep));
          const fieldErrors = getContractFieldErrors({
            contract: activeContract,
            draft: activeDraft,
            isLicense: requiresLicense,
            language,
          });
          const confirmedRead = Boolean(readConfirmedContracts[activeContract.id]);
          const showStepErrors = Boolean(attemptedWizardSteps[activeContract.id]?.[currentStep]);
          const actionError =
            contractActionErrors[activeContract.id] ??
            (showStepErrors
              ? getStepErrorMessage({
                  step: currentStep,
                  errors: fieldErrors,
                  confirmedRead,
                  copy,
                })
              : null);
          const minor = getAgeFlagsFromBirthDate(activeDraft.driverBirthDate);
          const showTutorAuthorization =
            minor.needsAuthorization ||
            activeContract.minorNeedsAuthorization ||
            activeDraft.minorAuthorizationProvided;
          const isDocumentOpen = Boolean(documentOpenContracts[activeContract.id]);

          return (
            <div
              ref={(instance) => {
                contractRefs.current[activeContract.id] = instance;
              }}
              tabIndex={-1}
              style={{ outline: "none" }}
            >
              <SectionCard
                eyebrow={copy.checkinPage.wizard.contractProgress(activeContract.unitIndex, snapshot.reservation.requiredUnits)}
                title={copy.checkinPage.wizard.steps[currentStep]}
                action={<BrandStatusBadge tone="info">{`${stepIndex + 1}/${visibleSteps.length}`}</BrandStatusBadge>}
              >
                <div style={{ display: "grid", gap: 16 }}>
                  <WizardStepper
                    steps={visibleSteps}
                    currentStep={currentStep}
                    labels={copy.checkinPage.wizard.steps}
                  />

                  {currentStep === "personal" ? (
                    <>
                      <div style={stepHelpStyle}>{copy.checkinPage.wizard.personalHelp}</div>
                      <div style={wizardFieldsGridStyle}>
                        <Field
                          label={copy.checkinPage.driverName}
                          value={activeDraft.driverName}
                          error={showStepErrors ? fieldErrors.driverName : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverName: value })}
                        />
                        <SelectField
                          label={copy.checkinPage.driverCountry}
                          value={activeDraft.driverCountry}
                          error={showStepErrors ? fieldErrors.driverCountry : null}
                          options={countryOptions}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverCountry: value })}
                        />
                        <Field
                          label={copy.checkinPage.driverAddress}
                          value={activeDraft.driverAddress}
                          error={showStepErrors ? fieldErrors.driverAddress : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverAddress: value })}
                        />
                        <BirthDateField
                          label={copy.checkinPage.driverBirthDate}
                          value={activeDraft.driverBirthDate}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverBirthDate: value })}
                          style={showStepErrors && fieldErrors.driverBirthDate ? errorInputStyle : inputStyle}
                          error={showStepErrors ? fieldErrors.driverBirthDate : null}
                        />
                        <SelectField
                          label={`${copy.common.documentTypeLabel} *`}
                          value={activeDraft.driverDocType}
                          error={showStepErrors ? fieldErrors.driverDocType : null}
                          options={copy.common.documentTypeOptions}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverDocType: value })}
                        />
                        <Field
                          label={`${copy.common.documentNumberLabel} *`}
                          value={activeDraft.driverDocNumber}
                          error={showStepErrors ? fieldErrors.driverDocNumber : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { driverDocNumber: value })}
                        />
                      </div>
                    </>
                  ) : null}

                  {currentStep === "license" ? (
                    <>
                      <div style={stepHelpStyle}>{copy.checkinPage.wizard.licenseHelp}</div>
                      <div style={wizardFieldsGridStyle}>
                        <Field
                          label={copy.checkinPage.licenseSchool}
                          value={activeDraft.licenseSchool}
                          error={showStepErrors ? fieldErrors.licenseSchool : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { licenseSchool: value })}
                        />
                        <Field
                          label={copy.checkinPage.licenseType}
                          value={activeDraft.licenseType}
                          error={showStepErrors ? fieldErrors.licenseType : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { licenseType: value })}
                        />
                        <Field
                          label={copy.checkinPage.licenseNumber}
                          value={activeDraft.licenseNumber}
                          error={showStepErrors ? fieldErrors.licenseNumber : null}
                          onChange={(value) => updateContractDraft(activeContract.id, { licenseNumber: value })}
                        />
                      </div>
                    </>
                  ) : null}

                  {currentStep === "conditions" ? (
                    <>
                      <div style={stepHelpStyle}>{copy.checkinPage.wizard.conditionsHelp}</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        <CheckboxRow
                          checked={confirmedRead}
                          onChange={(value) => {
                            setReadConfirmedContracts((current) => ({ ...current, [activeContract.id]: value }));
                            setContractActionErrors((current) => ({ ...current, [activeContract.id]: null }));
                          }}
                          error={showStepErrors && !confirmedRead ? copy.signPage.errors.mustRead : null}
                        >
                          {copy.checkinPage.wizard.readAccept}
                        </CheckboxRow>

                        {showTutorAuthorization ? (
                          <CheckboxRow
                            checked={activeDraft.minorAuthorizationProvided}
                            onChange={(value) => updateContractDraft(activeContract.id, { minorAuthorizationProvided: value })}
                            error={
                              showStepErrors
                                ? fieldErrors.minorAuthorizationProvided ?? fieldErrors.minorAuthorizationFile
                                : null
                            }
                          >
                            {copy.checkinPage.tutorAuthorization(activeContract.minorAuthorizationFileName)}
                          </CheckboxRow>
                        ) : null}

                        <CheckboxRow
                          checked={activeDraft.imageConsentAccepted}
                          onChange={(value) => updateContractDraft(activeContract.id, { imageConsentAccepted: value })}
                        >
                          {copy.checkinPage.wizard.imageConsentOptional}
                        </CheckboxRow>
                      </div>

                      <details
                        open={isDocumentOpen}
                        onToggle={(event) => {
                          setDocumentOpenContracts((current) => ({
                            ...current,
                            [activeContract.id]: event.currentTarget.open,
                          }));
                        }}
                        style={contractDetailsStyle}
                      >
                        <summary style={contractSummaryStyle}>
                          {isDocumentOpen ? copy.checkinPage.wizard.hideContract : copy.checkinPage.wizard.viewContract}
                        </summary>
                        <div style={documentFrameStyle}>
                          <iframe
                            title={`Contract ${activeContract.unitIndex}`}
                            srcDoc={activeContract.renderedHtml}
                            style={{
                              width: "100%",
                              height: isMobile ? "52vh" : "min(68vh, 920px)",
                              border: 0,
                              display: "block",
                              background: "#fff",
                            }}
                          />
                        </div>
                      </details>
                    </>
                  ) : null}

                  {currentStep === "signature" ? (
                    <>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={signatureTitleStyle}>{copy.checkinPage.signatureTitle}</div>
                        <div style={signatureHelpStyle}>{copy.checkinPage.wizard.signatureHelp}</div>
                      </div>

                      <div style={signatureFrameStyle}>
                        <SignatureCanvas
                          ref={(instance) => {
                            sigRefs.current[activeContract.id] = instance;
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
                    </>
                  ) : null}

                  {actionError ? <AlertBanner tone="danger">{actionError}</AlertBanner> : null}

                  <div style={wizardButtonGridStyle}>
                    {currentStep !== "personal" ? (
                      <ActionButton
                        onClick={() => goToWizardStep(activeContract.id, getPreviousWizardStep(currentStep, requiresLicense))}
                        variant="secondary"
                        style={secondaryWizardButtonStyle}
                        disabled={saving || signingId === activeContract.id}
                      >
                        {copy.checkinPage.wizard.back}
                      </ActionButton>
                    ) : null}

                    {currentStep !== "signature" ? (
                      <ActionButton
                        onClick={() =>
                          continueWizard({
                            contractId: activeContract.id,
                            currentStep,
                            requiresLicense,
                            fieldErrors,
                            confirmedRead,
                          })
                        }
                        style={primaryWizardButtonStyle}
                      >
                        {copy.checkinPage.wizard.next}
                      </ActionButton>
                    ) : (
                      <>
                        <ActionButton
                          onClick={() => sigRefs.current[activeContract.id]?.clear()}
                          variant="secondary"
                          style={secondaryWizardButtonStyle}
                          disabled={saving || signingId === activeContract.id}
                        >
                          {copy.checkinPage.clearSignature}
                        </ActionButton>
                        <ActionButton
                          onClick={() => void signContract(activeContract.id)}
                          disabled={saving || signingId === activeContract.id}
                          style={{
                            ...primaryWizardButtonStyle,
                            ...(saving || signingId === activeContract.id ? { opacity: 0.7 } : {}),
                          }}
                        >
                          {signingId === activeContract.id ? copy.checkinPage.signing : copy.checkinPage.wizard.signAndContinue}
                        </ActionButton>
                      </>
                    )}
                  </div>
                </div>
              </SectionCard>
            </div>
          );
        })() : (
          <SectionCard
            eyebrow={copy.checkinPage.eyebrow}
            title={copy.checkinPage.wizard.completedTitle}
            action={<BrandStatusBadge tone="success">{copy.checkinPage.wizard.completedBadge}</BrandStatusBadge>}
          >
            <AlertBanner tone="success">{copy.checkinPage.wizard.completedBody}</AlertBanner>
          </SectionCard>
        )}
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryItemStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

function WizardStepper({
  steps,
  currentStep,
  labels,
}: {
  steps: WizardStep[];
  currentStep: WizardStep;
  labels: Record<WizardStep, string>;
}) {
  return (
    <div style={stepperStyle}>
      {steps.map((step) => {
        const active = step === currentStep;
        return (
          <div
            key={step}
            style={{
              ...stepPillStyle,
              borderColor: active ? brand.colors.primary : brand.colors.border,
              background: active ? "#eaf6fb" : "#fff",
              color: active ? brand.colors.primary : "#64748b",
            }}
          >
            {labels[step]}
          </div>
        );
      })}
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

function CheckboxRow({
  checked,
  disabled,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        ...checkboxLabelStyle,
        border: error ? "1px solid #ef4444" : checkboxLabelStyle.border,
        background: error ? "#fff5f5" : checkboxLabelStyle.background,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 2 }}
      />
      <span style={{ display: "grid", gap: 4 }}>
        <span>{children}</span>
        {error ? <span style={inlineErrorStyle}>{error}</span> : null}
      </span>
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
  padding: "14px 14px",
  borderRadius: 14,
  border: `1px solid ${brand.colors.border}`,
  background: "#f8fbfd",
  fontSize: 15,
  color: "#0f172a",
  lineHeight: 1.45,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: brand.colors.primary,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 12,
};

const summaryItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  color: "#64748b",
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: brand.colors.primary,
  lineHeight: 1.25,
  overflowWrap: "anywhere",
};

const stepperStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const stepPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "7px 10px",
  borderRadius: 999,
  border: `1px solid ${brand.colors.border}`,
  fontSize: 12,
  fontWeight: 900,
};

const stepHelpStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.5,
};

const wizardFieldsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const wizardButtonGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const primaryWizardButtonStyle: React.CSSProperties = {
  minHeight: 54,
  width: "100%",
  fontSize: 15,
};

const secondaryWizardButtonStyle: React.CSSProperties = {
  minHeight: 54,
  width: "100%",
  fontSize: 15,
};

const contractDetailsStyle: React.CSSProperties = {
  border: `1px solid ${brand.colors.border}`,
  borderRadius: 14,
  overflow: "hidden",
  background: "#fff",
};

const contractSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  padding: "14px 16px",
  fontSize: 14,
  fontWeight: 900,
  color: brand.colors.primary,
  listStyle: "none",
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
