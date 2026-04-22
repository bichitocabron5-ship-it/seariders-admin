// src/app/store/create/components/store-sections.tsx
"use client";

import React, { useState } from "react";
import { opsStyles } from "@/components/ops-ui";
import type { CartItem, ContractDto, Option, RecoveredContractProfile, ServiceMain } from "../types";
import { errorMessage } from "../utils/errors";
import {
  deleteMinorAuthorization,
  generateContractPdf,
  getReservationPrecheckinLink,
  patchContract,
  renderContract,
  saveContractSignature,
  signContract,
  uploadMinorAuthorization,
} from "../services/contracts";
import { CartItemsList } from "./cart-items-list";
import { ContractCard } from "./contract-card";
import { ContractsHeaderSummary } from "./contracts-header-summary";
import { ContractsPreviewModal } from "./contracts-preview-modal";
import { ReservationPrecheckinLinkModal } from "./reservation-precheckin-link-modal";

const panelStyle: React.CSSProperties = {
  ...opsStyles.sectionCard,
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
};
const subCardStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "rgba(255,255,255,0.82)",
  display: "grid",
  gap: 14,
};
const secondaryButtonStyle: React.CSSProperties = { ...opsStyles.ghostButton, padding: "10px 12px" };
const primaryButtonStyle: React.CSSProperties = { ...opsStyles.primaryButton, padding: "10px 12px", border: "1px solid #0f172a", background: "#0f172a" };
const sectionEyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#64748b",
};

