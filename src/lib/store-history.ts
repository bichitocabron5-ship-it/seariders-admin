import { deriveStoreFlowStage } from "@/lib/store-flow-stage";

export type StoreHistoryReason =
  | "COMPLETED"
  | "CANCELED"
  | "PAST_ACTIVITY";

export function deriveStoreHistoryMeta(args: {
  status: string | null | undefined;
  activityDate?: Date | null;
  scheduledTime?: Date | null;
  arrivalAt?: Date | null;
  createdAt?: Date | null;
}) {
  const status = String(args.status ?? "").toUpperCase();
  const storeFlowStage = deriveStoreFlowStage(status, args.arrivalAt);

  let historicalReason: StoreHistoryReason = "PAST_ACTIVITY";
  if (status === "COMPLETED") historicalReason = "COMPLETED";
  if (status === "CANCELED") historicalReason = "CANCELED";

  const historicalAt =
    args.arrivalAt ??
    args.scheduledTime ??
    args.activityDate ??
    args.createdAt ??
    null;

  return {
    storeFlowStage,
    historicalReason,
    historicalAt,
  };
}

export function storeHistoryReasonLabel(reason: StoreHistoryReason) {
  switch (reason) {
    case "COMPLETED":
      return "Cerrada";
    case "CANCELED":
      return "Cancelada";
    case "PAST_ACTIVITY":
    default:
      return "Fecha pasada";
  }
}
