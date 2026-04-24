import crypto from "node:crypto";

export const DEFAULT_CONTRACT_SIGNATURE_LINK_TTL_MINUTES = 45;

type SignatureLinkPayload = {
  contractId: string;
  exp: number;
};

function getSecret() {
  return process.env.CONTRACT_SIGNATURE_LINK_SECRET || "";
}

function getDefaultTtlMinutes() {
  const raw = Number(process.env.CONTRACT_SIGNATURE_LINK_TTL_MINUTES ?? "");
  return Number.isFinite(raw) && raw > 0
    ? Math.floor(raw)
    : DEFAULT_CONTRACT_SIGNATURE_LINK_TTL_MINUTES;
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
  if (!secret) throw new Error("Falta secreto para enlaces de firma");
  return toBase64Url(crypto.createHmac("sha256", secret).update(segment).digest());
}

export function createContractSignatureToken(args: { contractId: string; expiresInMinutes?: number }) {
  const payload: SignatureLinkPayload = {
    contractId: args.contractId,
    exp: Date.now() + (args.expiresInMinutes ?? getDefaultTtlMinutes()) * 60_000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSegment(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyContractSignatureToken(token: string): SignatureLinkPayload | null {
  const [encodedPayload, signature] = String(token ?? "").split(".");
  if (!encodedPayload || !signature) return null;

  const expected = signSegment(encodedPayload);
  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SignatureLinkPayload;
    if (!payload.contractId || !payload.exp) return null;
    if (Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}
