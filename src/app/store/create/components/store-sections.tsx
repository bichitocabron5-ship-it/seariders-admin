// src/app/store/create/components/store-sections.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { CartItem, ContractDto, ContractPatch, Option, ServiceMain } from "../types";
import { errorMessage } from "../utils/errors";
import { renderContract, signContract } from "../services/contracts";

const panelStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
};
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #d0d9e4", background: "#fff" };
const secondaryButtonStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 12, border: "1px solid #d0d9e4", background: "#fff", fontWeight: 900 };
const primaryButtonStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 12, border: "1px solid #0f172a", background: "#0f172a", color: "#fff", fontWeight: 900 };

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

function ContractCard({
  reservationId,
  isLicense,
  c,
  customer,
  onSaved,
  onPreview,
  previewBusy,
}: {
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
}) {
  const [saving, setSaving] = React.useState(false);
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
  const [licenseSchool, setLicenseSchool] = React.useState<string>(c.licenseSchool ?? "");
  const [licenseType, setLicenseType] = React.useState<string>(c.licenseType ?? "");
  const [licenseNumber, setLicenseNumber] = React.useState<string>(c.licenseNumber ?? "");

  const age = React.useMemo(() => ageAt(birthYmd), [birthYmd]);
  const needsAuth = age != null && age >= 16 && age < 18;
  const isUnder16 = age != null && age < 16;
  const showLicenseFields =
  isLicense ||
  Boolean(licenseSchool?.trim()) ||
  Boolean(licenseType?.trim()) ||
  Boolean(licenseNumber?.trim());


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
    setLicenseSchool(c.licenseSchool ?? "");
    setLicenseType(c.licenseType ?? "");
    setLicenseNumber(c.licenseNumber ?? "");
  }, [c.id, c.driverAddress, c.driverBirthDate, c.driverCountry, c.driverDocNumber, c.driverDocType, c.driverEmail, c.driverName, c.driverPhone, c.driverPostalCode, c.licenseNumber, c.licenseSchool, c.licenseType, c.minorAuthorizationProvided]);

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
      licenseSchool: licenseSchool || null,
      licenseType: licenseType || null,
      licenseNumber: licenseNumber || null,
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

  return (
    <article style={{ ...panelStyle, display: "grid", gap: 12, background: "#fdfefe" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#7c3aed" }}>Contrato</div>
          <div style={{ fontWeight: 900, fontSize: 16, marginTop: 4 }}>Contrato #{c.unitIndex}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Estado actual: {c.status}</div>
        </div>
        <div style={{ padding: "6px 10px", borderRadius: 999, background: "#f1f5f9", fontWeight: 900 }}>{c.status}</div>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Fecha de nacimiento *</div>
        <input type="date" value={birthYmd} onChange={(e) => setBirthYmd(e.target.value)} style={inputStyle} />
      </label>

      {isUnder16 ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>Menor de 16: no permitido.</div> : null}

      {needsAuth ? (
        <label style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid #fde68a", background: "#fffbeb" }}>
          <input type="checkbox" checked={minorAuthorizationProvided} onChange={(e) => setMinorAuthorizationProvided(e.target.checked)} />
          <div style={{ fontWeight: 800 }}>Menor de 16-17 años: requiere autorización del tutor.</div>
        </label>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => {
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
          style={secondaryButtonStyle}
        >
          Copiar datos del cliente
        </button>
        <div style={{ fontSize: 12, color: "#64748b" }}>Usa copiar y ajusta solo lo que cambie para cada conductor.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Nombre del conductor
          <input value={driverName} onChange={(e) => setDriverName(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Teléfono
          <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Email
          <input value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} style={inputStyle} placeholder="conductor@email.com" />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          País (ISO-2)
          <input value={driverCountry} onChange={(e) => setDriverCountry(e.target.value.toUpperCase())} style={inputStyle} placeholder="ES" />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Dirección
          <input value={driverAddress} onChange={(e) => setDriverAddress(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Código postal
          <input value={driverPostalCode} onChange={(e) => setDriverPostalCode(e.target.value)} style={inputStyle} placeholder="08303" />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Tipo de documento
          <select value={driverDocType} onChange={(e) => setDriverDocType(e.target.value)} style={inputStyle}>
            <option value="">Opcional</option>
            <option value="DNI">DNI</option>
            <option value="NIE">NIE</option>
            <option value="PASSPORT">Pasaporte</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
          Número de documento
          <input value={driverDocNumber} onChange={(e) => setDriverDocNumber(e.target.value)} style={inputStyle} />
        </label>
      </div>

      {showLicenseFields ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
            Escuela de licencia
            <input value={licenseSchool} onChange={(e) => setLicenseSchool(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
            Tipo de licencia
            <input value={licenseType} onChange={(e) => setLicenseType(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
            Número de licencia
            <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} style={inputStyle} />
          </label>
        </div>
      ) : null}

      {err ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 800 }}>{err}</div> : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => savePartial({ ...buildPayload() })} disabled={saving} style={secondaryButtonStyle}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={markReady} disabled={saving || isUnder16} style={{ ...primaryButtonStyle, opacity: saving || isUnder16 ? 0.6 : 1 }} title={isUnder16 ? "No permitido <16" : ""}>
          Marcar READY
        </button>
        <button
          type="button"
          onClick={() => void onPreview(c.id)}
          style={secondaryBtn}
          disabled={previewBusy}
        >
          {previewBusy ? "Generando..." : "Vista previa"}
        </button>
      </div>

      {showLicenseFields ? (
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Si esta actividad requiere licencia, el backend validará la licencia antes de READY.
        </div>
      ) : null}
    </article>
  );
}

export function ContractsSection({
  reservationId,
  readyCount,
  requiredUnits,
  contracts,
  contractsLoading,
  contractsError,
  requiresLicense,
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
  customer: {
    name: string;
    phone: string;
    email: string;
    country: string;
    postalCode: string;
  };
  onRefresh: () => Promise<void>;
}) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewContractId, setPreviewContractId] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);

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
  return (
    <section id="contracts" style={{ ...panelStyle, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#7c3aed" }}>Documentación</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Contratos</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Operativo: {readyCount}/{requiredUnits} listos. Bloquea el cobro hasta completar contratos.</div>
        </div>
        <button type="button" onClick={() => void onRefresh()} style={secondaryButtonStyle}>Refrescar</button>
      </div>

      {contracts.map((c) => (
        <ContractCard
          key={c.id}
          reservationId={reservationId}
          isLicense={requiresLicense}
          c={c}
          customer={customer}
          onSaved={onRefresh}
          onPreview={handlePreview}
          previewBusy={previewBusyId === c.id}
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

      {previewHtml ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            setPreviewHtml(null);
            setPreviewContractId(null);
            setPreviewError(null);
          }}
        >
          <div
            style={{
              width: "min(1100px, 96vw)",
              height: "min(90vh, 900px)",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>Vista previa del contrato</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => void handleSignPreview()}
                  style={primaryBtn}
                  disabled={!previewContractId || signBusy}
                >
                  {signBusy ? "Firmando..." : "Marcar SIGNED"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewHtml(null);
                    setPreviewContractId(null);
                    setPreviewError(null);
                  }}
                  style={secondaryBtn}
                >
                  Cerrar
                </button>
              </div>
            </div>

            <iframe
              title="Vista previa contrato"
              srcDoc={previewHtml}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                background: "#fff",
              }}
            />
          </div>
        </div>
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
  onAddToCart,
  onClearCart,
  onRemoveFromCart,
  onUpdateCartItem,
  onError,
}: {
  isPackMode: boolean;
  canAddToCart: boolean;
  cartItems: CartItem[];
  servicesMain: ServiceMain[];
  options: Option[];
  onAddToCart: () => void;
  onClearCart: () => void;
  onRemoveFromCart: (id: string) => void;
  onUpdateCartItem: (id: string, patch: Partial<Pick<CartItem, "quantity" | "pax">>) => void;
  onError: (message: string) => void;
}) {
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

      {cartItems.length === 0 ? (
        <div style={{ fontSize: 13, color: "#64748b" }}>No hay ítems. Si no añades nada, se creará solo con el servicio seleccionado arriba.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {cartItems.map((it) => {
            const svc = servicesMain.find((s) => s.id === it.serviceId);
            const opt = options.find((o) => o.id === it.optionId);

            return (
              <article key={it.id} style={{ padding: 14, border: "1px solid #e2e8f0", borderRadius: 16, display: "grid", gap: 10, background: "#fdfefe" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {svc?.category ? `${svc.category} | ` : ""}
                    {svc?.name ?? it.serviceId}
                    {opt?.durationMinutes ? ` | ${opt.durationMinutes} min` : ""}
                  </div>
                  <button type="button" onClick={() => onRemoveFromCart(it.id)} style={secondaryButtonStyle}>Quitar</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                    Cantidad
                    <input type="number" min={1} value={it.quantity} onChange={(e) => onUpdateCartItem(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })} style={inputStyle} />
                  </label>

                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                    PAX para este ítem
                    <input type="number" min={1} value={it.pax} onChange={(e) => onUpdateCartItem(it.id, { pax: Math.max(1, Number(e.target.value || 1)) })} style={inputStyle} />
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