function contractsStateTone(readyCount: number, requiredUnits: number) {
  if (requiredUnits <= 0) return { label: "No requeridos", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" };
  if (readyCount >= requiredUnits) return { label: "Operativo", color: "#166534", bg: "#ecfdf5", border: "#bbf7d0" };
  if (readyCount > 0) return { label: "Parcial", color: "#9a3412", bg: "#fff7ed", border: "#fed7aa" };
  return { label: "Pendiente", color: "#991b1b", bg: "#fff1f2", border: "#fecaca" };
}


export function ContractsSection({
  reservationId,
  readyCount,
  requiredUnits,
  contracts,
  contractsLoading,
  contractsError,
  requiresLicense,
  recoveredContractProfile,
  onRecoveredContractProfileApplied,
  customer,
  onRefresh,
}: {
  reservationId: string;
  readyCount: number;
  requiredUnits: number;
  contracts: ContractDto[];
  contractsLoading: boolean;
  contractsError: string | null;
  requiresLicense: boolean;
  recoveredContractProfile: RecoveredContractProfile | null;
  onRecoveredContractProfileApplied: () => void;
  customer: {
    name: string;
    phone: string;
    email: string;
    country: string;
    postalCode: string;
  };
  onRefresh: () => Promise<void>;
}) {
  const stateTone = contractsStateTone(readyCount, requiredUnits);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewContractId, setPreviewContractId] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [signatureContract, setSignatureContract] = useState<ContractDto | null>(null);
  const [minorUploadBusyId, setMinorUploadBusyId] = useState<string | null>(null);
  const [minorDeleteBusyId, setMinorDeleteBusyId] = useState<string | null>(null);
  const [precheckinBusy, setPrecheckinBusy] = useState(false);
  const [precheckinLink, setPrecheckinLink] = useState<{
    url: string;
    expiresInMinutes: number;
  } | null>(null);
  const [recoveringProfile, setRecoveringProfile] = useState(false);
  const previewContract = previewContractId
    ? contracts.find((contract) => contract.id === previewContractId) ?? null
    : null;
  const orderedContracts = [...contracts].sort((left, right) => {
    const rank = (status: ContractDto["status"]) =>
      status === "DRAFT" ? 0 : status === "READY" ? 1 : status === "SIGNED" ? 2 : 3;
    return rank(left.status) - rank(right.status) || (left.logicalUnitIndex ?? left.unitIndex) - (right.logicalUnitIndex ?? right.unitIndex);
  });
  const signedCount = contracts.filter((contract) => contract.status === "SIGNED").length;
  const pendingCount = Math.max(requiredUnits - readyCount, 0);

  React.useEffect(() => {
    if (!recoveredContractProfile) return;
    if (!contracts.length) return;
    if (recoveringProfile) return;

    const emptyDraftContracts = contracts.filter((contract) => {
      if (contract.status !== "DRAFT") return false;
      return ![
        contract.driverName,
        contract.driverPhone,
        contract.driverEmail,
        contract.driverCountry,
        contract.driverAddress,
        contract.driverPostalCode,
        contract.driverDocType,
        contract.driverDocNumber,
        contract.driverBirthDate,
        contract.licenseSchool,
        contract.licenseType,
        contract.licenseNumber,
      ].some((value) => String(value ?? "").trim().length > 0) && !contract.imageConsentAccepted && !contract.minorAuthorizationProvided;
    });

    if (!emptyDraftContracts.length) {
      onRecoveredContractProfileApplied();
      return;
    }

    let cancelled = false;

    const applyRecoveredProfile = async () => {
      try {
        setRecoveringProfile(true);
        await Promise.all(
          emptyDraftContracts.map((contract) =>
            patchContract(reservationId, contract.id, {
              driverName: recoveredContractProfile.driverName ?? null,
              driverPhone: recoveredContractProfile.driverPhone ?? null,
              driverEmail: recoveredContractProfile.driverEmail ?? null,
              driverCountry: recoveredContractProfile.driverCountry ?? null,
              driverAddress: recoveredContractProfile.driverAddress ?? null,
              driverPostalCode: recoveredContractProfile.driverPostalCode ?? null,
              driverDocType: recoveredContractProfile.driverDocType ?? null,
              driverDocNumber: recoveredContractProfile.driverDocNumber ?? null,
              driverBirthDate: recoveredContractProfile.driverBirthDate ?? null,
              minorAuthorizationProvided: Boolean(recoveredContractProfile.minorAuthorizationProvided),
              imageConsentAccepted: Boolean(recoveredContractProfile.imageConsentAccepted),
              licenseSchool: recoveredContractProfile.licenseSchool ?? null,
              licenseType: recoveredContractProfile.licenseType ?? null,
              licenseNumber: recoveredContractProfile.licenseNumber ?? null,
            })
          )
        );

        if (cancelled) return;
        onRecoveredContractProfileApplied();
        await onRefresh();
      } catch (e: unknown) {
        if (cancelled) return;
        setPreviewError(e instanceof Error ? e.message : "No se pudo recuperar la ficha legal del contrato");
      } finally {
        if (!cancelled) setRecoveringProfile(false);
      }
    };

    void applyRecoveredProfile();

    return () => {
      cancelled = true;
    };
  }, [contracts, onRecoveredContractProfileApplied, onRefresh, recoveredContractProfile, recoveringProfile, reservationId]);

  async function handlePreview(contractId: string) {
    try {
      setPreviewError(null);
      setPreviewBusyId(contractId);

      const data = await renderContract(contractId);
      setPreviewContractId(contractId);
      setPreviewHtml(data?.contract?.renderedHtml ?? null);
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo generar la vista previa"
      );
    } finally {
      setPreviewBusyId(null);
    }
  }

  async function handleSignPreview() {
    if (!previewContractId) return;

    try {
      setPreviewError(null);
      setSignBusy(true);

      await signContract(previewContractId);
      setPreviewHtml(null);
      setPreviewContractId(null);

      await onRefresh();
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo marcar como SIGNED"
      );
    } finally {
      setSignBusy(false);
    }
  }

  async function handleGeneratePdf(contractId: string) {
    try {
      setPreviewError(null);
      setPdfBusyId(contractId);
      await generateContractPdf(contractId);
      await onRefresh();
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo generar el PDF"
      );
    } finally {
      setPdfBusyId(null);
    }
  }

  async function handleSaveSignature(args: {
    contractId: string;
    signerName: string;
    imageDataUrl: string;
  }) {
    try {
      setPreviewError(null);
      await saveContractSignature(args);
      await renderContract(args.contractId);
      await onRefresh();
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo guardar la firma"
      );
    }
  }
  
  async function handleMinorAuthorizationUpload(contractId: string, file: File) {
    try {
      setPreviewError(null);
      setMinorUploadBusyId(contractId);
      await uploadMinorAuthorization({ contractId, file });
      await onRefresh();
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo subir la autorización"
      );
    } finally {
      setMinorUploadBusyId(null);
    }
  }

  async function handleMinorAuthorizationDelete(contractId: string) {
    try {
      setPreviewError(null);
      setMinorDeleteBusyId(contractId);
      await deleteMinorAuthorization(contractId);
      await onRefresh();
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo eliminar la autorización"
      );
    } finally {
      setMinorDeleteBusyId(null);
    }
  }

  async function handleOpenPrecheckinLink() {
    try {
      setPreviewError(null);
      setPrecheckinBusy(true);
      const data = await getReservationPrecheckinLink(reservationId);
      setPrecheckinLink({
        url: data.url,
        expiresInMinutes: data.expiresInMinutes,
      });
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "No se pudo preparar el enlace de pre-checkin"
      );
    } finally {
      setPrecheckinBusy(false);
    }
  }

  return (
    <section id="contracts" style={{ ...panelStyle, display: "grid", gap: 12 }}>
      <ContractsHeaderSummary
        readyCount={readyCount}
        requiredUnits={requiredUnits}
        signedCount={signedCount}
        pendingCount={pendingCount}
        stateTone={stateTone}
        sectionEyebrowStyle={sectionEyebrowStyle}
        refreshButtonStyle={secondaryButtonStyle}
        onRefresh={() => void onRefresh()}
        onOpenPrecheckinLink={requiredUnits > 0 ? () => void handleOpenPrecheckinLink() : null}
        precheckinBusy={precheckinBusy}
      />

      {requiredUnits > 0 && pendingCount > 0 ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #fed7aa",
            background: "#fff7ed",
            color: "#9a3412",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 900 }}>
            Faltan contratos por completar: {readyCount}/{requiredUnits}
          </div>
          <div style={{ fontSize: 13 }}>
            La reserva requiere {requiredUnits} contrato{requiredUnits === 1 ? "" : "s"} y todavía faltan {pendingCount}.
            Si has subido la cantidad o añadido otra unidad, revisa y completa los contratos nuevos antes de formalizar.
          </div>
        </div>
      ) : null}

      {recoveredContractProfile ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1d4ed8",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ fontWeight: 900 }}>Ficha legal recuperada</div>
          <div style={{ fontSize: 13 }}>
            {recoveringProfile
              ? "Aplicando automáticamente los datos del último contrato a los borradores de esta reserva."
              : "Los contratos nuevos usarán los datos recuperados del último contrato para que solo tengas que revisar y firmar."}
          </div>
        </div>
      ) : null}

      {orderedContracts.map((c) => (
        <ContractCard
          key={c.id}
          reservationId={reservationId}
          isLicense={requiresLicense}
          c={c}
          customer={customer}
          onSaved={onRefresh}
          onPreview={handlePreview}
          previewBusy={previewBusyId === c.id}
          onGeneratePdf={handleGeneratePdf}
          pdfBusy={pdfBusyId === c.id}
          onUploadMinorAuthorization={handleMinorAuthorizationUpload}
          onDeleteMinorAuthorization={handleMinorAuthorizationDelete}
          minorUploadBusy={minorUploadBusyId === c.id}
          minorDeleteBusy={minorDeleteBusyId === c.id}
        />
      ))}

      {contractsError ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>{contractsError}</div> : null}
      {contractsLoading ? <div style={{ fontSize: 13, color: "#64748b" }}>Cargando contratos...</div> : null}
      {requiredUnits <= 0 ? <div style={{ fontSize: 13, color: "#64748b" }}>Esta reserva no requiere contratos.</div> : contracts.length === 0 ? <div style={{ fontSize: 13, color: "#64748b" }}>Aún no hay contratos generados.</div> : null}
      {previewError ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
          }}
        >
          {previewError}
        </div>
      ) : null}

      <ContractsPreviewModal
        previewHtml={previewHtml}
        previewContractId={previewContractId}
        previewContract={previewContract}
        signBusy={signBusy}
        signatureContract={signatureContract}
        customerName={customer.name}
        onClosePreview={() => {
          setPreviewHtml(null);
          setPreviewContractId(null);
          setPreviewError(null);
        }}
        onSignPreview={handleSignPreview}
        onOpenSignature={setSignatureContract}
        onCloseSignature={() => setSignatureContract(null)}
        onSaveSignature={async ({ signerName, imageDataUrl }) => {
          if (!signatureContract) return;
          await handleSaveSignature({
            contractId: signatureContract.id,
            signerName,
            imageDataUrl,
          });
        }}
      />

      {precheckinLink ? (
        <ReservationPrecheckinLinkModal
          url={precheckinLink.url}
          expiresInMinutes={precheckinLink.expiresInMinutes}
          recipientName={customer.name}
          phone={customer.phone}
          country={customer.country}
          contractsCount={requiredUnits}
          onClose={() => setPrecheckinLink(null)}
        />
      ) : null}
    </section>
  );
}

