import assert from "node:assert/strict";
import test from "node:test";

import { buildPrecheckinWhatsAppShare } from "./precheckin-whatsapp";
import type { PublicLanguage } from "./i18n";

function assertWhatsappTextMatchesMessage(whatsappUrl: string | null, message: string) {
  assert.ok(whatsappUrl);
  const parsed = new URL(whatsappUrl);
  assert.equal(parsed.hostname, "wa.me");
  assert.equal(parsed.searchParams.get("text"), message);
}

function buildShare(language: PublicLanguage) {
  return buildPrecheckinWhatsAppShare({
    url: "https://example.test/checkin/token",
    language,
    recipientName: "Claire",
    contractsCount: 2,
    expiresInMinutes: 2880,
    phone: "06 12 34 56 78",
    country: "FR",
  });
}

test("precheckin WhatsApp ES uses Spanish copy and lang=es", () => {
  const share = buildShare("es");

  assert.equal(share.localizedUrl, "https://example.test/checkin/token?lang=es");
  assert.match(share.whatsappMessage, /^Hola Claire/);
  assert.match(share.whatsappMessage, /lang=es/);
  assert.doesNotMatch(share.whatsappMessage, /^Hello Claire/);
  assert.doesNotMatch(share.whatsappMessage, /^Bonjour Claire/);
  assertWhatsappTextMatchesMessage(share.whatsappUrl, share.whatsappMessage);
});

test("precheckin WhatsApp EN uses English copy and lang=en", () => {
  const share = buildShare("en");

  assert.equal(share.localizedUrl, "https://example.test/checkin/token?lang=en");
  assert.match(share.whatsappMessage, /^Hello Claire/);
  assert.match(share.whatsappMessage, /lang=en/);
  assert.doesNotMatch(share.whatsappMessage, /^Hola Claire/);
  assert.doesNotMatch(share.whatsappMessage, /^Bonjour Claire/);
  assertWhatsappTextMatchesMessage(share.whatsappUrl, share.whatsappMessage);
});

test("precheckin WhatsApp FR uses selected French copy even when country would default differently", () => {
  const share = buildPrecheckinWhatsAppShare({
    url: "https://example.test/checkin/token",
    language: "fr",
    recipientName: "Claire",
    contractsCount: 2,
    expiresInMinutes: 2880,
    phone: "+44 7123 456789",
    country: "GB",
  });

  assert.equal(share.localizedUrl, "https://example.test/checkin/token?lang=fr");
  assert.match(share.whatsappMessage, /^Bonjour Claire/);
  assert.match(share.whatsappMessage, /lang=fr/);
  assert.doesNotMatch(share.whatsappMessage, /^Hello Claire/);
  assert.doesNotMatch(share.whatsappMessage, /^Hola Claire/);
  assertWhatsappTextMatchesMessage(share.whatsappUrl, share.whatsappMessage);
});

test("precheckin WhatsApp replaces an existing link language with lang=fr", () => {
  const share = buildPrecheckinWhatsAppShare({
    url: "https://example.test/checkin/token?lang=en&utm=preview",
    language: "fr",
    recipientName: "Claire",
    contractsCount: 1,
    expiresInMinutes: 60,
    phone: "06 12 34 56 78",
    country: "FR",
  });

  assert.equal(share.localizedUrl, "https://example.test/checkin/token?lang=fr&utm=preview");
  assert.match(share.whatsappMessage, /https:\/\/example\.test\/checkin\/token\?lang=fr&utm=preview/);
  assertWhatsappTextMatchesMessage(share.whatsappUrl, share.whatsappMessage);
});
