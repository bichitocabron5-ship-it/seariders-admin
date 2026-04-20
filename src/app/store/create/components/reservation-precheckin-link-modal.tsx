"use client";

import type React from "react";
import { useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { formatLinkExpiry, normalizePhoneForWhatsApp } from "./contract-signer-link-modal";
import {
  appendPublicLanguage,
  getDefaultPublicLanguage,
  getPublicCopy,
  PUBLIC_LANGUAGE_OPTIONS,
  type PublicLanguage,
} from "@/lib/public-links/i18n";

export function ReservationPrecheckinLinkModal({
  url,
  expiresInMinutes,
  recipientName,
  phone,
  country,
  contractsCount,
  onClose,
}: {
  url: string;
  expiresInMinutes: number;
  recipientName: string;
  phone?: string | null;
  country?: string | null;
  contractsCount: number;
  onClose: () => void;
}) {
  const [language, setLanguage] = useState<PublicLanguage>(getDefaultPublicLanguage(country));
  const copy = getPublicCopy(language);
  const localizedUrl = useMemo(() => appendPublicLanguage(url, language), [language, url]);
  const whatsappPhone = normalizePhoneForWhatsApp(phone ?? "", country);
  const expiryLabel = formatLinkExpiry(expiresInMinutes);
  const whatsappMessage = copy.precheckinModal.buildMessage({
    recipientName,
    contractsCount,
    url: localizedUrl,
    expiryLabel,
  });

  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${encodeURIComponent(whatsappPhone)}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          width: "min(640px, 96vw)",
          background: "#fff",
          borderRadius: 18,
          padding: 18,
          display: "grid",
          gap: 14,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "#0f766e" }}>
            {copy.precheckinModal.titleEyebrow}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{copy.precheckinModal.title}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {copy.precheckinModal.description(contractsCount)}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          Idioma
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as PublicLanguage)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}
          >
            {PUBLIC_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            display: "grid",
            placeItems: "center",
            padding: 18,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
            <QRCode value={localizedUrl} size={256} />
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {copy.precheckinModal.linkLabel}
          <input readOnly value={localizedUrl} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }} />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {copy.precheckinModal.whatsappLabel}
          <textarea readOnly value={whatsappMessage} style={{ width: "100%", minHeight: 148, padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff", resize: "vertical" }} />
        </label>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: whatsappUrl ? "1px solid #bbf7d0" : "1px solid #fde68a",
            background: whatsappUrl ? "#f0fdf4" : "#fffbeb",
            color: whatsappUrl ? "#166534" : "#92400e",
            fontSize: 13,
          }}
        >
          {whatsappUrl
            ? copy.precheckinModal.whatsappReady(phone || "the customer")
            : copy.precheckinModal.whatsappMissing}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <button type="button" onClick={() => void navigator.clipboard.writeText(localizedUrl)} style={buttonStyle}>
            {copy.precheckinModal.copyLink}
          </button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(whatsappMessage)} style={buttonStyle}>
            {copy.precheckinModal.copyMessage}
          </button>
          <button
            type="button"
            onClick={() => {
              if (whatsappUrl) window.location.href = whatsappUrl;
            }}
            disabled={!whatsappUrl}
            style={{
              ...buttonStyle,
              border: "1px solid #16a34a",
              background: whatsappUrl ? "#16a34a" : "#dcfce7",
              color: whatsappUrl ? "#fff" : "#166534",
              cursor: whatsappUrl ? "pointer" : "not-allowed",
              opacity: whatsappUrl ? 1 : 0.65,
            }}
          >
            {copy.precheckinModal.sendWhatsapp}
          </button>
          <button
            type="button"
            onClick={() => window.open(localizedUrl, "_blank", "noopener,noreferrer")}
            style={{
              ...buttonStyle,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
            }}
          >
            {copy.precheckinModal.openLink}
          </button>
        </div>

        <button type="button" onClick={onClose} style={buttonStyle}>
          {copy.precheckinModal.close}
        </button>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};