export function CartSection({
  isPackMode,
  canAddToCart,
  cartItems,
  servicesMain,
  options,
  assetAvailability,
  getServiceNameById,
  onAddToCart,
  onClearCart,
  onRemoveFromCart,
  onUpdateCartItem,
  onUpdateCartPromo,
  onError,
}: {
  isPackMode: boolean;
  canAddToCart: boolean;
  cartItems: CartItem[];
  servicesMain: ServiceMain[];
  options: Option[];
  assetAvailability: Array<{
    type: "GOPRO" | "WETSUIT" | "OTHER";
    size: string | null;
    available: number;
  }>;
  getServiceNameById: (serviceId: string) => string;
  onAddToCart: () => void;
  onClearCart: () => void;
  onRemoveFromCart: (id: string) => void;
  onUpdateCartItem: (id: string, patch: Partial<Pick<CartItem, "quantity" | "pax">>) => void;
  onUpdateCartPromo: (id: string, patch: Partial<Pick<CartItem, "applyPromo" | "promoCode">>) => void;
  onError: (message: string | null) => void;
}) {

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

  function getMaxAllowed(it: CartItem) {
    const serviceName = getServiceNameById(it.serviceId);

    if (isGoProName(serviceName)) {
      return getAvailableGoPro();
    }

    if (isWetsuitName(serviceName)) {
      const size = extractWetsuitSize(serviceName);
      return getAvailableWetsuit(size);
    }

    return Number.POSITIVE_INFINITY;
  }

  function getAvailabilityLabel(it: CartItem) {
    const serviceName = getServiceNameById(it.serviceId);

    if (isGoProName(serviceName)) {
      return `Disponibles: ${getAvailableGoPro()}`;
    }

    if (isWetsuitName(serviceName)) {
      const size = extractWetsuitSize(serviceName);
      return `Disponibles${size ? ` talla ${size}` : ""}: ${getAvailableWetsuit(size)}`;
    }

    return null;
  }

  function isAssetLimited(it: CartItem) {
    const serviceName = getServiceNameById(it.serviceId);
    return isGoProName(serviceName) || isWetsuitName(serviceName);
  }

  const totalUnits = cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity ?? 1)), 0);
  const totalPax = cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.pax ?? 1)) * Math.max(1, Number(item.quantity ?? 1)), 0);
  
  return (
    <section style={{ ...panelStyle, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>Composición</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Carrito</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Añade actividades adicionales o revisa la composición actual.</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              try {
                onAddToCart();
              } catch (e: unknown) {
                onError(errorMessage(e, "No se pudo añadir"));
              }
            }}
            disabled={!canAddToCart}
            style={{ ...primaryButtonStyle, opacity: canAddToCart ? 1 : 0.6 }}
            title={isPackMode ? "En modo pack no aplica" : "Añade esta actividad al carrito"}
          >
            Añadir actividad
          </button>

          {cartItems.length > 0 ? <button type="button" onClick={onClearCart} style={secondaryButtonStyle}>Vaciar</button> : null}
        </div>
      </div>

      {isPackMode ? <div style={{ fontSize: 12, color: "#64748b" }}>En modo <b>PACK</b> el carrito manual se desactiva porque el pack ya trae su composición.</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div style={subCardStyle}>
          <div style={sectionEyebrowStyle}>Items</div>
          <div style={{ fontSize: 26, fontWeight: 950 }}>{cartItems.length}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Líneas activas en la composición actual.</div>
        </div>
        <div style={subCardStyle}>
          <div style={sectionEyebrowStyle}>Unidades</div>
          <div style={{ fontSize: 26, fontWeight: 950 }}>{totalUnits}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Suma de cantidades del carrito.</div>
        </div>
        <div style={subCardStyle}>
          <div style={sectionEyebrowStyle}>PAX total</div>
          <div style={{ fontSize: 26, fontWeight: 950 }}>{totalPax}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Capacidad total declarada entre todas las líneas.</div>
        </div>
      </div>

      <CartItemsList
        cartItems={cartItems}
        servicesMain={servicesMain}
        options={options}
        getMaxAllowed={getMaxAllowed}
        getAvailabilityLabel={getAvailabilityLabel}
        isAssetLimited={isAssetLimited}
        onRemoveFromCart={onRemoveFromCart}
        onUpdateCartItem={onUpdateCartItem}
        onUpdateCartPromo={onUpdateCartPromo}
        onError={onError}
      />
    </section>
  );
}
