import { prisma } from "@/lib/prisma";
import { buildConfigurationRequiredError } from "@/lib/slot-config";
import { assertSlotCapacityForItemsOrThrow } from "@/lib/slot-capacity";
import { BUSINESS_TZ, utcDateFromYmdInTz, utcDateTimeFromYmdHmInTz } from "@/lib/tz-business";

function isConfigurationRequiredError(message: string) {
  return message.startsWith("CONFIGURATION_REQUIRED:");
}

export async function checkSlotCapacity(params: {
  date: string;
  time: string;
  category: string;
  quantity: number;
  durationMinutes: number;
}) {
  const scheduledStartUtc = utcDateTimeFromYmdHmInTz(BUSINESS_TZ, params.date, params.time);
  if (!scheduledStartUtc) return false;

  const dayStartUtc = utcDateFromYmdInTz(BUSINESS_TZ, params.date);
  const nextDay = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  try {
    await assertSlotCapacityForItemsOrThrow({
      tx: prisma,
      dateStartUtc: dayStartUtc,
      dateEndExclusiveUtc: nextDay,
      scheduledStartUtc,
      items: [
        {
          category: params.category,
          durationMinutes: params.durationMinutes,
          quantity: params.quantity,
        },
      ],
    });
    return true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (isConfigurationRequiredError(message)) {
      throw buildConfigurationRequiredError(message.replace(/^CONFIGURATION_REQUIRED:\s*/, ""));
    }
    return false;
  }
}
