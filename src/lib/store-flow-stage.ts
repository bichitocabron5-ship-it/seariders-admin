export function deriveStoreFlowStage(status: string, arrivalAt?: Date | string | null) {
  if (status === "WAITING") {
    return arrivalAt ? "RETURN_PENDING_CLOSE" : "QUEUE";
  }

  if (status === "READY_FOR_PLATFORM") {
    return "READY_FOR_PLATFORM";
  }

  if (status === "IN_SEA") {
    return "IN_SEA";
  }

  return status;
}

export function isReturnPendingCloseStage(stage: string | null | undefined) {
  return stage === "RETURN_PENDING_CLOSE";
}
