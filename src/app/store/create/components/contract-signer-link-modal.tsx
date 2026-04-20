"use client";

import QRCode from "react-qr-code";
import { useMemo, useState } from "react";
import {
  appendPublicLanguage,
  getDefaultPublicLanguage,
  getPublicCopy,
  PUBLIC_LANGUAGE_OPTIONS,
  type PublicLanguage,
} from "@/lib/public-links/i18n";

const COUNTRY_DIAL_CODES: Record<string, string> = {
  ES: "34",
  FR: "33",
  DE: "49",
  IT: "39",
  PT: "351",
  GB: "44",
  IE: "353",
  NL: "31",
  BE: "32",
  CH: "41",
  AT: "43",
};

export function normalizePhoneForWhatsApp(phone: string, country?: string | null) {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith("+")) {
    const normalized = raw.slice(1).replace(/\D/g, "");
    return normalized.length >= 8 ? normalized : null;
  }

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 ? digits : null;
  }

  const dialCode = COUNTRY_DIAL_CODES[String(country ?? "").trim().toUpperCase()];
  if (!dialCode) return digits.length >= 8 ? digits : null;

  const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;
  const normalized = `${dialCode}${localDigits}`;
  return normalized.length >= 8 ? normalized : null;
}

export function formatLinkExpiry(expiresInMinutes: number) {
  if (expiresInMinutes >= 1440) {
    const days = Math.round(expiresInMinutes / 1440);
    return `${days} dia${days === 1 ? "" : "s"}`;
  }

  return `${expiresInMinutes} minuto${expiresInMinutes === 1 ? "" : "s"}`;
}

export function ContractSignerLinkModal({
  url,
  expiresInMinutes,
  recipientName,
  phone,
  country,
  unitLabel,
  manualMessage,
  notificationStatus,
  notificationProvider,
  notificationError,
  onClose,
}: {
  url: string;
  expiresInMinutes: number;
  recipientName: string;
  phone?: string | null;
  country?: string | null;
  unitLabel: string;
  manualMessage?: string | null;
  notificationStatus?: string | null;
  notificationProvider?: string | null;
  notificationError?: string | null;
  onClose: () => void;
}) {
  const [language, setLanguage] = useState<PublicLanguage>(getDefaultPublicLanguage(country));
  const copy = getPublicCopy(language);
  const localizedUrl = useMemo(() => appendPublicLanguage(url, language), [language, url]);
  const whatsappPhone = normalizePhoneForWhatsApp(phone ?? "", country);
  const expiryLabel = formatLinkExpiry(expiresInMinutes);
  const fallbackMessage = copy.signerModal.buildMessage({
    recipientName,
    unitLabel,
    url: localizedUrl,
    expiryLabel,
  });
  const whatsappMessage = manualMessage?.trim() ? manualMessage : fallbackMessage;
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
          width: "min(560px, 96vw)",
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
            {copy.signerModal.titleEyebrow}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{copy.signerModal.title}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {copy.signerModal.expires(expiryLabel)}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          Idioma
          <select value={language} onChange={(e) => setLanguage(e.target.value as PublicLanguage)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }}>
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
            <QRCode value={url} size={256} />
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {copy.signerModal.linkLabel}
          <input
            readOnly
            value={localizedUrl}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#fff",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {copy.signerModal.whatsappLabel}
          <textarea
            readOnly
            value={whatsappMessage}
            style={{
              width: "100%",
              minHeight: 132,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#fff",
              resize: "vertical",
            }}
          />
        </label>

        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border:
              notificationStatus === "SENT"
                ? "1px solid #bbf7d0"
                : whatsappUrl
                ? "1px solid #bbf7d0"
                : "1px solid #fde68a",
            background:
              notificationStatus === "SENT"
                ? "#f0fdf4"
                : whatsappUrl
                ? "#f0fdf4"
                : "#fffbeb",
            color:
              notificationStatus === "SENT"
                ? "#166534"
                : whatsappUrl
                ? "#166534"
                : "#92400e",
            fontSize: 13,
            display: "grid",
            gap: 4,
          }}
        >
          <div>
            {notificationStatus === "SENT"
              ? `WhatsApp enviado${notificationProvider ? ` por ${notificationProvider}` : ""}.`
              : whatsappUrl
              ? copy.signerModal.whatsappReady(phone || "the customer")
              : copy.signerModal.whatsappMissing}
          </div>
          {notificationStatus && notificationStatus !== "SENT" ? (
            <div style={{ fontSize: 12 }}>
              Estado backend: {notificationStatus}
              {notificationError ? ` | ${notificationError}` : ""}
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(localizedUrl)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {copy.signerModal.copyLink}
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(whatsappMessage)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {copy.signerModal.copyMessage}
          </button>
          <button
            type="button"
            onClick={() => {
              if (whatsappUrl) window.location.href = whatsappUrl;
            }}
            disabled={!whatsappUrl}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #16a34a",
              background: whatsappUrl ? "#16a34a" : "#dcfce7",
              color: whatsappUrl ? "#fff" : "#166534",
              fontWeight: 900,
              cursor: whatsappUrl ? "pointer" : "not-allowed",
              opacity: whatsappUrl ? 1 : 0.65,
            }}
          >
            {copy.signerModal.sendWhatsapp}
          </button>
          <button
            type="button"
            onClick={() => window.open(localizedUrl, "_blank", "noopener,noreferrer")}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {copy.signerModal.openLink}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {copy.signerModal.close}
        </button>
      </div>
    </div>
  );
}
