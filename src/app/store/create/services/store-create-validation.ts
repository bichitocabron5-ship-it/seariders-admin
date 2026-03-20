// src/app/store/create/services/store-create-validation.ts
export type SubmitFlow = "EDIT" | "MIGRATE" | "CREATE";
import { throwValidationError } from "../utils/errors";

export function validateBeforeSubmit(args: {
  flow: SubmitFlow;
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
}) {
  const {
    flow,
    customerName,
    quantity,
    pax,
    isVoucherFormalizeFlow,
    serviceId,
    optionId,
    channelId,
    cartItemsLength,
    canCreate,
    uiMode,
    dateStr,
    todayYmd,
  } = args;

  if (!customerName.trim()) throwValidationError("Nombre requerido");
  if (Number(quantity) < 1) throwValidationError("Cantidad inválida");
  if (Number(pax) < 1) throwValidationError("PAX inválido");

  if (flow !== "MIGRATE" || !isVoucherFormalizeFlow) {
    if (!serviceId) throwValidationError("Servicio requerido");
    if (!optionId) throwValidationError("Duración requerida");
  }

  if (flow === "CREATE" && !channelId) throwValidationError("Canal requerido");

  if (flow === "CREATE" && !cartItemsLength && !canCreate) {
    throwValidationError("Este servicio/duración no tiene precio vigente. Revisa Admin > Precios.");
  }

  if (flow === "EDIT" && uiMode === "FORMALIZE" && dateStr !== todayYmd) {
    throwValidationError("Solo puedes formalizar el mismo día.");
  }
}

export function validateItemsForCreate(
  items: Array<{ serviceId: string; optionId: string; quantity: number; pax: number }>
) {
  if (!items.length) throwValidationError("Añade al menos una actividad.");
  for (const it of items) {
    if (!it.serviceId) throwValidationError("Falta servicio en un item.");
    if (!it.optionId) throwValidationError("Falta duración en un item.");
    if (Number(it.quantity) < 1) throwValidationError("Cantidad inválida en un item.");
    if (Number(it.pax) < 1) throwValidationError("PAX inválido en un item.");
  }
}