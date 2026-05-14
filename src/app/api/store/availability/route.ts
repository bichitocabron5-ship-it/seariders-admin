// src/app/api/store/availability/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import {
  getOperationalCapacityUnits,
  getOperationalDurationMinutes,
} from "@/lib/reservation-operations";
import {
  BUSINESS_TZ,
  utcDateFromYmdInTz,
  utcDateTimeFromYmdHmInTz,
} from "@/lib/tz-business";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "STORE" || session.role === "ADMIN") return session;
  return null;
}

function hmToMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHm(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hhmmInMadridFromUtc(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function GET(req: Request) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const selectedCategory = String(url.searchParams.get("category") ?? "").trim().toUpperCase() || null;
  const selectedDurationMinutes = Number(url.searchParams.get("durationMinutes") ?? 0);
  const selectedQuantity = Number(url.searchParams.get("quantity") ?? 0);
  if (!date || date.length !== 10) {
    return NextResponse.json({ error: "date requerido (YYYY-MM-DD)" }, { status: 400 });
  }

  // 1) SlotPolicy (seed si falta)
  let policy = await prisma.slotPolicy.findFirst();
  if (!policy) {
    policy = await prisma.slotPolicy.create({
      data: {
        intervalMinutes: 30,
        openTime: "09:00",
        closeTime: "20:00",
      },
    });
  }

  const interval = policy.intervalMinutes ?? 30;
  const openTime = policy.openTime ?? "09:00";
  const closeTime = policy.closeTime ?? "20:00";

  // 2) SlotLimit (auto-seed por categorías existentes)
  const serviceCats = await prisma.service.findMany({
    where: { isActive: true },
    select: { category: true },
  });

  const allCats = Array.from(
    new Set(serviceCats.map((s) => String(s.category ?? "").toUpperCase()).filter(Boolean))
  );

  const existingLimits = await prisma.slotLimit.findMany({
    select: { category: true, maxUnits: true },
  });

  const existingSet = new Set(existingLimits.map((r) => String(r.category).toUpperCase()));

  const missing = allCats.filter((c) => !existingSet.has(c));
  if (missing.length > 0) {
    await prisma.slotLimit.createMany({
      data: missing.map((c) => ({
        category: c,
        maxUnits: c === "JETSKI" ? 10 : 1, // defaults iniciales
      })),
      skipDuplicates: true,
    });
  }

  const limitsRows = await prisma.slotLimit.findMany({
    select: { category: true, maxUnits: true },
  });

  const limits: Record<string, number> = {};
  for (const r of limitsRows) limits[String(r.category).toUpperCase()] = r.maxUnits;


  // 3) Generar slots en horario Madrid
  const startMin = hmToMinutes(openTime);
  const endMin = hmToMinutes(closeTime);

  const slotTimes: string[] = [];
  for (let t = startMin; t < endMin; t += interval) slotTimes.push(minutesToHm(t));

  const usedBySlot: Array<Record<string, number>> = slotTimes.map(() => ({}));
  const noTime: Record<string, number> = {};

  // 4) Rango del día en UTC (según Madrid)
  const dayStartUtc = utcDateFromYmdInTz(BUSINESS_TZ, date);
  const nextDate = addDaysYmd(date, 1);
  const dayEndExclusiveUtc =
    utcDateTimeFromYmdHmInTz(BUSINESS_TZ, nextDate, "00:00") ??
    new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  // 5) Items del día (unificado: quick + pack + futuro carrito)
  const items = await prisma.reservationItem.findMany({
    where: {
      isExtra: false, // actividades reales
      reservation: {
        source: "STORE",
        activityDate: { gte: dayStartUtc, lt: dayEndExclusiveUtc },
        status: { not: "CANCELED" },
      },
    },
    select: {
      quantity: true,
      service: { select: { category: true } },
      option: { select: { durationMinutes: true } },
      reservation: { select: { scheduledTime: true } },
    },
  });

  function pushUsage(params: { scheduledTime: Date | null; category: string; qty: number; durMinutes: number }) {
    const category = String(params.category ?? "UNKNOWN").toUpperCase();
    const qty = Math.max(1, Number(params.qty ?? 1));
    const operationalQty = getOperationalCapacityUnits({ category, quantity: qty });

    if (!params.scheduledTime) {
      noTime[category] = (noTime[category] ?? 0) + operationalQty;
      return;
    }

    const hhmm = hhmmInMadridFromUtc(params.scheduledTime);
    const start = hmToMinutes(hhmm);

    const dur = getOperationalDurationMinutes({
      category,
      durationMinutes: params.durMinutes ?? interval,
      quantity: qty,
    });
    const slotsNeeded = Math.max(1, Math.ceil(dur / interval));

    // redondear al slot anterior (floor)
    const startSlotMin = startMin + Math.floor((start - startMin) / interval) * interval;
    const startIdx = Math.floor((startSlotMin - startMin) / interval);

    for (let i = 0; i < slotsNeeded; i++) {
      const idx = startIdx + i;
      if (idx < 0 || idx >= slotTimes.length) continue;
      usedBySlot[idx][category] = (usedBySlot[idx][category] ?? 0) + operationalQty;
    }
  }

  // 6) Contabilizar por slots a partir de ITEMS
  for (const it of items) {
    pushUsage({
      scheduledTime: it.reservation?.scheduledTime ?? null,
      category: it.service?.category ?? "UNKNOWN",
      qty: Number(it.quantity ?? 1),
      durMinutes: Number(it.option?.durationMinutes ?? interval),
    });
  }

  // 7) Construir free + isFull
  const requestedOperationalDuration =
    selectedCategory && selectedDurationMinutes > 0 && selectedQuantity > 0
      ? getOperationalDurationMinutes({
          category: selectedCategory,
          durationMinutes: selectedDurationMinutes,
          quantity: selectedQuantity,
        })
      : null;
  const requestedOperationalUnits =
    selectedCategory && selectedQuantity > 0
      ? getOperationalCapacityUnits({
          category: selectedCategory,
          quantity: selectedQuantity,
        })
      : null;

  const slots = slotTimes.map((time, idx) => {
    const used = usedBySlot[idx];
    const free: Record<string, number> = {};
    const isFull: Record<string, boolean> = {};
    const isSelectable: Record<string, boolean> = {};

    for (const [cat, maxUnits] of Object.entries(limits)) {
      const u = used[cat] ?? 0;
      const f = Math.max(0, maxUnits - u);
      free[cat] = f;
      isFull[cat] = f <= 0;

       if (
        selectedCategory === cat &&
        requestedOperationalDuration !== null &&
        requestedOperationalUnits !== null
      ) {
        const slotsNeeded = Math.max(1, Math.ceil(requestedOperationalDuration / interval));
        const startMinute = startMin + idx * interval;
        const fitsInSchedule = startMinute + slotsNeeded * interval <= endMin;
        let fitsCapacity = fitsInSchedule;

        if (fitsCapacity) {
          for (let step = 0; step < slotsNeeded; step++) {
            const slotUsage = usedBySlot[idx + step]?.[cat] ?? 0;
            if (slotUsage + requestedOperationalUnits > maxUnits) {
              fitsCapacity = false;
              break;
            }
          }
        }

        isSelectable[cat] = fitsCapacity;
      } else {
        isSelectable[cat] = !isFull[cat];
      }
    }

    return { time, used, free, isFull, isSelectable };
  });

  return NextResponse.json({
    ok: true,
    date,
    intervalMinutes: interval,
    openTime,
    closeTime,
    limits,
    slots,
    noTime,
  });
}

