"use client";

import type { CSSProperties } from "react";

type Props = {
  newName: string;
  newKind: "STANDARD" | "EXTERNAL_ACTIVITY";
  newIsActive: boolean;
  newVisibleInStore: boolean;
  newVisibleInBooth: boolean;
  newShowDiscountPolicyInStore: boolean;
  newShowDiscountPolicyInBooth: boolean;
  newAllowsPromotions: boolean;
  newCommissionEnabled: boolean;
  newCommissionPct: string;
  newDiscountResponsibility: "COMPANY" | "PROMOTER" | "SHARED";
  newPromoterDiscountSharePct: string;
  creating: boolean;
  setNewName: (value: string) => void;
  setNewKind: (value: "STANDARD" | "EXTERNAL_ACTIVITY") => void;
  setNewIsActive: (value: boolean) => void;
  setNewVisibleInStore: (value: boolean) => void;
  setNewVisibleInBooth: (value: boolean) => void;
  setNewShowDiscountPolicyInStore: (value: boolean) => void;
  setNewShowDiscountPolicyInBooth: (value: boolean) => void;
  setNewAllowsPromotions: (value: boolean) => void;
  setNewCommissionEnabled: (value: boolean) => void;
  setNewCommissionPct: (value: string) => void;
  setNewDiscountResponsibility: (value: "COMPANY" | "PROMOTER" | "SHARED") => void;
  setNewPromoterDiscountSharePct: (value: string) => void;
  createChannel: () => void | Promise<void>;
  panelStyle: CSSProperties;
  panelHeader: CSSProperties;
  controlsGrid: CSSProperties;
  inputStyle: CSSProperties;
  darkBtn: CSSProperties;
};

export default function CreateChannelSection({
  newName,
  newKind,
  newIsActive,
  newVisibleInStore,
  newVisibleInBooth,
  newShowDiscountPolicyInStore,
  newShowDiscountPolicyInBooth,
  newAllowsPromotions,
  newCommissionEnabled,
  newCommissionPct,
  newDiscountResponsibility,
  newPromoterDiscountSharePct,
  creating,
  setNewName,
  setNewKind,
  setNewIsActive,
  setNewVisibleInStore,
  setNewVisibleInBooth,
  setNewShowDiscountPolicyInStore,
  setNewShowDiscountPolicyInBooth,
  setNewAllowsPromotions,
  setNewCommissionEnabled,
  setNewCommissionPct,
  setNewDiscountResponsibility,
  setNewPromoterDiscountSharePct,
  createChannel,
  panelStyle,
  panelHeader,
  controlsGrid,
  inputStyle,
  darkBtn,
}: Props) {
  return (
    <section style={panelStyle}>
      <div style={panelHeader}>
        <div style={{ fontWeight: 950 }}>Crear canal</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Alta rápida de un canal comercial con visibilidad, estado, comisión base y política de descuentos.
        </div>
      </div>

      <div style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={controlsGrid}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Nombre del canal
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Booking, GetYourGuide, Brutal"
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Tipo de canal
            <select
              value={newKind}
              onChange={(e) => {
                const nextKind = e.target.value as "STANDARD" | "EXTERNAL_ACTIVITY";
                setNewKind(nextKind);
                if (nextKind === "EXTERNAL_ACTIVITY") setNewVisibleInBooth(true);
              }}
              style={inputStyle}
            >
              <option value="STANDARD">Comercial estándar</option>
              <option value="EXTERNAL_ACTIVITY">Actividad externa</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Comisión base (%)
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={newCommissionPct}
              onChange={(e) => setNewCommissionPct(e.target.value)}
              style={inputStyle}
              disabled={!newCommissionEnabled}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
            Quién asume el descuento
            <select
              value={newDiscountResponsibility}
              onChange={(e) => setNewDiscountResponsibility(e.target.value as "COMPANY" | "PROMOTER" | "SHARED")}
              style={inputStyle}
            >
              <option value="COMPANY">Empresa</option>
              <option value="PROMOTER">Promotor</option>
              <option value="SHARED">Compartido</option>
            </select>
          </label>

          {newDiscountResponsibility === "SHARED" ? (
            <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
              Parte del promotor (%)
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={newPromoterDiscountSharePct}
                onChange={(e) => setNewPromoterDiscountSharePct(e.target.value)}
                style={inputStyle}
              />
            </label>
          ) : null}

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={newVisibleInStore} onChange={(e) => setNewVisibleInStore(e.target.checked)} />
            Visible en tienda
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={newVisibleInBooth} onChange={(e) => setNewVisibleInBooth(e.target.checked)} />
            Visible en booth
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={newShowDiscountPolicyInStore}
              onChange={(e) => setNewShowDiscountPolicyInStore(e.target.checked)}
            />
            Mostrar dto en tienda
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={newShowDiscountPolicyInBooth}
              onChange={(e) => setNewShowDiscountPolicyInBooth(e.target.checked)}
            />
            Mostrar dto en booth
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={newAllowsPromotions} onChange={(e) => setNewAllowsPromotions(e.target.checked)} />
            Permite promociones automáticas y puntuales
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input
              type="checkbox"
              checked={newCommissionEnabled}
              onChange={(e) => {
                setNewCommissionEnabled(e.target.checked);
                if (!e.target.checked) setNewCommissionPct("0");
              }}
            />
            Comisión activa
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, fontWeight: 800 }}>
            <input type="checkbox" checked={newIsActive} onChange={(e) => setNewIsActive(e.target.checked)} />
            Canal activo
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => void createChannel()} disabled={creating} style={darkBtn}>
            {creating ? "Creando..." : "Crear canal"}
          </button>
        </div>
      </div>
    </section>
  );
}
