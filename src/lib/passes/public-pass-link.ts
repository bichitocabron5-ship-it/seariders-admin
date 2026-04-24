import crypto from "node:crypto";

export const DEFAULT_PASS_PORTAL_LINK_TTL_MINUTES = 60 * 24 * 7;

type PassPortalPayload = {
  voucherId: string;
  exp: number;
};

function getSecret() {
  return process.env.PASS_PORTAL_LINK_SECRET || "";
}

function getDefaultTtlMinutes() {
  const raw = Number(process.env.PASS_PORTAL_LINK_TTL_MINUTES ?? "");
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_PASS_PORTAL_LINK_TTL_MINUTES;
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signSegment(segment: string) {
  const secret = getSecret();
  if (!secret) throw new Error("Falta secreto para el portal publico de bonos");
  return toBase64Url(crypto.createHmac("sha256", secret).update(segment).digest());
}

export function createPassPortalToken(args: { voucherId: string; expiresInMinutes?: number }) {
  const payload: PassPortalPayload = {
    voucherId: args.voucherId,
    exp: Date.now() + (args.expiresInMinutes ?? getDefaultTtlMinutes()) * 60_000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSegment(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyPassPortalToken(token: string): PassPortalPayload | null {
  const [encodedPayload, signature] = String(token ?? "").split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signSegment(encodedPayload);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as PassPortalPayload;
    if (!payload.voucherId || !payload.exp) return null;
    if (Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}
