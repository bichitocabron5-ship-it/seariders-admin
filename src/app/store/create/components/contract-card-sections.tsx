"use client";

import type React from "react";
import { BirthDateField, PhoneWithCountryField } from "@/components/customer-inputs";
import { getCountryOptionsEs } from "@/lib/countries";
import type { ContractDto } from "../types";

const COUNTRY_OPTIONS = getCountryOptionsEs();

type PreparedOptions = {
  jetskis: Array<{ id: string; number: number | null; model: string | null; plate: string | null }>;
  assets: Array<{ id: string; name: string | null; type: string | null; plate: string | null }>;
};

type CustomerInfo = {
  name: string;
  phone: string;
  email: string;
  country: string;
  postalCode: string;
};

type CommonStyles = {
  subCardStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  secondaryButtonStyle?: React.CSSProperties;
  sectionEyebrowStyle: React.CSSProperties;
};

type ContractLegalSectionProps = CommonStyles & {
  birthYmd: string;
  age: number | null;
  isUnder16: boolean;
  needsAuth: boolean;
  minorAuthorizationProvided: boolean;
  imageConsentAccepted: boolean;
  contract: ContractDto;
  minorUploadBusy: boolean;
  minorDeleteBusy: boolean;
  onBirthYmdChange: (value: string) => void;
  onMinorAuthorizationProvidedChange: (value: boolean) => void;
  onImageConsentAcceptedChange: (value: boolean) => void;
  onMinorAuthorizationUpload: (file: File) => void;
  onMinorAuthorizationDelete: () => void;
  onOpenMinorAuthorization: () => Promise<void>;
};

type ContractDriverSectionProps = CommonStyles & {
  customer: CustomerInfo;
  driverName: string;
  driverPhone: string;
  driverEmail: string;
  driverCountry: string;
  driverAddress: string;
  driverPostalCode: string;
  driverDocType: string;
  driverDocNumber: string;
  onDriverNameChange: (value: string) => void;
  onDriverPhoneChange: (value: string) => void;
  onDriverEmailChange: (value: string) => void;
  onDriverCountryChange: (value: string) => void;
  onDriverAddressChange: (value: string) => void;
  onDriverPostalCodeChange: (value: string) => void;
  onDriverDocTypeChange: (value: string) => void;
  onDriverDocNumberChange: (value: string) => void;
  onCopyCustomerData: () => void;
};

type ContractLicenseSectionProps = CommonStyles & {
  showLicenseFields: boolean;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
  onLicenseSchoolChange: (value: string) => void;
  onLicenseTypeChange: (value: string) => void;
  onLicenseNumberChange: (value: string) => void;
};

type ContractPreparedResourceSectionProps = CommonStyles & {
  showPreparedSelector: boolean;
  preparedJetskiId: string;
  preparedAssetId: string;
  preparedOptions: PreparedOptions;
  contract: ContractDto;
  onPreparedJetskiChange: (value: string) => void;
  onPreparedAssetChange: (value: string) => void;
};

