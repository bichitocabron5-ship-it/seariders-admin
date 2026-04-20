type WhatsappTextInput = {
  kind: "text";
  to: string;
  body: string;
};

type WhatsappTemplateInput = {
  kind: "template";
  to: string;
  templateName: string;
  languageCode: string;
  bodyParams: string[];
};

type WhatsappDispatchInput = WhatsappTextInput | WhatsappTemplateInput;

export type WhatsappDispatchResult =
  | {
      ok: true;
      provider: string;
      providerMessageId?: string | null;
    }
  | {
      ok: false;
      provider: string;
      error: string;
    };

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

export function normalizePhoneForWhatsApp(phone: string | null | undefined, country?: string | null) {
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

async function sendViaWebhook(input: WhatsappDispatchInput): Promise<WhatsappDispatchResult> {
  const url = process.env.WHATSAPP_WEBHOOK_URL?.trim();
  if (!url) return { ok: false, provider: "WEBHOOK", error: "WHATSAPP_WEBHOOK_URL no configurada" };

  const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({
      channel: "whatsapp",
      to: input.to,
      ...(input.kind === "text"
        ? { kind: "text", body: input.body }
        : {
            kind: "template",
            templateName: input.templateName,
            languageCode: input.languageCode,
            bodyParams: input.bodyParams,
          }),
    }),
  });

  if (!res.ok) {
    return { ok: false, provider: "WEBHOOK", error: await res.text() || `Webhook ${res.status}` };
  }

  const json = (await res.json().catch(() => null)) as { id?: string; messageId?: string } | null;
  return { ok: true, provider: "WEBHOOK", providerMessageId: json?.messageId ?? json?.id ?? null };
}

async function sendViaMeta(input: WhatsappDispatchInput): Promise<WhatsappDispatchResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    return { ok: false, provider: "META_CLOUD_API", error: "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID" };
  }

  const body =
    input.kind === "template"
      ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "template",
          template: {
            name: input.templateName,
            language: { code: input.languageCode },
            components: [
              {
                type: "body",
                parameters: input.bodyParams.map((value) => ({
                  type: "text",
                  text: value,
                })),
              },
            ],
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.to,
          type: "text",
          text: {
            preview_url: false,
            body: input.body,
          },
        };

  const res = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | {
        messages?: Array<{ id?: string }>;
        error?: { message?: string };
      }
    | null;

  if (!res.ok) {
    return {
      ok: false,
      provider: "META_CLOUD_API",
      error: json?.error?.message || `Meta ${res.status}`,
    };
  }

  return {
    ok: true,
    provider: "META_CLOUD_API",
    providerMessageId: json?.messages?.[0]?.id ?? null,
  };
}

export async function dispatchWhatsappMessage(input: WhatsappDispatchInput): Promise<WhatsappDispatchResult> {
  const provider = String(process.env.WHATSAPP_PROVIDER ?? "NONE").trim().toUpperCase();

  if (provider === "WEBHOOK") return sendViaWebhook(input);
  if (provider === "META_CLOUD_API") return sendViaMeta(input);

  return { ok: false, provider: provider || "NONE", error: "Proveedor de WhatsApp no configurado" };
}
