// src/lib/tz-business.ts
export const BUSINESS_TZ = process.env.BUSINESS_TZ || "Europe/Madrid";

export function todayYmdInTz(tz = BUSINESS_TZ, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function tzOffsetMinutes(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(date);

  const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;

  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] || 0);
  const mm = Number(m[3] || 0);
  return sign * (hh * 60 + mm);
}

// Interpreta “reloj local en tz” y devuelve Date UTC real (robusto con DST)
export function tzLocalToUtcDate(
  tz: string,
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0
) {
  let t = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  for (let i = 0; i < 2; i++) {
    const off = tzOffsetMinutes(tz, new Date(t));
    t = Date.UTC(y, m - 1, d, hh, mm, 0, 0) - off * 60_000;
  }
  return new Date(t);
}

export function utcDateFromYmdInTz(tz: string, ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return tzLocalToUtcDate(tz, y, m, d, 0, 0);
}

export function utcDateTimeFromYmdHmInTz(tz: string, ymd: string, hm?: string | null): Date | null {
  if (!hm) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map(Number);
  return tzLocalToUtcDate(tz, y, m, d, hh, mm);
}

// Rango del día de negocio (Madrid) en UTC: [start, endExclusive)
export function tzDayRangeUtc(tz: string, nowUtc = new Date()): { start: Date; endExclusive: Date } {
  const ymd = todayYmdInTz(tz, nowUtc);
  const start = utcDateFromYmdInTz(tz, ymd);

  const [y, m, d] = ymd.split("-").map(Number);
  const endExclusive = tzLocalToUtcDate(tz, y, m, d + 1, 0, 0);

  return { start, endExclusive };
}

export function shouldAutoFormalize(params: {
  date: string;          // YYYY-MM-DD (Madrid)
  time: string | null;   // HH:mm o null
  nowUtc?: Date;         // para tests
  marginMinutes?: number; // default 5
  tz?: string;
}) {
  const {
    date,
    time,
    nowUtc = new Date(),
    marginMinutes = 5,
    tz = BUSINESS_TZ,
  } = params;

  const isToday = date === todayYmdInTz(tz, nowUtc);
  if (!isToday) return false;

  if (!time) return true; // hoy sin hora => operativa inmediata

  const scheduledUtc = utcDateTimeFromYmdHmInTz(tz, date, time);
  if (!scheduledUtc) return false;

  const thresholdUtc = new Date(nowUtc.getTime() + marginMinutes * 60_000);
  return scheduledUtc.getTime() <= thresholdUtc.getTime();
}
