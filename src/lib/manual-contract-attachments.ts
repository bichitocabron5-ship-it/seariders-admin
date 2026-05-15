type ReadyContractCountArgs = {
  requiredUnits?: number | null;
  readyContractsCount?: number | null;
  manualAttachmentCount?: number | null;
};

export function resolveReadyContractCountWithManualAttachments(
  args: ReadyContractCountArgs
) {
  const requiredUnits = Math.max(0, Number(args.requiredUnits ?? 0));
  if (requiredUnits <= 0) return 0;

  const readyContractsCount = Math.max(0, Number(args.readyContractsCount ?? 0));
  const manualAttachmentCount = Math.max(0, Number(args.manualAttachmentCount ?? 0));

  return Math.min(requiredUnits, readyContractsCount + manualAttachmentCount);
}
