import { normalizePhoneForWhatsApp } from "@/lib/phone-normalization";
import { appendPublicLanguage, getPublicCopy, type PublicLanguage } from "./i18n";

export type PrecheckinWhatsAppShare = {
  language: PublicLanguage;
  localizedUrl: string;
  whatsappMessage: string;
  whatsappPhone: string | null;
  whatsappUrl: string | null;
};

export function formatPublicLinkExpiry(expiresInMinutes: number, language: PublicLanguage) {
  if (expiresInMinutes >= 1440) {
    const days = Math.round(expiresInMinutes / 1440);
    if (language === "en") return `${days} day${days === 1 ? "" : "s"}`;
    if (language === "fr") return `${days} jour${days === 1 ? "" : "s"}`;
    return `${days} dia${days === 1 ? "" : "s"}`;
  }

  if (language === "en") return `${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}`;
  if (language === "fr") return `${expiresInMinutes} minute${expiresInMinutes === 1 ? "" : "s"}`;
  return `${expiresInMinutes} minuto${expiresInMinutes === 1 ? "" : "s"}`;
}

export function buildPrecheckinWhatsAppShare(args: {
  url: string;
  language: PublicLanguage;
  recipientName: string;
  contractsCount: number;
  expiresInMinutes: number;
  phone?: string | null;
  country?: string | null;
}): PrecheckinWhatsAppShare {
  const copy = getPublicCopy(args.language);
  const localizedUrl = appendPublicLanguage(args.url, args.language);
  const whatsappPhone = normalizePhoneForWhatsApp(args.phone ?? "", args.country);
  const expiryLabel = formatPublicLinkExpiry(args.expiresInMinutes, args.language);
  const whatsappMessage = copy.precheckinModal.buildMessage({
    recipientName: args.recipientName,
    contractsCount: args.contractsCount,
    url: localizedUrl,
    expiryLabel,
  });

  return {
    language: args.language,
    localizedUrl,
    whatsappMessage,
    whatsappPhone,
    whatsappUrl: whatsappPhone
      ? `https://wa.me/${encodeURIComponent(whatsappPhone)}?text=${encodeURIComponent(whatsappMessage)}`
      : null,
  };
}
