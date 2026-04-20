import crypto from "node:crypto";

function toSafeBuffer(value: string) {
  return Buffer.from(String(value ?? ""), "utf8");
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null | undefined) {
  const appSecret = process.env.META_WEBHOOK_APP_SECRET?.trim();
  if (!appSecret) return true;

  const signature = String(signatureHeader ?? "").trim();
  if (!signature.startsWith("sha256=")) return false;

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const left = toSafeBuffer(signature);
  const right = toSafeBuffer(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyMetaWebhookChallenge(params: URLSearchParams) {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode !== "subscribe" || !challenge) return null;
  if (!expectedToken || token !== expectedToken) return null;

  return challenge;
}
