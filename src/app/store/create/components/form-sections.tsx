"use client";

import type { AvailabilityData } from "../types";

function euros(cents: number) {
  return `${(Number(cents || 0) / 100).toFixed(2)} EUR`;
}

const cardStyle: React.CSSProperties = {
  padding: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d0d9e4",
  fontSize: 14,
  background: "#fff",
};

export function AvailabilitySection({
  dateStr,
  onDateChange,
  availabilityLoading,
  availabilityError,
  availability,
  selectedCategory,
  timeStr,
  onTimeSelect,
}: {
  dateStr: string;
  onDateChange: (value: string) => void;
  availabilityLoading: boolean;
  availabilityError: string | null;
  availability: AvailabilityData | null;
  selectedCategory: string;
  timeStr: string;
  onTimeSelect: (time: string) => void;
}) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0369a1" }}>Agenda</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Disponibilidad</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Selecciona fecha y franja horaria según la categoría activa.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Fecha</div>
          <input type="date" value={dateStr} onChange={(e) => onDateChange(e.target.value)} style={inputStyle} />
        </label>
      </div>

      {availabilityLoading ? <div style={{ color: "#64748b" }}>Cargando horarios...</div> : null}
      {availabilityError ? <div style={{ color: "#b91c1c", fontWeight: 700 }}>{availabilityError}</div> : null}

      {availability?.ok && selectedCategory ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 10 }}>
          {availability.slots.map((s) => {
            const used = Number(s.used?.[selectedCategory] ?? 0);
            const max = Number(availability?.limits?.[selectedCategory] ?? 0);
            const full = Boolean(s.isFull?.[selectedCategory]);
            const isSelected = timeStr === s.time;

            return (
              <button
                key={s.time}
                type="button"
                disabled={full}
                onClick={() => onTimeSelect(s.time)}
                style={{
                  padding: "12px 10px",
                  borderRadius: 14,
                  border: full ? "1px solid #fecaca" : isSelected ? "1px solid #0f172a" : "1px solid #d0d9e4",
                  fontWeight: 800,
                  background: full ? "#fff1f2" : isSelected ? "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" : "#fff",
                  color: full ? "#b91c1c" : isSelected ? "#fff" : "#111827",
                  cursor: full ? "not-allowed" : "pointer",
                  display: "grid",
                  gap: 4,
                }}
                title={`${used}/${max} ${full ? "COMPLETO" : "disponible"}`}
              >
                <div>{s.time}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{used}/{max}</div>
                {full ? <div style={{ fontSize: 11, fontWeight: 900 }}>Completo</div> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function PricingSection({
  discountLoading,
  canEditPricing,
  boothPricingNote,
  shownFinalCents,
  maxManualDiscountCents,
  manualDiscountEuros,
  onManualDiscountEurosChange,
  manualDiscountReason,
  onManualDiscountReasonChange,
  discountResponsibility,
  onDiscountResponsibilityChange,
  promoterDiscountSharePct,
  onPromoterDiscountSharePctChange,
  shownFinalCentsWithManual,
  manualDiscountCentsRaw,
  shownDiscountCents,
  shownBaseCents,
  shownReason,
  commissionBaseCents,
  promoterDiscountCents,
  companyDiscountCents,
  promoterNominalPct,
  promoterEffectivePct,
  pricingMeta,
  channelPricingSummary,
  availablePromos,
  applyPromo,
  selectedPromoCode,
  onApplyPromoChange,
  onPromoCodeChange,
}: {
  discountLoading: boolean;
  canEditPricing: boolean;
  boothPricingNote?: string | null;
  shownFinalCents: number;
  maxManualDiscountCents: number;
  manualDiscountEuros: string;
  onManualDiscountEurosChange: (value: string) => void;
  manualDiscountReason: string;
  onManualDiscountReasonChange: (value: string) => void;
  discountResponsibility: "COMPANY" | "PROMOTER" | "SHARED";
  onDiscountResponsibilityChange: (value: "COMPANY" | "PROMOTER" | "SHARED") => void;
  promoterDiscountSharePct: string;
  onPromoterDiscountSharePctChange: (value: string) => void;
  shownFinalCentsWithManual: number;
  manualDiscountCentsRaw: number;
  shownDiscountCents: number;
  shownBaseCents: number;
  shownReason: string;
  commissionBaseCents: number;
  promoterDiscountCents: number;
  companyDiscountCents: number;
  promoterNominalPct: number;
  promoterEffectivePct: number;
  pricingMeta?: {
    pricingTier: "STANDARD" | "RESIDENT";
    unitPriceCents: number;
    quantity: number;
    modeLabel: string;
  } | null;
  channelPricingSummary?: {
    channelName: string;
    basePriceCents: number;
    referencePriceCents: number;
    optionLabel: string;
  } | null;
  availablePromos: Array<{ code: string | null; name: string; discountCents: number }>;
  applyPromo: boolean;
  selectedPromoCode: string;
  onApplyPromoChange: (value: boolean) => void;
  onPromoCodeChange: (value: string) => void;
}) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 14, background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>Pricing</div>
          <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Precio</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {canEditPricing
              ? "Cálculo automático con opción de descuento manual controlado."
              : "Precio en solo lectura para mantener el importe ya guardado en la reserva."}
          </div>
        </div>
        {discountLoading ? <div style={{ fontSize: 12, color: "#64748b" }}>Calculando...</div> : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Total automático</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(shownFinalCents)}</div>
        </div>
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Total final</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(shownFinalCentsWithManual)}</div>
        </div>
      </div>

      {pricingMeta ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#334155", display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 900 }}>{pricingMeta.modeLabel}</div>
          <div>
            Precio unitario <strong>{euros(pricingMeta.unitPriceCents)}</strong> × {pricingMeta.quantity} = <strong>{euros(pricingMeta.unitPriceCents * pricingMeta.quantity)}</strong>
          </div>
        </div>
      ) : null}

      {boothPricingNote ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#ecfeff", border: "1px solid #a5f3fc", fontSize: 13, color: "#155e75" }}>
          {boothPricingNote}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        {canEditPricing && availablePromos.length > 0 ? (
          <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
              <input type="checkbox" checked={applyPromo} onChange={(e) => onApplyPromoChange(e.target.checked)} />
              Aplicar promoción opcional a esta actividad
            </label>
            <select value={selectedPromoCode} onChange={(e) => onPromoCodeChange(e.target.value)} disabled={!applyPromo} style={inputStyle}>
              <option value="">Selecciona promoción</option>
              {availablePromos.map((promo) => (
                <option key={promo.code ?? promo.name} value={promo.code ?? ""}>
                  {promo.name} {promo.code ? `(${promo.code})` : ""} · -{euros(promo.discountCents)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {canEditPricing ? (
          <>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                Descuento manual opcional. Máximo {euros(maxManualDiscountCents)} (30%)
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={manualDiscountEuros}
                onChange={(e) => onManualDiscountEurosChange(e.target.value)}
                style={inputStyle}
                placeholder="0"
              />
            </label>

            <input value={manualDiscountReason} onChange={(e) => onManualDiscountReasonChange(e.target.value)} style={inputStyle} placeholder="Motivo del descuento (opcional)" />

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Quién asume el descuento</div>
              <select
                value={discountResponsibility}
                onChange={(e) => onDiscountResponsibilityChange(e.target.value as "COMPANY" | "PROMOTER" | "SHARED")}
                style={inputStyle}
              >
                <option value="COMPANY">Empresa</option>
                <option value="PROMOTER">Promotor</option>
                <option value="SHARED">Compartido</option>
              </select>
            </label>

            {discountResponsibility === "SHARED" ? (
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Parte del promotor (%)</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={promoterDiscountSharePct}
                  onChange={(e) => onPromoterDiscountSharePctChange(e.target.value)}
                  style={inputStyle}
                />
              </label>
            ) : null}

            <div style={{ fontSize: 12, color: "#475569" }}>
              {manualDiscountCentsRaw > maxManualDiscountCents ? (
                <span style={{ color: "#b91c1c", fontWeight: 700 }}>El descuento se limita automáticamente a {euros(maxManualDiscountCents)}.</span>
              ) : (
                <span>Descuento aplicado correctamente.</span>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#334155" }}>
            Los ajustes de precio no se editan en esta pantalla. Si la reserva viene de Booth, se conserva el descuento ya aplicado.
          </div>
        )}
      </div>

      {shownDiscountCents > 0 ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#334155" }}>
          <div>
            Base: <span style={{ textDecoration: "line-through", opacity: 0.75 }}>{euros(shownBaseCents)}</span>
            <strong style={{ marginLeft: 8 }}>Descuento: -{euros(shownDiscountCents)}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            Base comisionable: <strong>{euros(commissionBaseCents)}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            Descuento promotor: <strong>{euros(promoterDiscountCents)}</strong> · empresa: <strong>{euros(companyDiscountCents)}</strong>
          </div>
          {promoterDiscountCents > 0 ? (
            <div style={{ marginTop: 6 }}>
              Promotor: <strong>{promoterNominalPct.toFixed(2)}%</strong> nominal → <strong>{promoterEffectivePct.toFixed(2)}%</strong> efectivo
            </div>
          ) : null}
          {shownReason ? <div style={{ marginTop: 6 }}>{shownReason}</div> : null}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#64748b" }}>Sin descuento automático.</div>
      )}

      {promoterDiscountCents > 0 ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13, color: "#7c2d12" }}>
          <div>
            Base comisionable: <strong>{euros(commissionBaseCents)}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            El promotor asume <strong>{euros(promoterDiscountCents)}</strong> del descuento.
          </div>
          <div style={{ marginTop: 6 }}>
            Comisión/promotor: <strong>{promoterNominalPct.toFixed(2)}%</strong> nominal → <strong>{promoterEffectivePct.toFixed(2)}%</strong> efectivo
          </div>
        </div>
      ) : null}

      {channelPricingSummary ? (
        <div style={{ padding: 12, borderRadius: 14, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 13, color: "#7c2d12", display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Canal {channelPricingSummary.channelName}: PVP comercial configurado</div>
          <div>
            {channelPricingSummary.optionLabel}: Admin/precios <strong>{euros(channelPricingSummary.basePriceCents)}</strong> ·
            PVP canal <strong>{euros(channelPricingSummary.referencePriceCents)}</strong>
          </div>
          <div>Resumen solo informativo para comisiones. No modifica el cobro ni el precio final de la reserva.</div>
        </div>
      ) : null}
    </section>
  );
}

export function SubmitSection({
  primaryDisabled,
  primaryLabel,
  primaryDisabledReason,
  primaryBusy = false,
  successMessage = null,
  showPrimaryDisabledReason = Boolean(primaryDisabledReason),
  workflowLabel = null,
  workflowDescription = null,
  workflowMissingRequirements = [],
  workflowActionLabel = null,
  workflowActionTargetId = null,
  onWorkflowAction = undefined,
}: {
  primaryDisabled: boolean;
  primaryLabel: string;
  primaryDisabledReason: string | null;
  primaryBusy?: boolean;
  successMessage?: string | null;
  showPrimaryDisabledReason?: boolean;
  workflowLabel?: string | null;
  workflowDescription?: string | null;
  workflowMissingRequirements?: string[];
  workflowActionLabel?: string | null;
  workflowActionTargetId?: string | null;
  onWorkflowAction?: (() => void) | undefined;
}) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f172a" }}>Acción</div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Confirmación</div>
        {workflowLabel ? <div style={{ fontSize: 13, fontWeight: 800, color: "#0f766e" }}>Estado visible: {workflowLabel}</div> : null}
        {workflowDescription ? <div style={{ fontSize: 13, color: "#64748b" }}>{workflowDescription}</div> : null}
      </div>

      {workflowMissingRequirements.length > 0 ? (
        <div style={{ padding: 12, border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: 12, color: "#9a3412", display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Qué falta</div>
          {workflowMissingRequirements.map((requirement) => (
            <div key={requirement} style={{ fontSize: 13 }}>{requirement}</div>
          ))}
        </div>
      ) : null}

      {workflowActionLabel && workflowActionTargetId && onWorkflowAction ? (
        <button
          type="button"
          onClick={onWorkflowAction}
          style={{
            padding: "12px 14px",
            fontWeight: 900,
            borderRadius: 14,
            border: "1px solid #0f766e",
            background: "#ecfeff",
            color: "#0f766e",
            cursor: "pointer",
          }}
        >
          {workflowActionLabel}
        </button>
      ) : null}

      <button
        type="submit"
        disabled={primaryDisabled || primaryBusy}
        style={{
          padding: "14px 16px",
          fontWeight: 900,
          borderRadius: 14,
          border: "1px solid #0f172a",
          background: primaryDisabled || primaryBusy ? "#cbd5e1" : "#0f172a",
          color: primaryDisabled || primaryBusy ? "#334155" : "#fff",
          cursor: primaryDisabled || primaryBusy ? "not-allowed" : "pointer",
        }}
      >
        {primaryBusy ? "Guardando..." : primaryLabel}
      </button>

      {showPrimaryDisabledReason && primaryDisabledReason ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12, color: "#991b1b", fontWeight: 700 }}>
          {primaryDisabledReason}
        </div>
      ) : null}

      {successMessage ? (
        <div style={{ padding: 12, border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 12, color: "#166534", fontWeight: 700 }}>
          {successMessage}
        </div>
      ) : null}
    </section>
  );
}

export function FutureReservationPaymentsSection({
  totalServiceCents,
  paidServiceCents,
  pendingServiceCents,
  paymentMethod,
  paymentAmountEuros,
  paymentBusy,
  paymentError,
  onPaymentMethodChange,
  onPaymentAmountEurosChange,
  onFillPendingAmount,
  onCharge,
}: {
  totalServiceCents: number;
  paidServiceCents: number;
  pendingServiceCents: number;
  paymentMethod: "CASH" | "CARD" | "BIZUM" | "TRANSFER";
  paymentAmountEuros: string;
  paymentBusy: boolean;
  paymentError: string | null;
  onPaymentMethodChange: (value: "CASH" | "CARD" | "BIZUM" | "TRANSFER") => void;
  onPaymentAmountEurosChange: (value: string) => void;
  onFillPendingAmount: () => void;
  onCharge: () => void;
}) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>Cobro</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Paga y señal</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Registra cobros parciales del servicio sin formalizar todavía la reserva. La fianza seguirá en la operativa normal.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Total servicio</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(totalServiceCents)}</div>
        </div>
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Cobrado</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(paidServiceCents)}</div>
        </div>
        <div style={{ padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Pendiente</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{euros(pendingServiceCents)}</div>
        </div>
      </div>

      {pendingServiceCents > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Metodo</div>
            <select value={paymentMethod} onChange={(e) => onPaymentMethodChange(e.target.value as "CASH" | "CARD" | "BIZUM" | "TRANSFER")} style={inputStyle}>
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="BIZUM">Bizum</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>Importe</div>
            <input
              type="text"
              inputMode="decimal"
              value={paymentAmountEuros}
              onChange={(e) => onPaymentAmountEurosChange(e.target.value)}
              placeholder="0"
              style={inputStyle}
            />
          </label>

          <button type="button" onClick={onFillPendingAmount} disabled={paymentBusy} style={{ ...inputStyle, fontWeight: 800, cursor: paymentBusy ? "wait" : "pointer" }}>
            Rellenar resto
          </button>

          <button
            type="button"
            onClick={onCharge}
            disabled={paymentBusy}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 900,
              cursor: paymentBusy ? "wait" : "pointer",
            }}
          >
            {paymentBusy ? "Cobrando..." : "Registrar cobro"}
          </button>
        </div>
      ) : (
        <div style={{ padding: 12, borderRadius: 14, background: "#ecfdf5", border: "1px solid #bbf7d0", color: "#166534", fontWeight: 800 }}>
          El servicio ya está completamente cobrado.
        </div>
      )}

      {paymentError ? (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 700 }}>
          {paymentError}
        </div>
      ) : null}
    </section>
  );
}
