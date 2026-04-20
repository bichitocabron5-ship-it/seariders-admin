import { prisma } from "@/lib/prisma";
import { createContractSignatureToken } from "@/lib/contracts/signature-link";
import { dispatchWhatsappMessage, normalizePhoneForWhatsApp } from "@/lib/notifications/whatsapp";
import { appendPublicLanguage, getDefaultPublicLanguage, getPublicCopy } from "@/lib/public-links/i18n";

function resolvePublicBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("Falta NEXT_PUBLIC_APP_URL para generar enlaces publicos");
  return configured.replace(/\/+$/, "");
}

function formatLinkExpiry(expiresInMinutes: number) {
  if (expiresInMinutes >= 1440) {
    const days = Math.round(expiresInMinutes / 1440);
    return `${days} dia${days === 1 ? "" : "s"}`;
  }

  return `${expiresInMinutes} minuto${expiresInMinutes === 1 ? "" : "s"}`;
}

function previewMessage(text: string, max = 280) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function getContractTemplateConfig() {
  const templateName =
    process.env.WHATSAPP_CONTRACT_TEMPLATE_NAME?.trim() ||
    process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
    "";
  const languageCode =
    process.env.WHATSAPP_CONTRACT_TEMPLATE_LANGUAGE_CODE?.trim() ||
    process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE?.trim() ||
    "es";

  return templateName ? { templateName, languageCode } : null;
}

export async function sendContractSignerWhatsapp(args: {
  contractId: string;
  unitLabel: string;
  recipientName: string;
  phone: string | null;
  country: string | null;
  expiresInMinutes: number;
}) {
  const token = createContractSignatureToken({ contractId: args.contractId, expiresInMinutes: args.expiresInMinutes });
  const baseUrl = resolvePublicBaseUrl();
  const rawUrl = `${baseUrl}/sign/contracts/${encodeURIComponent(token)}`;
  const language = getDefaultPublicLanguage(args.country);
  const localizedUrl = appendPublicLanguage(rawUrl, language);
  const expiryLabel = formatLinkExpiry(args.expiresInMinutes);
  const copy = getPublicCopy(language);
  const message = copy.signerModal.buildMessage({
    recipientName: args.recipientName,
    unitLabel: args.unitLabel,
    url: localizedUrl,
    expiryLabel,
  });
  const recipientPhone = normalizePhoneForWhatsApp(args.phone, args.country);

  const notification = await prisma.contractNotification.create({
    data: {
      contractId: args.contractId,
      channel: "WHATSAPP",
      provider: String(process.env.WHATSAPP_PROVIDER ?? "NONE").trim().toUpperCase() || "NONE",
      status: recipientPhone ? "PENDING" : "SKIPPED",
      recipientName: args.recipientName,
      recipientPhone,
      messagePreview: previewMessage(message),
      linkUrl: localizedUrl,
      errorMessage: recipientPhone ? null : "Telefono no valido o ausente para WhatsApp",
    },
    select: { id: true },
  });

  if (!recipientPhone) {
    return {
      ok: false as const,
      status: "SKIPPED",
      url: rawUrl,
      localizedUrl,
      message,
      error: "Telefono no valido o ausente para WhatsApp",
    };
  }

  const templateConfig = getContractTemplateConfig();
  const dispatched = await dispatchWhatsappMessage(
    templateConfig
      ? {
          kind: "template",
          to: recipientPhone,
          templateName: templateConfig.templateName,
          languageCode: templateConfig.languageCode,
          bodyParams: [args.recipientName, args.unitLabel, localizedUrl, expiryLabel],
        }
      : {
          kind: "text",
          to: recipientPhone,
          body: message,
        }
  );

  if (dispatched.ok) {
    await prisma.contractNotification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        provider: dispatched.provider,
        providerMessageId: dispatched.providerMessageId ?? null,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    return {
      ok: true as const,
      status: "SENT",
      provider: dispatched.provider,
      url: rawUrl,
      localizedUrl,
      message,
    };
  }

  await prisma.contractNotification.update({
    where: { id: notification.id },
    data: {
      status: "FAILED",
      provider: dispatched.provider,
      errorMessage: dispatched.error,
    },
  });

  return {
    ok: false as const,
    status: "FAILED",
    provider: dispatched.provider,
    url: rawUrl,
    localizedUrl,
    message,
    error: dispatched.error,
  };
}
