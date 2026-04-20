import { prisma } from "@/lib/prisma";
import { createPassPortalToken } from "@/lib/passes/public-pass-link";
import { dispatchWhatsappMessage, normalizePhoneForWhatsApp } from "@/lib/notifications/whatsapp";

type PassConsumeNotificationArgs = {
  voucherId: string;
  consumeId: string;
  code: string;
  minutesTotal: number;
  minutesUsed: number;
  minutesRemaining: number;
  buyerName: string | null;
  buyerPhone: string | null;
  customerCountry: string | null;
};

function resolvePublicBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("Falta NEXT_PUBLIC_APP_URL para generar enlaces publicos");
  return configured.replace(/\/+$/, "");
}

function previewMessage(text: string, max = 280) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function buildPassConsumptionMessage(args: {
  recipientName: string;
  code: string;
  minutesTotal: number;
  minutesUsed: number;
  minutesRemaining: number;
  portalUrl: string;
}) {
  const consumed = Math.max(0, Number(args.minutesTotal) - Number(args.minutesRemaining));
  return [
    `Hola ${args.recipientName}, tu bono ${args.code} ha registrado un consumo.`,
    `Contratadas: ${args.minutesTotal} min`,
    `Gastadas acumuladas: ${consumed} min`,
    `Gastadas en este uso: ${args.minutesUsed} min`,
    `Pendientes: ${args.minutesRemaining} min`,
    `Detalle e historial: ${args.portalUrl}`,
  ].join("\n");
}

function getTemplateConfig() {
  const templateName =
    process.env.WHATSAPP_PASS_TEMPLATE_NAME?.trim() ||
    process.env.WHATSAPP_TEMPLATE_NAME?.trim();
  const languageCode =
    process.env.WHATSAPP_PASS_TEMPLATE_LANGUAGE_CODE?.trim() ||
    process.env.WHATSAPP_TEMPLATE_LANGUAGE_CODE?.trim() ||
    "es";
  return templateName ? { templateName, languageCode } : null;
}

export async function sendPassConsumptionWhatsapp(args: PassConsumeNotificationArgs) {
  let portalUrl: string | null = null;
  try {
    const token = createPassPortalToken({ voucherId: args.voucherId });
    portalUrl = `${resolvePublicBaseUrl()}/passes/${encodeURIComponent(token)}`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo generar el portal del bono";
    await prisma.passNotification.create({
      data: {
        voucherId: args.voucherId,
        consumeId: args.consumeId,
        channel: "WHATSAPP",
        provider: String(process.env.WHATSAPP_PROVIDER ?? "NONE").trim().toUpperCase() || "NONE",
        status: "FAILED",
        recipientName: args.buyerName?.trim() || "cliente",
        recipientPhone: normalizePhoneForWhatsApp(args.buyerPhone, args.customerCountry),
        errorMessage: message,
      },
    });
    return { ok: false as const, status: "FAILED", error: message };
  }

  const recipientName = args.buyerName?.trim() || "cliente";
  const recipientPhone = normalizePhoneForWhatsApp(args.buyerPhone, args.customerCountry);
  const templateConfig = getTemplateConfig();
  const message = buildPassConsumptionMessage({
    recipientName,
    code: args.code,
    minutesTotal: args.minutesTotal,
    minutesUsed: args.minutesUsed,
    minutesRemaining: args.minutesRemaining,
    portalUrl,
  });

  const notification = await prisma.passNotification.create({
    data: {
      voucherId: args.voucherId,
      consumeId: args.consumeId,
      channel: "WHATSAPP",
      provider: String(process.env.WHATSAPP_PROVIDER ?? "NONE").trim().toUpperCase() || "NONE",
      status: recipientPhone ? "PENDING" : "SKIPPED",
      recipientName,
      recipientPhone,
      messagePreview: previewMessage(message),
      portalUrl: portalUrl,
      errorMessage: recipientPhone ? null : "Telefono no valido o ausente para WhatsApp",
    },
    select: { id: true },
  });

  if (!recipientPhone) {
    return { ok: false as const, status: "SKIPPED", portalUrl, error: "Telefono no valido o ausente para WhatsApp" };
  }

  const dispatched = await dispatchWhatsappMessage({
    ...(templateConfig
      ? {
          kind: "template" as const,
          to: recipientPhone,
          templateName: templateConfig.templateName,
          languageCode: templateConfig.languageCode,
          bodyParams: [
            recipientName,
            args.code,
            String(args.minutesTotal),
            String(Math.max(0, Number(args.minutesTotal) - Number(args.minutesRemaining))),
            String(args.minutesUsed),
            String(args.minutesRemaining),
            portalUrl,
          ],
        }
      : {
          kind: "text" as const,
          to: recipientPhone,
          body: message,
        }),
  });

  if (dispatched.ok) {
    await prisma.passNotification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        provider: dispatched.provider,
        providerMessageId: dispatched.providerMessageId ?? null,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
    return { ok: true as const, status: "SENT", portalUrl, provider: dispatched.provider };
  }

  await prisma.passNotification.update({
    where: { id: notification.id },
    data: {
      status: "FAILED",
      provider: dispatched.provider,
      errorMessage: dispatched.error,
    },
  });

  return { ok: false as const, status: "FAILED", portalUrl, error: dispatched.error, provider: dispatched.provider };
}
