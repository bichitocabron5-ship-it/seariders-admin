import { randomUUID, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

export type PublicApiErrorCode =
  | "INVALID_INPUT"
  | "NO_PRICE"
  | "NO_AVAILABILITY"
  | "PROMO_INVALID"
  | "UNAUTHORIZED"
  | "RATE_LIMITED";

export class PublicApiError extends Error {
  code: PublicApiErrorCode;
  status: number;
  details?: unknown;

  constructor(code: PublicApiErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.name = "PublicApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getRequestId(req: Request) {
  const candidate = String(req.headers.get("x-request-id") ?? "").trim();
  if (candidate.length >= 8 && candidate.length <= 120) {
    return candidate;
  }
  return randomUUID();
}

export function publicApiJson<T extends Record<string, unknown>>(args: {
  requestId: string;
  payload: T;
  status?: number;
  headers?: HeadersInit;
}) {
  const headers = new Headers(args.headers);
  headers.set("x-request-id", args.requestId);
  return NextResponse.json(
    {
      requestId: args.requestId,
      ...args.payload,
    },
    {
      status: args.status ?? 200,
      headers,
    }
  );
}

export function publicApiErrorResponse(args: {
  requestId: string;
  code: PublicApiErrorCode;
  status: number;
  message: string;
  details?: unknown;
}) {
  return publicApiJson({
    requestId: args.requestId,
    status: args.status,
    payload: {
      ok: false,
      error: {
        code: args.code,
        message: args.message,
        ...(args.details === undefined ? {} : { details: args.details }),
      },
    },
  });
}

function safeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function requirePublicApiAuth(req: Request) {
  const configuredToken = String(process.env.PUBLIC_API_BEARER_TOKEN ?? "").trim();
  const configuredClientId = String(process.env.PUBLIC_API_CLIENT_ID ?? "").trim();

  if (!configuredToken) {
    return {
      ok: true as const,
      enforced: false,
      clientId: String(req.headers.get("x-api-client") ?? "").trim() || null,
    };
  }

  const authorization = String(req.headers.get("authorization") ?? "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = String(match?.[1] ?? "").trim();
  const clientId = String(req.headers.get("x-api-client") ?? "").trim() || null;

  if (!token || !safeEqualText(token, configuredToken)) {
    return { ok: false as const };
  }

  if (configuredClientId && clientId !== configuredClientId) {
    return { ok: false as const };
  }

  return {
    ok: true as const,
    enforced: true,
    clientId,
  };
}
