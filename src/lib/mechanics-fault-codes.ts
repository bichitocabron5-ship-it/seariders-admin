export function parseFaultCodes(value: string | null | undefined): string[] {
  if (!value) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of value.split(/[\n,;]+/)) {
    const code = raw.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }

  return out;
}

export function formatFaultCodes(codes: readonly string[]): string | null {
  const normalized = parseFaultCodes(codes.join(", "));
  return normalized.length ? normalized.join(", ") : null;
}

export function addFaultCode(
  codes: readonly string[],
  nextCode: string | null | undefined
): string[] {
  return parseFaultCodes([...codes, nextCode ?? ""].join(", "));
}