export function ContractLegalSection({
  subCardStyle,
  inputStyle,
  sectionEyebrowStyle,
  birthYmd,
  age,
  isUnder16,
  needsAuth,
  minorAuthorizationProvided,
  imageConsentAccepted,
  contract,
  minorUploadBusy,
  minorDeleteBusy,
  onBirthYmdChange,
  onMinorAuthorizationProvidedChange,
  onImageConsentAcceptedChange,
  onMinorAuthorizationUpload,
  onMinorAuthorizationDelete,
  onOpenMinorAuthorization,
}: ContractLegalSectionProps) {
  return (
    <>
      <div style={subCardStyle}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={sectionEyebrowStyle}>Validacion legal</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Edad y autorizacion del tutor cuando aplique antes de dejar el contrato en `READY`.
          </div>
        </div>

        <BirthDateField
          label="Fecha de nacimiento *"
          value={birthYmd}
          onChange={onBirthYmdChange}
          style={inputStyle}
          required
        />

        {isUnder16 ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>
            Menor de 16: no permitido.
          </div>
        ) : null}

        {needsAuth ? (
          <label style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid #fde68a", background: "#fffbeb" }}>
            <input type="checkbox" checked={minorAuthorizationProvided} onChange={(e) => onMinorAuthorizationProvidedChange(e.target.checked)} />
            <div style={{ fontWeight: 800 }}>Menor de 16-17 anos: requiere autorizacion del tutor.</div>
          </label>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          padding: 10,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 700 }}>
          <input type="checkbox" checked={Boolean(imageConsentAccepted)} onChange={(e) => onImageConsentAcceptedChange(e.target.checked)} />
          Acepto el uso de mi imagen segun lo indicado
        </label>

        {age != null && age < 18 ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 10,
              borderRadius: 10,
              border: "1px solid #fecaca",
              background: "#fff7ed",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: "#9a3412" }}>
              Menor detectado: se requiere autorizacion de padre, madre o tutor.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "fit-content",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #fdba74",
                  background: minorUploadBusy ? "#ffedd5" : "#fff",
                  color: "#9a3412",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: minorUploadBusy ? "default" : "pointer",
                }}
              >
                {minorUploadBusy
                  ? "Subiendo..."
                  : contract.minorAuthorizationFileName
                    ? "Reemplazar autorizacion"
                    : "Adjuntar autorizacion"}
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onMinorAuthorizationUpload(file);
                    e.currentTarget.value = "";
                  }}
                  disabled={minorUploadBusy || minorDeleteBusy}
                />
              </label>

              {contract.minorAuthorizationFileKey ? (
                <button
                  type="button"
                  onClick={onMinorAuthorizationDelete}
                  disabled={minorDeleteBusy || minorUploadBusy}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#991b1b",
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: minorDeleteBusy ? "default" : "pointer",
                  }}
                >
                  {minorDeleteBusy ? "Eliminando..." : "Eliminar autorizacion"}
                </button>
              ) : null}
            </div>

            {contract.minorAuthorizationFileName ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: "#475569" }}>{contract.minorAuthorizationFileName}</div>
                {contract.minorAuthorizationFileKey ? (
                  <button
                    type="button"
                    onClick={() => void onOpenMinorAuthorization()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#0f172a",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Ver autorizacion
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ContractDriverSection({
  subCardStyle,
  inputStyle,
  secondaryButtonStyle,
  sectionEyebrowStyle,
  customer,
  driverName,
  driverPhone,
  driverEmail,
  driverCountry,
  driverAddress,
  driverPostalCode,
  driverDocType,
  driverDocNumber,
  onDriverNameChange,
  onDriverPhoneChange,
  onDriverEmailChange,
  onDriverCountryChange,
  onDriverAddressChange,
  onDriverPostalCodeChange,
  onDriverDocTypeChange,
  onDriverDocNumberChange,
  onCopyCustomerData,
}: ContractDriverSectionProps) {
  return (
    <div style={subCardStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={sectionEyebrowStyle}>Conductor</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Completa los datos del conductor real que firmara este contrato.</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={onCopyCustomerData} style={secondaryButtonStyle}>
          Copiar datos del cliente
        </button>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Usa copiar y ajusta solo lo que cambie para cada conductor.
          {customer.name ? ` Cliente base: ${customer.name}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Nombre del conductor *
          <input value={driverName} onChange={(e) => onDriverNameChange(e.target.value)} style={inputStyle} />
        </label>
        <PhoneWithCountryField
          label="Telefono"
          country={driverCountry}
          phone={driverPhone}
          onCountryChange={onDriverCountryChange}
          onPhoneChange={onDriverPhoneChange}
          countryOptions={COUNTRY_OPTIONS}
          inputStyle={inputStyle}
          phonePlaceholder="Ej: 612345678"
        />
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Email
          <input value={driverEmail} onChange={(e) => onDriverEmailChange(e.target.value)} style={inputStyle} placeholder="conductor@email.com" />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Direccion *
          <input value={driverAddress} onChange={(e) => onDriverAddressChange(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Codigo postal
          <input value={driverPostalCode} onChange={(e) => onDriverPostalCodeChange(e.target.value)} style={inputStyle} placeholder="08303" />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Tipo de documento *
          <select value={driverDocType} onChange={(e) => onDriverDocTypeChange(e.target.value)} style={inputStyle}>
            <option value="">Selecciona...</option>
            <option value="DNI">DNI</option>
            <option value="NIE">NIE</option>
            <option value="PASSPORT">Pasaporte</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Numero de documento *
          <input value={driverDocNumber} onChange={(e) => onDriverDocNumberChange(e.target.value)} style={inputStyle} />
        </label>
      </div>
    </div>
  );
}

export function ContractLicenseSection({
  subCardStyle,
  inputStyle,
  sectionEyebrowStyle,
  showLicenseFields,
  licenseSchool,
  licenseType,
  licenseNumber,
  onLicenseSchoolChange,
  onLicenseTypeChange,
  onLicenseNumberChange,
}: ContractLicenseSectionProps) {
  if (!showLicenseFields) return null;

  return (
    <div style={subCardStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={sectionEyebrowStyle}>Licencia</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Completa esta parte solo cuando la actividad exige licencia nautica.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Escuela de licencia
          <input value={licenseSchool} onChange={(e) => onLicenseSchoolChange(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Tipo de licencia
          <input value={licenseType} onChange={(e) => onLicenseTypeChange(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Numero de licencia
          <input value={licenseNumber} onChange={(e) => onLicenseNumberChange(e.target.value)} style={inputStyle} />
        </label>
      </div>
    </div>
  );
}

export function ContractPreparedResourceSection({
  subCardStyle,
  inputStyle,
  sectionEyebrowStyle,
  showPreparedSelector,
  preparedJetskiId,
  preparedAssetId,
  preparedOptions,
  contract,
  onPreparedJetskiChange,
  onPreparedAssetChange,
}: ContractPreparedResourceSectionProps) {
  if (!showPreparedSelector) return null;

  return (
    <div style={subCardStyle}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={sectionEyebrowStyle}>Recurso preparado</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Asocia la moto o asset preparado que debe quedar reflejado en el contrato.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Jetski preparado
          <select value={preparedJetskiId} onChange={(e) => onPreparedJetskiChange(e.target.value)} style={inputStyle}>
            <option value="">Selecciona jetski...</option>
            {preparedOptions.jetskis.map((jetski) => (
              <option key={jetski.id} value={jetski.id}>
                {`Moto ${jetski.number ?? "?"} · ${jetski.model ?? "Sin modelo"}${jetski.plate ? ` · ${jetski.plate}` : ""}`}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Asset / Boat preparado
          <select value={preparedAssetId} onChange={(e) => onPreparedAssetChange(e.target.value)} style={inputStyle}>
            <option value="">Selecciona asset...</option>
            {preparedOptions.assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {`${asset.name ?? "Sin nombre"}${asset.type ? ` · ${asset.type}` : ""}${asset.plate ? ` · ${asset.plate}` : ""}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {contract.preparedJetski || contract.preparedAsset ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Recurso actual:{" "}
          {contract.preparedJetski
            ? `Moto ${contract.preparedJetski.number ?? "?"} · ${contract.preparedJetski.model ?? "Sin modelo"}${contract.preparedJetski.plate ? ` · ${contract.preparedJetski.plate}` : ""}`
            : contract.preparedAsset
              ? `${contract.preparedAsset.name ?? "Sin nombre"}${contract.preparedAsset.type ? ` · ${contract.preparedAsset.type}` : ""}${contract.preparedAsset.plate ? ` · ${contract.preparedAsset.plate}` : ""}`
              : "—"}
        </div>
      ) : null}
    </div>
  );
}
