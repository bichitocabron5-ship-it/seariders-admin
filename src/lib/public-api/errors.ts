export type PublicApiErrorCode =
  | "CONFIGURATION_REQUIRED"
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
