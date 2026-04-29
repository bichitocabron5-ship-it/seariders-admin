// src/app/bar/services/bar.ts
export type BarMethod = "CASH" | "CARD" | "BIZUM" | "TRANSFER";

export async function createBarPayment(args: {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  amountCents: number;
  method?: BarMethod | null;
  date: string;
  shift: "MORNING" | "AFTERNOON";
  label: string;
  staffMode?: boolean;
  staffEmployeeId?: string | null;
  deferStaffPayment?: boolean;
  note?: string | null;
  manualDiscountCents?: number;
  manualDiscountReason?: string | null;
}) {
  const res = await fetch("/api/bar/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getBarCashSummary(args: {
  date: string;
  shift: "MORNING" | "AFTERNOON";
}) {
  const res = await fetch(
    `/api/store/cash-closures/summary?origin=BAR&shift=${args.shift}&date=${args.date}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getBarStaffOptions() {
  const res = await fetch("/api/bar/staff-options", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    ok: true;
    rows: Array<{
      id: string;
      fullName: string;
      code: string | null;
      kind: string;
      jobTitle: string | null;
    }>;
  };
}

export async function getPendingBarStaffSales() {
  const res = await fetch("/api/bar/staff-sales/pending", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    ok: true;
    rows: Array<{
      id: string;
      soldAt: string;
      totalRevenueCents: number;
      note: string | null;
      employee: { id: string; fullName: string; code: string | null } | null;
      employeeName: string;
      soldByUser: { id: string; fullName: string | null; username: string | null } | null;
      items: Array<{
        id: string;
        productName: string;
        quantity: number;
        revenueCents: number;
      }>;
    }>;
  };
}

export async function settlePendingBarStaffSale(args: {
  saleId: string;
  method: BarMethod;
  date: string;
  shift: "MORNING" | "AFTERNOON";
}) {
  const res = await fetch(`/api/bar/staff-sales/${args.saleId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: args.method,
      date: args.date,
      shift: args.shift,
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getBarShiftSessions(args: {
  date: string;
  shift: "MORNING" | "AFTERNOON";
}) {
  const res = await fetch(
    `/api/cash-closures/shift-sessions?origin=BAR&shift=${args.shift}&date=${args.date}`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export type BarCategoryWithProducts = {
  id: string;
  name: string;
  sortOrder: number;
  products: Array<{
    id: string;
    name: string;
    type: "DRINK" | "FOOD" | "SNACK" | "MERCH" | "ICE" | "OTHER";
    salePriceCents: number;
    vatRate: string | number;
    controlsStock: boolean;
    currentStock: string | number;
    minStock: string | number;
    unitLabel: string | null;
    staffEligible: boolean;
    staffPriceCents: number | null;
  promotions: Array<{
    id: string;
    type: "FIXED_TOTAL_FOR_QTY" | "BUY_X_PAY_Y";
    exactQty: number | null;
    fixedTotalCents: number | null;
    buyQty: number | null;
    payQty: number | null;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>;
}>;
};

export async function getBarProducts() {
  const res = await fetch("/api/bar/products", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json() as {
    ok: true;
    rows: BarCategoryWithProducts[];
  };
}

export type PendingTask = {
  id: string;
  kind: "CATERING" | "EXTRA";
  reservationLabel: string;
  customerName: string;
  time: string | null;
  paid: boolean;
  paidAmountCents: number;
  items: Array<{
    id: string;
    kind: string;
    name: string;
    quantity: number;
    barProductId?: string | null;
  }>;
};

export async function getPendingBarFulfillmentTasks() {
  const res = await fetch("/api/bar/fulfillment/pending", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ok: true; rows: PendingTask[] };
}

export async function deliverBarFulfillmentTask(args: {
  taskId: string;
  assignments?: Array<{ taskItemId: string; rentalAssetId: string }>;
}) {
  const res = await fetch(`/api/bar/fulfillment/${args.taskId}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assignments: args.assignments ?? [],
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function getBarReturnFulfillmentTasks() {
  const res = await fetch("/api/bar/fulfillment/returns", {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ok: true; rows: PendingTask[] };
}

export async function returnBarFulfillmentTask(taskId: string) {
  const res = await fetch(`/api/bar/fulfillment/${taskId}/return`, {
    method: "POST",
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function reportBarFulfillmentIncident(taskId: string, note: string) {
  const res = await fetch(`/api/bar/fulfillment/${taskId}/incident`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export type AvailableAssetOption = {
  id: string;
  type: "GOPRO" | "WETSUIT" | "OTHER";
  name: string;
  code: string | null;
  size: string | null;
  status: string;
};

export type AvailableAssetsByTaskItem = {
  taskItemId: string;
  itemName: string;
  quantity: number;
  assets: AvailableAssetOption[];
};

export async function getAvailableAssetsForTask(taskId: string) {
  const res = await fetch(`/api/bar/fulfillment/${taskId}/available-assets`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as {
    ok: true;
    rows: AvailableAssetsByTaskItem[];
  };
}

export type BarRentalAsset = {
  id: string;
  type: "GOPRO" | "WETSUIT" | "OTHER";
  name: string;
  code: string | null;
  size: string | null;
  status: "AVAILABLE" | "DELIVERED" | "MAINTENANCE" | "DAMAGED" | "LOST" | "INACTIVE";
  notes?: string | null;
  assignments?: Array<{
    task: {
      id: string;
      reservation: {
        id: string;
        customerName: string | null;
      } | null;
    };
    assignedAt: string;
  }>;
};

export async function getBarRentalAssets(args?: {
  type?: "GOPRO" | "WETSUIT" | "OTHER";
  status?: "AVAILABLE" | "DELIVERED" | "MAINTENANCE" | "DAMAGED" | "LOST" | "INACTIVE";
}) {
  const qs = new URLSearchParams();
  if (args?.type) qs.set("type", args.type);
  if (args?.status) qs.set("status", args.status);

  const res = await fetch(`/api/bar/assets${qs.toString() ? `?${qs.toString()}` : ""}`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ok: true; rows: BarRentalAsset[] };
}

export async function createRentalAssetIncident(args: {
  rentalAssetId: string;
  type: "DAMAGED" | "MAINTENANCE" | "LOST" | "OTHER";
  note?: string | null;
}) {
  const res = await fetch("/api/bar/assets/incidents/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function reactivateRentalAsset(args: {
  rentalAssetId: string;
  note?: string | null;
}) {
  const res = await fetch("/api/bar/assets/reactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
