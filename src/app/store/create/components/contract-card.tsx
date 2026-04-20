"use client";

import React, { useEffect, useState } from "react";

import { opsStyles } from "@/components/ops-ui";

import { errorMessage } from "../utils/errors";
import type { ContractDto, ContractPatch } from "../types";
import {
  fetchPreparedOptions,
  getContractSignerLink,
  resendContractSignerWhatsapp,
  getSignedContractDownloadUrl,
  getSignedMinorAuthorizationDownloadUrl,
} from "../services/contracts";
import { ContractCardActions } from "./contract-card-actions";
import {
  ContractDriverSection,
  ContractLegalSection,
  ContractLicenseSection,
  ContractPreparedResourceSection,
} from "./contract-card-sections";
import { ContractSignerLinkModal } from "./contract-signer-link-modal";

const panelStyle: React.CSSProperties = {
  ...opsStyles.sectionCard,
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "#fdfefe",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
  display: "grid",
  gap: 14,
};

const subCardStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "rgba(255,255,255,0.82)",
  display: "grid",
  gap: 14,
};

const inputStyle: React.CSSProperties = opsStyles.field;
const secondaryButtonStyle: React.CSSProperties = { ...opsStyles.ghostButton, padding: "10px 12px" };
const primaryButtonStyle: React.CSSProperties = {
  ...opsStyles.primaryButton,
  padding: "10px 12px",
  border: "1px solid #0f172a",
  background: "#0f172a",
};
const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#64748b",
};
const actionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 10,
  alignItems: "stretch",
};
const secondaryBtn: React.CSSProperties = {
  ...opsStyles.ghostButton,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
};
const externalSignaturePendingStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid #fde68a",
  background: "#fffbeb",
  color: "#92400e",
  display: "grid",
  gap: 4,
};

function contractStatusStyle(status: ContractDto["status"]): React.CSSProperties {
  if (status === "SIGNED") {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      background: "#dcfce7",
      border: "1px solid #bbf7d0",
      color: "#166534",
      fontWeight: 900,
      fontSize: 12,
    };
  }

  if (status === "READY") {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      background: "#dbeafe",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      fontWeight: 900,
      fontSize: 12,
    };
  }

  if (status === "VOID") {
    return {
      padding: "6px 10px",
      borderRadius: 999,
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
      color: "#475569",
      fontWeight: 900,
      fontSize: 12,
    };
  }

  return {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 900,
    fontSize: 12,
  };
}

function ymdFromDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function ageAt(birthYmd: string, at = new Date()) {
  if (!birthYmd) return null;
  const [y, m, d] = birthYmd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const bd = new Date(y, m - 1, d);
  let age = at.getFullYear() - bd.getFullYear();
  const mm = at.getMonth() - bd.getMonth();
  if (mm < 0 || (mm === 0 && at.getDate() < bd.getDate())) age--;
  return age;
}

type ContractCardProps = {
  reservationId: string;
  isLicense: boolean;
  c: ContractDto;
  customer: {
    name: string;
    phone: string;
    email: string;
    country: string;
    postalCode: string;
  };
  onSaved: () => Promise<void>;
  onPreview: (contractId: string) => Promise<void>;
  previewBusy: boolean;
  onGeneratePdf: (contractId: string) => Promise<void>;
  pdfBusy: boolean;
  onUploadMinorAuthorization: (contractId: string, file: File) => Promise<void>;
  onDeleteMinorAuthorization: (contractId: string) => Promise<void>;
  minorUploadBusy: boolean;
  minorDeleteBusy: boolean;
};

