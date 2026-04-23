"use client";

import type React from "react";
import { AlertBanner } from "@/components/seariders-ui";
import { brand } from "@/lib/brand";

type Props = {
  amountEuros: string;
  receivedEuros: string;
  onReceivedEurosChange: (value: string) => void;
  inputStyle?: React.CSSProperties;
};

function parseEuros(value: string) {
  const normalized = String(value ?? "").replace(",", ".").trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatEuros(value: number) {
  return `${value.toFixed(2)} EUR`;
}

export function getCashChangeSummary(amountEuros: string, receivedEuros: string) {
  const due = parseEuros(amountEuros);
  const received = parseEuros(receivedEuros);
  const change = Math.max(0, received - due);
  const missing = Math.max(0, due - received);

  return {
    change,
    missing,
    hasReceived: receivedEuros.trim().length > 0,
  };
}

export default function CashChangeHelper({
  amountEuros,
  receivedEuros,
  onReceivedEurosChange,
  inputStyle,
}: Props) {
  const summary = getCashChangeSummary(amountEuros, receivedEuros);
  const tone = summary.change > 0 ? "success" : summary.missing > 0 ? "warning" : "info";
  const message =
    summary.change > 0
      ? `Cambio a devolver: ${formatEuros(summary.change)}`
      : summary.missing > 0
        ? `Faltan por cobrar: ${formatEuros(summary.missing)}`
        : "Importe exacto";

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        value={receivedEuros}
        onChange={(e) => onReceivedEurosChange(e.target.value)}
        placeholder="Entregado EUR"
        style={
          inputStyle ?? {
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${brand.colors.border}`,
            background: brand.colors.surface,
          }
        }
      />
      {summary.hasReceived ? (
        <AlertBanner tone={tone} title="Resumen de efectivo">
          {message}
        </AlertBanner>
      ) : null}
    </div>
  );
}
