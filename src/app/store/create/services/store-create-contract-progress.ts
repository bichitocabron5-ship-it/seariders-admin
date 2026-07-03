export type StoreCreateContractProgress = {
  requiredUnits: number;
  readyCount: number;
  refreshed: boolean;
};

export function canProceedPastContracts(progress: StoreCreateContractProgress) {
  if (!progress.refreshed) return false;
  return progress.requiredUnits <= 0 || progress.readyCount >= progress.requiredUnits;
}

export function contractProgressMessage(progress: Pick<StoreCreateContractProgress, "requiredUnits" | "readyCount">) {
  if (progress.requiredUnits <= 0) return "Esta actividad no requiere contratos.";
  return `Contratos sincronizados: ${progress.readyCount}/${progress.requiredUnits}.`;
}

export function missingContractProgressMessage(progress: Pick<StoreCreateContractProgress, "requiredUnits" | "readyCount">) {
  return `Faltan contratos por completar: ${progress.readyCount}/${progress.requiredUnits} listos.`;
}