export function ContractCard({
  reservationId,
  isLicense,
  c,
  customer,
  onSaved,
  onPreview,
  previewBusy,
  onGeneratePdf,
  pdfBusy,
  onUploadMinorAuthorization,
  onDeleteMinorAuthorization,
  minorUploadBusy,
  minorDeleteBusy,
}: ContractCardProps) {
  const [saving, setSaving] = React.useState(false);
  const [signerLinkBusy, setSignerLinkBusy] = React.useState(false);
  const [retryNotificationBusy, setRetryNotificationBusy] = React.useState(false);
  const [signerLinkModal, setSignerLinkModal] = React.useState<{
    url: string;
    expiresInMinutes: number;
    manualMessage?: string | null;
    notificationStatus?: string | null;
    notificationProvider?: string | null;
    notificationError?: string | null;
  } | null>(null);
  const [awaitingExternalSignature, setAwaitingExternalSignature] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [birthYmd, setBirthYmd] = React.useState<string>(ymdFromDate(c.driverBirthDate ? new Date(c.driverBirthDate) : null));
  const [minorAuthorizationProvided, setMinorAuthorizationProvided] = React.useState<boolean>(Boolean(c.minorAuthorizationProvided));
  const [driverName, setDriverName] = React.useState<string>(c.driverName ?? "");
  const [driverPhone, setDriverPhone] = React.useState<string>(c.driverPhone ?? "");
  const [driverEmail, setDriverEmail] = React.useState<string>(c.driverEmail ?? "");
  const [driverCountry, setDriverCountry] = React.useState<string>(c.driverCountry ?? "");
  const [driverAddress, setDriverAddress] = React.useState<string>(c.driverAddress ?? "");
  const [driverPostalCode, setDriverPostalCode] = React.useState<string>(c.driverPostalCode ?? "");
  const [driverDocType, setDriverDocType] = React.useState<string>(c.driverDocType ?? "");
  const [driverDocNumber, setDriverDocNumber] = React.useState<string>(c.driverDocNumber ?? "");
  const [imageConsentAccepted, setImageConsentAccepted] = useState(Boolean(c.imageConsentAccepted));
  const [licenseSchool, setLicenseSchool] = React.useState<string>(c.licenseSchool ?? "");
  const [licenseType, setLicenseType] = React.useState<string>(c.licenseType ?? "");
  const [licenseNumber, setLicenseNumber] = React.useState<string>(c.licenseNumber ?? "");
  const [preparedJetskiId, setPreparedJetskiId] = useState(c.preparedJetskiId ?? "");
  const [preparedAssetId, setPreparedAssetId] = useState(c.preparedAssetId ?? "");
  const [preparedOptions, setPreparedOptions] = useState<{
    jetskis: Array<{ id: string; number: number | null; model: string | null; plate: string | null }>;
    assets: Array<{ id: string; name: string | null; type: string | null; plate: string | null }>;
  }>({
    jetskis: [],
    assets: [],
  });

  const age = React.useMemo(() => ageAt(birthYmd), [birthYmd]);
  const needsAuth = age != null && age >= 16 && age < 18;
  const isUnder16 = age != null && age < 16;
  const showLicenseFields =
    isLicense ||
    Boolean(licenseSchool?.trim()) ||
    Boolean(licenseType?.trim()) ||
    Boolean(licenseNumber?.trim());
  const showPreparedSelector = isLicense;
  const canDownloadFinalPdf =
    c.status === "SIGNED" &&
    Boolean(c.signedAt) &&
    Boolean(c.signatureImageKey || c.signatureImageUrl) &&
    Boolean(c.renderedPdfKey || c.renderedPdfUrl);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchPreparedOptions();
        if (cancelled) return;
        setPreparedOptions({
          jetskis: data.jetskis ?? [],
          assets: data.assets ?? [],
        });
      } catch {
        if (cancelled) return;
        setPreparedOptions({ jetskis: [], assets: [] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (c.driverBirthDate) {
      setBirthYmd(new Date(c.driverBirthDate).toISOString().slice(0, 10));
    } else {
      setBirthYmd("");
    }
    setMinorAuthorizationProvided(Boolean(c.minorAuthorizationProvided));
    setDriverName(c.driverName ?? "");
    setDriverPhone(c.driverPhone ?? "");
    setDriverEmail(c.driverEmail ?? "");
    setDriverCountry(c.driverCountry ?? "");
    setDriverAddress(c.driverAddress ?? "");
    setDriverPostalCode(c.driverPostalCode ?? "");
    setDriverDocType(c.driverDocType ?? "");
    setDriverDocNumber(c.driverDocNumber ?? "");
    setImageConsentAccepted(Boolean(c.imageConsentAccepted));
    setLicenseSchool(c.licenseSchool ?? "");
    setLicenseType(c.licenseType ?? "");
    setLicenseNumber(c.licenseNumber ?? "");
    setPreparedJetskiId(c.preparedJetskiId ?? "");
    setPreparedAssetId(c.preparedAssetId ?? "");
  }, [c.id, c.driverAddress, c.driverBirthDate, c.driverCountry, c.driverDocNumber, c.driverDocType, c.driverEmail, c.driverName, c.driverPhone, c.driverPostalCode, c.imageConsentAccepted, c.licenseNumber, c.licenseSchool, c.licenseType, c.minorAuthorizationProvided, c.preparedAssetId, c.preparedJetskiId]);

  useEffect(() => {
    if (c.status === "SIGNED" || c.status === "VOID") {
      setAwaitingExternalSignature(false);
      setSignerLinkModal(null);
    }
  }, [c.status]);

  function buildPayload() {
    return {
      driverName: driverName || null,
      driverPhone: driverPhone || null,
      driverEmail: driverEmail || null,
      driverCountry: driverCountry || null,
      driverAddress: driverAddress || null,
      driverPostalCode: driverPostalCode || null,
      driverDocType: driverDocType || null,
      driverDocNumber: driverDocNumber || null,
      driverBirthDate: birthYmd ? `${birthYmd}T12:00:00.000Z` : null,
      minorAuthorizationProvided,
      imageConsentAccepted,
      licenseSchool: licenseSchool || null,
      licenseType: licenseType || null,
      licenseNumber: licenseNumber || null,
      preparedJetskiId: preparedJetskiId || null,
      preparedAssetId: preparedAssetId || null,
    };
  }

  async function savePartial(patch: Partial<ContractPatch>) {
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch(`/api/store/reservations/${reservationId}/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(await r.text());
      await onSaved();
    } catch (e: unknown) {
      setErr(errorMessage(e, "Error guardando contrato"));
    } finally {
      setSaving(false);
    }
  }

  async function markReady() {
    const payload: ContractPatch = { status: "READY", ...buildPayload() };
    await savePartial(payload);
  }

  async function handlePreviewClick() {
    if (c.status !== "SIGNED") {
      await savePartial(buildPayload());
    }
    await onPreview(c.id);
  }

  async function handleGeneratePdfClick() {
    if (c.status !== "SIGNED") {
      await savePartial(buildPayload());
    }
    await onGeneratePdf(c.id);
  }

  async function handleMinorAuthorizationUploadClick(file: File) {
    if (c.status !== "SIGNED") {
      await savePartial(buildPayload());
    }
    await onUploadMinorAuthorization(c.id, file);
  }

  async function handleMinorAuthorizationDeleteClick() {
    if (c.status !== "SIGNED") {
      await savePartial(buildPayload());
    }
    await onDeleteMinorAuthorization(c.id);
  }

  async function handleDownloadFinalPdf() {
    const data = await getSignedContractDownloadUrl(c.id);
    if (data?.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleOpenSignerLink() {
    try {
      setSignerLinkBusy(true);
      setErr(null);
      await savePartial(buildPayload());
      const data = await getContractSignerLink(c.id);
      if (!data.url) throw new Error("No se pudo generar el enlace de firma");
      setAwaitingExternalSignature(true);
      setSignerLinkModal({
        url: data.url,
        expiresInMinutes: data.expiresInMinutes,
        manualMessage: data.manualMessage ?? null,
        notificationStatus: data.notification?.status ?? null,
        notificationProvider: data.notification?.provider ?? null,
        notificationError: data.notification?.error ?? null,
      });
    } catch (e: unknown) {
      setErr(errorMessage(e, "No se pudo abrir la firma en tablet"));
    } finally {
      setSignerLinkBusy(false);
    }
  }

  async function handleRetryNotification() {
    try {
      setRetryNotificationBusy(true);
      setErr(null);
      await savePartial(buildPayload());
      await resendContractSignerWhatsapp(c.id);
      await onSaved();
    } catch (e: unknown) {
      setErr(errorMessage(e, "No se pudo reenviar el WhatsApp del contrato"));
    } finally {
      setRetryNotificationBusy(false);
    }
  }

  return (
    <article style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>Contrato</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Unidad #{c.logicalUnitIndex ?? c.unitIndex}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Preparación documental, vista previa y PDF para firma.
          </div>
        </div>
        <div style={contractStatusStyle(c.status)}>{c.status}</div>
      </div>

      {awaitingExternalSignature && c.status !== "SIGNED" ? (
        <div style={externalSignaturePendingStyle}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase" }}>
            Esperando firma externa
          </div>
          <div style={{ fontSize: 13 }}>
            El enlace de firma ya esta generado. Escanea el QR desde tablet o movil y este contrato se actualizara automaticamente al firmarse.
          </div>
        </div>
      ) : null}

      <ContractLegalSection
        subCardStyle={subCardStyle}
        inputStyle={inputStyle}
        sectionEyebrowStyle={sectionEyebrowStyle}
        birthYmd={birthYmd}
        age={age}
        isUnder16={isUnder16}
        needsAuth={needsAuth}
        minorAuthorizationProvided={minorAuthorizationProvided}
        imageConsentAccepted={imageConsentAccepted}
        contract={c}
        minorUploadBusy={minorUploadBusy}
        minorDeleteBusy={minorDeleteBusy}
        onBirthYmdChange={setBirthYmd}
        onMinorAuthorizationProvidedChange={setMinorAuthorizationProvided}
        onImageConsentAcceptedChange={setImageConsentAccepted}
        onMinorAuthorizationUpload={(file) => void handleMinorAuthorizationUploadClick(file)}
        onMinorAuthorizationDelete={() => void handleMinorAuthorizationDeleteClick()}
        onOpenMinorAuthorization={async () => {
          const data = await getSignedMinorAuthorizationDownloadUrl(c.id);
          if (data?.url) {
            window.open(data.url, "_blank", "noopener,noreferrer");
          }
        }}
      />

      <ContractDriverSection
        subCardStyle={subCardStyle}
        inputStyle={inputStyle}
        secondaryButtonStyle={secondaryButtonStyle}
        sectionEyebrowStyle={sectionEyebrowStyle}
        customer={customer}
        driverName={driverName}
        driverPhone={driverPhone}
        driverEmail={driverEmail}
        driverCountry={driverCountry}
        driverAddress={driverAddress}
        driverPostalCode={driverPostalCode}
        driverDocType={driverDocType}
        driverDocNumber={driverDocNumber}
        onDriverNameChange={setDriverName}
        onDriverPhoneChange={setDriverPhone}
        onDriverEmailChange={setDriverEmail}
        onDriverCountryChange={(value) => setDriverCountry(value.toUpperCase())}
        onDriverAddressChange={setDriverAddress}
        onDriverPostalCodeChange={setDriverPostalCode}
        onDriverDocTypeChange={setDriverDocType}
        onDriverDocNumberChange={setDriverDocNumber}
        onCopyCustomerData={() => {
          setDriverName(customer.name);
          setDriverPhone(customer.phone);
          setDriverEmail(customer.email);
          setDriverCountry(customer.country);
          setDriverPostalCode(customer.postalCode);
          void savePartial({
            driverName: customer.name || null,
            driverPhone: customer.phone || null,
            driverEmail: customer.email || null,
            driverCountry: customer.country || null,
            driverPostalCode: customer.postalCode || null,
          });
        }}
      />

      <ContractLicenseSection
        subCardStyle={subCardStyle}
        inputStyle={inputStyle}
        sectionEyebrowStyle={sectionEyebrowStyle}
        showLicenseFields={showLicenseFields}
        licenseSchool={licenseSchool}
        licenseType={licenseType}
        licenseNumber={licenseNumber}
        onLicenseSchoolChange={setLicenseSchool}
        onLicenseTypeChange={setLicenseType}
        onLicenseNumberChange={setLicenseNumber}
      />

      <ContractPreparedResourceSection
        subCardStyle={subCardStyle}
        inputStyle={inputStyle}
        sectionEyebrowStyle={sectionEyebrowStyle}
        showPreparedSelector={showPreparedSelector}
        preparedJetskiId={preparedJetskiId}
        preparedAssetId={preparedAssetId}
        preparedOptions={preparedOptions}
        contract={c}
        onPreparedJetskiChange={(value) => {
          setPreparedJetskiId(value);
          if (value) setPreparedAssetId("");
          void savePartial({
            preparedJetskiId: value || null,
            preparedAssetId: null,
          });
        }}
        onPreparedAssetChange={(value) => {
          setPreparedAssetId(value);
          if (value) setPreparedJetskiId("");
          void savePartial({
            preparedAssetId: value || null,
            preparedJetskiId: null,
          });
        }}
      />

      {err ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>{err}</div> : null}

      <div style={{ ...subCardStyle, gap: 10 }}>
        <div style={sectionEyebrowStyle}>Notificaciones</div>
        {(c.notifications ?? []).length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {(c.notifications ?? []).map((n) => (
              <div key={n.id} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ color: "#475569" }}>
                    {new Date(n.createdAt).toLocaleString("es-ES")} | {n.provider}
                  </span>
                  <b>{n.status}</b>
                </div>
                <div style={{ color: "#475569" }}>
                  {n.recipientPhone ? `Destino: ${n.recipientPhone}` : "Sin teléfono válido"}
                </div>
                {n.linkUrl ? (
                  <a href={n.linkUrl} target="_blank" rel="noreferrer" style={{ color: "#0369a1", fontWeight: 800 }}>
                    Abrir enlace enviado
                  </a>
                ) : null}
                {n.errorMessage ? <div style={{ color: "#b91c1c" }}>{n.errorMessage}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#64748b" }}>Sin notificaciones registradas.</div>
        )}
        <button
          type="button"
          onClick={() => void handleRetryNotification()}
          disabled={retryNotificationBusy || saving}
          style={{ ...secondaryBtn, width: "fit-content" }}
        >
          {retryNotificationBusy ? "Reenviando..." : "Reintentar WhatsApp"}
        </button>
      </div>

      <ContractCardActions
        saving={saving}
        isUnder16={isUnder16}
        previewBusy={previewBusy}
        pdfBusy={pdfBusy}
        signerLinkBusy={signerLinkBusy}
        canDownloadFinalPdf={canDownloadFinalPdf}
        actionRowStyle={actionRowStyle}
        secondaryButtonStyle={secondaryButtonStyle}
        primaryButtonStyle={primaryButtonStyle}
        secondaryBtnStyle={secondaryBtn}
        onSave={() => void savePartial({ ...buildPayload() })}
        onMarkReady={() => void markReady()}
        onPreview={() => void handlePreviewClick()}
        onGeneratePdf={() => void handleGeneratePdfClick()}
        onDownloadFinalPdf={() => void handleDownloadFinalPdf()}
        onOpenSignerLink={() => void handleOpenSignerLink()}
      />

      {showLicenseFields ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Si esta actividad requiere licencia, el backend validará la licencia antes de READY.
        </div>
      ) : null}
      {signerLinkModal ? (
        <ContractSignerLinkModal
          url={signerLinkModal.url}
          expiresInMinutes={signerLinkModal.expiresInMinutes}
          recipientName={driverName.trim() || customer.name.trim() || "cliente"}
          phone={driverPhone.trim() || customer.phone.trim() || null}
          country={driverCountry.trim() || customer.country.trim() || null}
          unitLabel={`Unidad #${c.logicalUnitIndex ?? c.unitIndex}`}
          manualMessage={signerLinkModal.manualMessage ?? null}
          notificationStatus={signerLinkModal.notificationStatus ?? null}
          notificationProvider={signerLinkModal.notificationProvider ?? null}
          notificationError={signerLinkModal.notificationError ?? null}
          onClose={() => setSignerLinkModal(null)}
        />
      ) : null}
    </article>
  );
}
