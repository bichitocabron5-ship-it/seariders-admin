import "dotenv/config";
import { PaymentOrigin, ShiftName } from "@prisma/client";
import { prisma, pgPool } from "../src/lib/prisma";
const DAILY_ORIGINS: PaymentOrigin[] = ["STORE", "BAR"];
const TARGET_SHIFT: ShiftName = "MORNING";

function parseFlags() {
  const flags = new Set(process.argv.slice(2));
  return {
    execute: flags.has("--execute"),
    verbose: flags.has("--verbose"),
  };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function ensureMorningCashShift(origin: PaymentOrigin, date: Date) {
  return prisma.cashShift.upsert({
    where: {
      origin_shift_date: {
        origin,
        shift: TARGET_SHIFT,
        date,
      },
    },
    update: {},
    create: {
      origin,
      shift: TARGET_SHIFT,
      date,
    },
    select: { id: true },
  });
}

async function main() {
  const { execute, verbose } = parseFlags();

  const closures = await prisma.cashClosure.findMany({
    where: {
      origin: { in: DAILY_ORIGINS },
    },
    orderBy: [{ businessDate: "asc" }, { closedAt: "desc" }],
    select: {
      id: true,
      origin: true,
      shift: true,
      businessDate: true,
      closedAt: true,
      isVoided: true,
      cashShiftId: true,
    },
  });

  const grouped = new Map<string, typeof closures>();
  for (const closure of closures) {
    const key = `${closure.origin}__${dayKey(closure.businessDate)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), closure]);
  }

  const actions: string[] = [];

  for (const [key, rows] of grouped) {
    const [origin] = key.split("__") as [PaymentOrigin, string];
    const active = rows.filter((row) => !row.isVoided);
    if (active.length === 0) continue;

    const canonical = [...active].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime())[0];
    const occupiedMorning = rows.find((row) => row.shift === TARGET_SHIFT && row.id !== canonical.id) ?? null;

    if (active.length > 1) {
      for (const duplicate of active.filter((row) => row.id !== canonical.id)) {
        actions.push(`VOID ${duplicate.id} (${origin} ${dayKey(duplicate.businessDate)}) -> canonical ${canonical.id}`);
        if (execute) {
          await prisma.cashClosure.update({
            where: { id: duplicate.id },
            data: {
              isVoided: true,
              voidedAt: new Date(),
              voidReason: `Legacy duplicate normalized into ${canonical.id}`,
            },
          });
        }
      }
    }

    if (canonical.shift !== TARGET_SHIFT) {
      if (occupiedMorning) {
        actions.push(
          `SKIP SHIFT ${canonical.id} (${origin} ${dayKey(canonical.businessDate)}) -> MORNING blocked by ${occupiedMorning.id}`
        );
      } else {
        actions.push(`NORMALIZE ${canonical.id} (${origin} ${dayKey(canonical.businessDate)}) ${canonical.shift} -> MORNING`);
        if (execute) {
          const morningShift = await ensureMorningCashShift(origin, canonical.businessDate);
          await prisma.cashClosure.update({
            where: { id: canonical.id },
            data: {
              shift: TARGET_SHIFT,
              cashShiftId: morningShift.id,
            },
          });
        }
      }
    }
  }

  console.log(execute ? "Repair mode: EXECUTE" : "Repair mode: DRY RUN");
  if (actions.length === 0) {
    console.log("No legacy daily cash closures detected.");
  } else {
    for (const action of actions) console.log(action);
  }

  if (verbose) {
    const activeDaily = await prisma.cashClosure.findMany({
      where: {
        origin: { in: DAILY_ORIGINS },
        isVoided: false,
      },
      orderBy: [{ businessDate: "asc" }, { origin: "asc" }, { closedAt: "desc" }],
      select: {
        id: true,
        origin: true,
        shift: true,
        businessDate: true,
      },
    });

    console.log("Active daily closures after repair preview:");
    for (const row of activeDaily) {
      console.log(`${row.origin} ${dayKey(row.businessDate)} ${row.shift} ${row.id}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pgPool.end();
  });
