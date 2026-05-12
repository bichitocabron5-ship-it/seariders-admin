import {
  BUSINESS_TZ,
  todayYmdInTz,
  tzLocalToUtcDate,
  utcDateFromYmdInTz,
} from "./tz-business";

function assertBusinessYmd(ymd: string, tz: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("date inválida: esperado YYYY-MM-DD");
  }

  const start = utcDateFromYmdInTz(tz, ymd);
  if (todayYmdInTz(tz, start) !== ymd) {
    throw new Error("date inválida: esperado YYYY-MM-DD");
  }
}

export function getBusinessDate(input = new Date(), tz = BUSINESS_TZ): string {
  return todayYmdInTz(tz, input);
}

export function getBusinessDayRange(date?: string, tz = BUSINESS_TZ) {
  const businessDate = date ?? getBusinessDate(new Date(), tz);
  assertBusinessYmd(businessDate, tz);

  const start = utcDateFromYmdInTz(tz, businessDate);
  const [year, month, day] = businessDate.split("-").map(Number);
  const endExclusive = tzLocalToUtcDate(tz, year, month, day + 1, 0, 0);

  return {
    date: businessDate,
    start,
    endExclusive,
  };
}
