// src/app/store/create/services/store-create-validation.ts
export type SubmitFlow = "EDIT" | "MIGRATE" | "CREATE";
import { throwValidationError } from "../utils/errors";

export function validateBeforeSubmit(args: {
  flow: SubmitFlow;
  customerName: string;
  customerPhone: string;
  customerCountry: string;
  customerAddress: string;
  customerDocType: string;
  customerDocNumber: string;
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
    customerPhone,
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
  if (!customerPhone.trim()) throwValidationError("Telefono requerido");
  if (Number(quantity) < 1) throwValidationError("Cantidad invalida");
  if (Number(pax) < 1) throwValidationError("PAX invalido");

  if (flow !== "MIGRATE" || !isVoucherFormalizeFlow) {
    if (!serviceId) throwValidationError("Servicio requerido");
    if (!optionId) throwValidationError("Duracion requerida");
  }

  if (flow === "CREATE" && !channelId) throwValidationError("Canal requerido");

  if (flow === "CREATE" && !cartItemsLength && !canCreate) {
    throwValidationError("Este servicio/duracion no tiene precio vigente. Revisa Admin > Precios.");
  }

  if (flow === "EDIT" && uiMode === "FORMALIZE" && dateStr !== todayYmd) {
    throwValidationError("Solo puedes formalizar el mismo dia.");
  }
}

export function validateItemsForCreate(
  items: Array<{ serviceId: string; optionId: string; quantity: number; pax: number }>
) {
  if (!items.length) throwValidationError("Anade al menos una actividad.");
  for (const it of items) {
    if (!it.serviceId) throwValidationError("Falta servicio en un item.");
    if (!it.optionId) throwValidationError("Falta duracion en un item.");
    if (Number(it.quantity) < 1) throwValidationError("Cantidad invalida en un item.");
    if (Number(it.pax) < 1) throwValidationError("PAX invalido en un item.");
  }
}
