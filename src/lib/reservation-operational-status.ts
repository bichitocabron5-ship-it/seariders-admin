import { deriveStoreFlowStage } from "./store-flow-stage";

export type ReservationOperationalStatus =
  | "SCHEDULED"
  | "QUEUE"
  | "WAITING"
  | "READY_FOR_PLATFORM"
  | "IN_SEA"
  | "RETURN_PENDING_CLOSE"
  | "COMPLETED"
  | "CANCELED";

export function getReservationOperationalStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "SCHEDULED":
      return "Programada";
    case "QUEUE":
      return "Pendiente de salida";
    case "WAITING":
      return "En espera";
    case "READY_FOR_PLATFORM":
      return "Lista para plataforma";
    case "IN_SEA":
      return "En mar";
    case "RETURN_PENDING_CLOSE":
      return "Devuelta pendiente de cierre";
    case "COMPLETED":
      return "Completada";
    case "CANCELED":
      return "Cancelada";
    default:
      return String(status ?? "");
  }
}

export function resolveReservationOperationalStatus(args: {
  status: string | null | undefined;
  arrivalAt?: Date | string | null | undefined;
  storeFlowStage?: string | null | undefined;
}) {
  const code = (args.storeFlowStage ??
    deriveStoreFlowStage(String(args.status ?? ""), args.arrivalAt ?? null)) as ReservationOperationalStatus;

  return {
    code,
    label: getReservationOperationalStatusLabel(code),
  };
}
