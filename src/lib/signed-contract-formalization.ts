export const SIGNED_CONTRACT_CHANGE_BLOCK_MESSAGE =
  "La reserva tiene contratos firmados. Solo puedes reagendar fecha y hora sin tocar pax, datos legales ni composición de la reserva.";

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
  return !args.hasSignedContracts || args.hasPendingReservationChanges;
}
