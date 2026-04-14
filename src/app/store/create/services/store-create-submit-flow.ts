import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { ensureOkResponse, throwValidationError } from "../utils/errors";
import { buildCreateBody, buildEditUpdateBody, buildFormalizeBody, buildItemsToSend } from "./store-create-submit";
import { validateBeforeSubmit, validateItemsForCreate } from "./store-create-validation";

type SharedArgs = {
  customerName: string;
  quantity: number;
  pax: number;
  isVoucherFormalizeFlow: boolean;
  serviceId: string;
  optionId: string;
  channelId: string;
  cartItemsLength: number;
  canCreate: boolean;
  uiMode: "CREATE" | "FORMALIZE" | "EDIT";
  dateStr: string;
  todayYmd: string;
};

type SubmitCartItem = {
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  promoCode?: string | null;
};

export async function submitStoreCreateEditFlow(args: SharedArgs & {
  editReservationId: string;
  isLicense: boolean;
  timeStr: string;
  companions: number;
  cartItems: SubmitCartItem[];
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerPostalCode: string;
  customerBirthDate: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
  promoCode?: string | null;
  router: AppRouterInstance;
}) {
  validateBeforeSubmit({
    flow: "EDIT",
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    quantity: args.quantity,
    pax: args.pax,
    isVoucherFormalizeFlow: args.isVoucherFormalizeFlow,
    serviceId: args.serviceId,
    optionId: args.optionId,
    channelId: args.channelId,
    cartItemsLength: args.cartItemsLength,
    canCreate: args.canCreate,
    uiMode: args.uiMode,
    dateStr: args.dateStr,
    todayYmd: args.todayYmd,
  });

  const body = buildEditUpdateBody({
    pax: args.pax,
    isLicense: Boolean(args.isLicense),
    channelId: args.channelId,
    dateStr: args.dateStr,
    timeStr: args.timeStr,
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: args.quantity,
    companions: args.companions,
    cartItems: args.cartItems,
    singlePromoCode: args.promoCode ?? null,
    customerPhone: args.customerPhone,
    customerEmail: args.customerEmail,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerPostalCode: args.customerPostalCode,
    customerBirthDate: args.customerBirthDate,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    marketingSource: args.marketingSource,
    licenseSchool: args.licenseSchool,
    licenseType: args.licenseType,
    licenseNumber: args.licenseNumber,
  });

  const res = await fetch(`/api/store/reservations/${args.editReservationId}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  await ensureOkResponse(res, "No se pudo actualizar la reserva");
  const j = await res.json();
  if (Number(j.requiredUnits ?? 0) > Number(j.readyCount ?? 0)) {
    args.router.push(`/store/create?editFrom=${j.id}#contracts`);
    return;
  }
  args.router.push(`/store?reservationId=${j.id}`);
}

export async function submitStoreCreateMigrateFlow(args: SharedArgs & {
  migrateReservationId: string;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  companions: number;
  timeStr: string;
  router: AppRouterInstance;
}) {
  validateBeforeSubmit({
    flow: "MIGRATE",
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    quantity: args.quantity,
    pax: args.pax,
    isVoucherFormalizeFlow: args.isVoucherFormalizeFlow,
    serviceId: args.serviceId,
    optionId: args.optionId,
    channelId: args.channelId,
    cartItemsLength: args.cartItemsLength,
    canCreate: args.canCreate,
    uiMode: args.uiMode,
    dateStr: args.dateStr,
    todayYmd: args.todayYmd,
  });

  const body = buildFormalizeBody({
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerEmail: args.customerEmail,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    marketingSource: args.marketingSource,
    isVoucherFormalizeFlow: args.isVoucherFormalizeFlow,
    serviceId: args.serviceId,
    optionId: args.optionId,
    channelId: args.channelId,
    quantity: args.quantity,
    pax: args.pax,
    companions: args.companions,
    dateStr: args.dateStr,
    timeStr: args.timeStr,
  });

  const res = await fetch(`/api/store/reservations/${args.migrateReservationId}/formalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  await ensureOkResponse(res, "No se pudo formalizar la reserva");
  const j = await res.json();
  args.router.push(`/store?reservationId=${j.id}`);
}

export async function submitStoreCreateCreateFlow(args: SharedArgs & {
  isPackMode: boolean;
  cartItems: SubmitCartItem[];
  timeStr: string;
  customerPhone: string;
  customerEmail: string;
  customerCountry: string;
  customerAddress: string;
  customerPostalCode: string;
  customerBirthDate: string;
  customerDocType: string;
  customerDocNumber: string;
  marketingSource: string;
  isLicense: boolean;
  licenseSchool: string;
  licenseType: string;
  licenseNumber: string;
  companions: number;
  manualDiscountCents: number;
  manualDiscountReason: string;
  promoCode?: string | null;
  router: AppRouterInstance;
}) {
  validateBeforeSubmit({
    flow: "CREATE",
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    quantity: args.quantity,
    pax: args.pax,
    isVoucherFormalizeFlow: args.isVoucherFormalizeFlow,
    serviceId: args.serviceId,
    optionId: args.optionId,
    channelId: args.channelId,
    cartItemsLength: args.cartItemsLength,
    canCreate: args.canCreate,
    uiMode: args.uiMode,
    dateStr: args.dateStr,
    todayYmd: args.todayYmd,
  });

  const time = (args.timeStr ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throwValidationError("Hora requerida (HH:MM)");
  }

  const itemsToSend = buildItemsToSend({
    isPackMode: args.isPackMode,
    cartItems: args.cartItems,
    serviceId: args.serviceId,
    optionId: args.optionId,
    quantity: args.quantity,
    pax: args.pax,
    promoCode: args.promoCode ?? null,
  });

  validateItemsForCreate(itemsToSend);

  const body = buildCreateBody({
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerEmail: args.customerEmail,
    customerCountry: args.customerCountry,
    customerAddress: args.customerAddress,
    customerPostalCode: args.customerPostalCode,
    customerBirthDate: args.customerBirthDate,
    customerDocType: args.customerDocType,
    customerDocNumber: args.customerDocNumber,
    marketingSource: args.marketingSource,
    isLicense: Boolean(args.isLicense),
    licenseSchool: args.licenseSchool,
    licenseType: args.licenseType,
    licenseNumber: args.licenseNumber,
    channelId: args.channelId,
    dateStr: args.dateStr,
    time,
    pax: args.pax,
    companions: args.companions,
    manualDiscountCents: args.manualDiscountCents,
    manualDiscountReason: args.manualDiscountReason,
    itemsToSend,
  });

  const res = await fetch("/api/store/reservations/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  await ensureOkResponse(res, "No se pudo crear la reserva");
  const j = await res.json();

  if (!j.autoFormalized) {
    args.router.push(`/store/create?editFrom=${j.id}#payments`);
    return;
  }
  if (Number(j.requiredContractUnits ?? 0) > 0) {
    args.router.push(`/store/create?migrateFrom=${j.id}#contracts`);
    return;
  }

  args.router.push(`/store?reservationId=${j.id}`);
}
