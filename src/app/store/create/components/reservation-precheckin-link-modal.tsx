"use client";

import type React from "react";
import QRCode from "react-qr-code";
import { normalizePhoneForWhatsApp } from "./contract-signer-link-modal";

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
  const whatsappPhone = normalizePhoneForWhatsApp(phone ?? "", country);
  const whatsappMessage =
    `Hola ${recipientName || "cliente"},\n\n` +
    `Le enviamos su enlace seguro de pre-checkin para completar los datos de la reserva, revisar el contrato${contractsCount === 1 ? "" : " de cada unidad"} y firmarlo digitalmente antes de su llegada.\n\n` +
    `${url}\n\n` +
    `Una vez completado, en tienda solo revisaremos los datos finales para continuar con el cobro.\n\n` +
    `Este enlace caduca en ${expiresInMinutes} minutos.\n\n` +
    `Gracias,\nEquipo Seariders`;

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
            Pre-checkin remoto
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Enviar enlace único de reserva</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            El cliente podrá completar sus datos, revisar {contractsCount === 1 ? "el contrato" : `los ${contractsCount} contratos`} y firmar antes de venir.
          </div>
        </div>

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
          Enlace de pre-checkin
          <input readOnly value={url} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 13, background: "#fff" }} />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 800 }}>
          Mensaje para WhatsApp
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
            ? `WhatsApp listo para ${phone || "el cliente"}.`
            : "No hay un teléfono válido para abrir WhatsApp automáticamente. Puedes copiar el mensaje y enviarlo manualmente."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <button type="button" onClick={() => void navigator.clipboard.writeText(url)} style={buttonStyle}>
            Copiar enlace
          </button>
          <button type="button" onClick={() => void navigator.clipboard.writeText(whatsappMessage)} style={buttonStyle}>
            Copiar mensaje
          </button>
          <button
            type="button"
            onClick={() => {
              if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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
            Enviar WhatsApp
          </button>
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            style={{
              ...buttonStyle,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
            }}
          >
            Abrir enlace
          </button>
        </div>

        <button type="button" onClick={onClose} style={buttonStyle}>
          Cerrar
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
