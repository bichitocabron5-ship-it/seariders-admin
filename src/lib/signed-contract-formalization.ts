export const SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE =
  "La reserva tiene contratos firmados. Solo puedes reagendar fecha y hora sin tocar pax, datos legales ni composición de la reserva.";

export type ReservationContractCompositionLine = {
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
};

type ReservationContractCompositionItemInput = {
  serviceId: string;
  optionId?: string | null;
  quantity?: number | null;
  pax?: number | null;
  isExtra?: boolean | null;
};

export function buildComparableContractComposition(
  items: Array<{
    serviceId: string;
    optionId?: string | null;
    quantity?: number | null;
    pax?: number | null;
  }>
): ReservationContractCompositionLine[] {
  return items
    .map((item) => ({
      serviceId: item.serviceId,
      optionId: item.optionId ?? "",
      quantity: Number(item.quantity ?? 0),
      pax: Number(item.pax ?? 0),
    }))
    .sort((a, b) =>
      a.serviceId.localeCompare(b.serviceId) ||
      a.optionId.localeCompare(b.optionId) ||
      a.quantity - b.quantity ||
      a.pax - b.pax
    );
}

export function buildExistingReservationContractComposition(snapshot: {
  serviceId: string;
  optionId: string;
  quantity?: number | null;
  pax?: number | null;
  items?: ReservationContractCompositionItemInput[] | null;
}) {
  const mainItems = (snapshot.items ?? []).filter((item) => !item.isExtra);
  const optionBackedItems = mainItems.filter((item) => item.optionId);
  const sourceItems =
    optionBackedItems.length > 0
      ? optionBackedItems
      : mainItems.length > 0
        ? mainItems.map((item) => ({
            serviceId: item.serviceId,
            optionId: snapshot.optionId,
            quantity: item.quantity,
            pax: item.pax ?? snapshot.pax,
          }))
        : [
            {
              serviceId: snapshot.serviceId,
              optionId: snapshot.optionId,
              quantity: snapshot.quantity,
              pax: snapshot.pax,
            },
          ];

  return buildComparableContractComposition(sourceItems);
}

export function sameContractComposition(
  left: ReservationContractCompositionLine[],
  right: ReservationContractCompositionLine[]
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hasSignedContractBlockingChange(args: {
  hasSignedContracts: boolean;
  compositionChanged: boolean;
  protectedNonScheduleFieldsChanged: boolean;
}) {
  return Boolean(
    args.hasSignedContracts &&
      (args.compositionChanged || args.protectedNonScheduleFieldsChanged)
  );
}

export function shouldSyncReservationBeforeFormalize(args: {
  hasSignedContracts: boolean;
  hasPendingReservationChanges: boolean;
}) {
  void args.hasSignedContracts;
  return args.hasPendingReservationChanges;
}
