"use client";

import type { ReservationPayment } from "../types";
import { euros } from "../utils";

type StoreReservationPaymentsHistoryProps = {
  payments: ReservationPayment[];
};

export function StoreReservationPaymentsHistory({ payments }: StoreReservationPaymentsHistoryProps) {
  if (!payments.length) return null;

  return (
    <div style={{ marginTop: 10, borderTop: "1px dashed #e5e7eb", paddingTop: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Historial de pagos</div>
      <div style={{ display: "grid", gap: 8 }}>
        {payments.map((payment, index) => {
          const isOut = payment.direction === "OUT";
          const sign = isOut ? "-" : "+";
          const color = isOut ? "#dc2626" : "#16a34a";
          const label = payment.isDeposit ? "Fianza" : "Servicio";
          const time = new Date(payment.createdAt ?? "").toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

          const Chip = ({ text, bg }: { text: string; bg: string }) => (
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: bg, whiteSpace: "nowrap" }}>{text}</span>
          );

          return (
            <div
              key={index}
              style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 10 }}
            >
              <div style={{ color, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {sign} {euros(payment.amountCents)}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip text={label} bg={payment.isDeposit ? "#fff7cc" : "#eaf2ff"} />
                <Chip text={payment.method ?? "-"} bg="#f3f4f6" />
                <Chip text={payment.origin ?? "-"} bg="#f3f4f6" />
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>{time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
