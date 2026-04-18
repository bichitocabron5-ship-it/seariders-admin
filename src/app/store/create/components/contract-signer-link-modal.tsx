"use client";

import QRCode from "react-qr-code";

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

export function ContractSignerLinkModal({
  url,
  expiresInMinutes,
  recipientName,
  phone,
  country,
  unitLabel,
  onClose,
}: {
  url: string;
  expiresInMinutes: number;
  recipientName: string;
  phone?: string | null;
  country?: string | null;
  unitLabel: string;
  onClose: () => void;
}) {
  const whatsappPhone = normalizePhoneForWhatsApp(phone ?? "", country);
  const whatsappMessage =
    `Hola ${recipientName || "cliente"},\n\n` +
    `Le enviamos el enlace seguro para revisar y firmar su contrato de reserva con Seariders (${unitLabel}).\n\n` +
    `${url}\n\n` +
    `Cuando la firma quede registrada, podremos continuar con la formalizacion y el cobro de su reserva.\n\n` +
    `Este enlace caduca en ${expiresInMinutes} minutos.\n\n` +
    `Gracias.`;
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
            Firma en tablet
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>Escanea este QR desde el movil o tablet</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            El enlace de firma caduca en {expiresInMinutes} minutos.
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
          Enlace de firma
          <input
            readOnly
            value={url}
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
          Mensaje para WhatsApp
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
            border: whatsappUrl ? "1px solid #bbf7d0" : "1px solid #fde68a",
            background: whatsappUrl ? "#f0fdf4" : "#fffbeb",
            color: whatsappUrl ? "#166534" : "#92400e",
            fontSize: 13,
          }}
        >
          {whatsappUrl
            ? `WhatsApp listo para ${phone || "el cliente"}.`
            : "No hay un telefono valido para abrir WhatsApp automaticamente. Puedes copiar el mensaje y enviarlo manualmente."}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(url)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Copiar enlace
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
            Copiar mensaje
          </button>
          <button
            type="button"
            onClick={() => {
              if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
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
            Enviar WhatsApp
          </button>
          <button
            type="button"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
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
            Abrir firma
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
          Cerrar
        </button>
      </div>
    </div>
  );
}
