export function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function isAbortError(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}

export async function ensureOkResponse(res: Response, fallbackMessage: string) {
  if (res.ok) return;
  const detail = (await res.text()).trim();
  const err = new Error(detail || fallbackMessage);
  err.name = "ApiError";
  throw err;
}

export function throwValidationError(message: string): never {
  const err = new Error(message);
  err.name = "ValidationError";
  throw err;
}
