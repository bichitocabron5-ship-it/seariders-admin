"use client";

import { StatusBadge } from "@/components/seariders-ui";
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

          return (
            <div
              key={index}
              style={{ display: "grid", gridTemplateColumns: "120px 1fr 56px", alignItems: "center", gap: 10 }}
            >
              <div style={{ color, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {sign} {euros(payment.amountCents)}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge tone={payment.isDeposit ? "warning" : "info"}>{label}</StatusBadge>
                <StatusBadge tone="neutral">{payment.method ?? "-"}</StatusBadge>
                <StatusBadge tone="neutral">{payment.origin ?? "-"}</StatusBadge>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, textAlign: "right" }}>{time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
