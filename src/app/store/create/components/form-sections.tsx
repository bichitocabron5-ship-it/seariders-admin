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
  shownFinalCents,
  maxManualDiscountCents,
  manualDiscountEuros,
  onManualDiscountEurosChange,
  manualDiscountReason,
  onManualDiscountReasonChange,
  shownFinalCentsWithManual,
  manualDiscountCentsRaw,
  shownDiscountCents,
  shownBaseCents,
  shownReason,
  availablePromos,
  applyPromo,
  selectedPromoCode,
  onApplyPromoChange,
  onPromoCodeChange,
}: {
  discountLoading: boolean;
  canEditPricing: boolean;
  shownFinalCents: number;
  maxManualDiscountCents: number;
  manualDiscountEuros: number;
  onManualDiscountEurosChange: (value: number) => void;
  manualDiscountReason: string;
  onManualDiscountReasonChange: (value: string) => void;
  shownFinalCentsWithManual: number;
  manualDiscountCentsRaw: number;
  shownDiscountCents: number;
  shownBaseCents: number;
  shownReason: string;
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
                type="number"
                min={0}
                step={1}
                value={manualDiscountEuros}
                onChange={(e) => onManualDiscountEurosChange(Number(e.target.value || 0))}
                style={inputStyle}
                placeholder="0"
              />
            </label>

            <input value={manualDiscountReason} onChange={(e) => onManualDiscountReasonChange(e.target.value)} style={inputStyle} placeholder="Motivo del descuento (opcional)" />

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
          {shownReason ? <div style={{ marginTop: 6 }}>{shownReason}</div> : null}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#64748b" }}>Sin descuento automático.</div>
      )}
    </section>
  );
}

export function SubmitSection({
  primaryDisabled,
  primaryLabel,
  primaryDisabledReason,
}: {
  primaryDisabled: boolean;
  primaryLabel: string;
  primaryDisabledReason: string | null;
}) {
  return (
    <section style={{ ...cardStyle, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f172a" }}>Acción</div>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Confirmación</div>
      </div>
      <button
        type="submit"
        disabled={primaryDisabled}
        style={{
          padding: "14px 16px",
          fontWeight: 900,
          borderRadius: 14,
          border: "1px solid #0f172a",
          background: primaryDisabled ? "#cbd5e1" : "#0f172a",
          color: primaryDisabled ? "#334155" : "#fff",
          cursor: primaryDisabled ? "not-allowed" : "pointer",
        }}
      >
        {primaryLabel}
      </button>

      {primaryDisabledReason ? (
        <div style={{ padding: 12, border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12, color: "#991b1b", fontWeight: 700 }}>
          {primaryDisabledReason}
        </div>
      ) : null}
    </section>
  );
}
