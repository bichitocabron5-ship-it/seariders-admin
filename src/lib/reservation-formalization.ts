function normalizeOptionalString(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = String(v).trim();
  if (t === "-") return null;
  return t.length ? t : null;
}

export type ReservationLicenseContractLike = {
  unitIndex: number | null;
  logicalUnitIndex: number | null;
  driverName: string | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
};

export function hasCompleteLicense(args: {
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
}) {
  return Boolean(
    normalizeOptionalString(args.licenseSchool) &&
      normalizeOptionalString(args.licenseType) &&
      normalizeOptionalString(args.licenseNumber)
  );
}

export function buildMissingLicenseError(
  contract: ReservationLicenseContractLike
) {
  const missing: string[] = [];
  if (!normalizeOptionalString(contract.licenseSchool)) missing.push("escuela");
  if (!normalizeOptionalString(contract.licenseType)) missing.push("tipo");
  if (!normalizeOptionalString(contract.licenseNumber)) missing.push("numero");
  if (!missing.length) return null;

  const unit = Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0) || 1;
  const driver = normalizeOptionalString(contract.driverName);
  const driverSuffix = driver ? ` (${driver})` : "";
  return `Faltan datos de licencia en el contrato de la unidad ${unit}${driverSuffix}: ${missing.join(", ")}.`;
}

export function resolveLicenseValue(args: {
  bodyValue: string | null | undefined;
  currentValue: string | null | undefined;
  contractValue: string | null | undefined;
}) {
  const fromBody = normalizeOptionalString(args.bodyValue);
  if (fromBody) return fromBody;

  const fromCurrent = normalizeOptionalString(args.currentValue);
  if (fromCurrent) return fromCurrent;

  return normalizeOptionalString(args.contractValue);
}

export function resolveReservationLicenseDetails(args: {
  isLicense: boolean;
  body: {
    licenseSchool?: string | null;
    licenseType?: string | null;
    licenseNumber?: string | null;
  };
  current: {
    licenseSchool?: string | null;
    licenseType?: string | null;
    licenseNumber?: string | null;
  };
  visibleContracts: ReservationLicenseContractLike[];
  primaryContract?: ReservationLicenseContractLike | null;
}) {
  const completeLicenseContract =
    args.visibleContracts.find((contract) => hasCompleteLicense(contract)) ??
    args.primaryContract ??
    null;

  const licenseSchool = resolveLicenseValue({
    bodyValue: args.body.licenseSchool,
    currentValue: args.current.licenseSchool,
    contractValue: completeLicenseContract?.licenseSchool ?? null,
  });
  const licenseType = resolveLicenseValue({
    bodyValue: args.body.licenseType,
    currentValue: args.current.licenseType,
    contractValue: completeLicenseContract?.licenseType ?? null,
  });
  const licenseNumber = resolveLicenseValue({
    bodyValue: args.body.licenseNumber,
    currentValue: args.current.licenseNumber,
    contractValue: completeLicenseContract?.licenseNumber ?? null,
  });

  const missingContractMessage = args.isLicense
    ? args.visibleContracts
        .map((contract) => buildMissingLicenseError(contract))
        .find((message): message is string => Boolean(message)) ?? null
    : null;

  return {
    licenseSchool,
    licenseType,
    licenseNumber,
    completeLicenseContract,
    missingContractMessage,
    isComplete:
      !args.isLicense ||
      Boolean(licenseSchool && licenseType && licenseNumber) &&
        !missingContractMessage,
  };
}
