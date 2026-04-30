import type { ContractStatus } from "@prisma/client";

type ContractCheckinInput = {
  driverName?: string | null;
  driverPhone?: string | null;
  driverCountry?: string | null;
  driverAddress?: string | null;
  driverDocType?: string | null;
  driverDocNumber?: string | null;
  driverBirthDate?: Date | string | null;
  minorAuthorizationProvided?: boolean | null;
  minorAuthorizationFileKey?: string | null;
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
};

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function ageAtDate(birth: Date, at: Date) {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function minorRules(birth: Date, at: Date) {
  const age = ageAtDate(birth, at);
  return {
    age,
    isUnder16: age < 16,
    needsAuthorization: age >= 16 && age < 18,
  };
}

export function evaluateContractCheckinState(args: {
  contract: ContractCheckinInput;
  isLicense: boolean;
  status?: ContractStatus | string | null;
}) {
  const status = String(args.status ?? "").toUpperCase();
  if (status === "SIGNED") {
    return {
      canBeReady: true,
      nextStatus: "SIGNED" as const,
      blockingReason: null,
      minorNeedsAuthorization: Boolean(args.contract.minorAuthorizationProvided),
    };
  }

  const baseOk =
    hasText(args.contract.driverName) &&
    hasText(args.contract.driverCountry) &&
    hasText(args.contract.driverAddress) &&
    hasText(args.contract.driverDocType) &&
    hasText(args.contract.driverDocNumber);

  if (!baseOk) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "Faltan datos obligatorios del conductor.",
      minorNeedsAuthorization: false,
    };
  }

  if (!args.contract.driverBirthDate) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "Falta la fecha de nacimiento del conductor.",
      minorNeedsAuthorization: false,
    };
  }

  const birthDate = new Date(args.contract.driverBirthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "La fecha de nacimiento no es válida.",
      minorNeedsAuthorization: false,
    };
  }

  if (args.isLicense) {
    const licenseOk =
      hasText(args.contract.licenseSchool) &&
      hasText(args.contract.licenseType) &&
      hasText(args.contract.licenseNumber);

    if (!licenseOk) {
      return {
        canBeReady: false,
        nextStatus: "DRAFT" as const,
        blockingReason: "Faltan datos obligatorios de la licencia.",
        minorNeedsAuthorization: false,
      };
    }
  }

  const rule = minorRules(birthDate, new Date());
  if (rule.isUnder16) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "No se puede formalizar un contrato para un menor de 16 años.",
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !args.contract.minorAuthorizationProvided) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "Para un menor de 16 o 17 años debe constar la autorización.",
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !hasText(args.contract.minorAuthorizationFileKey)) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: "La autorización del tutor debe adjuntarse en tienda antes de cerrar la reserva.",
      minorNeedsAuthorization: true,
    };
  }

  return {
    canBeReady: true,
    nextStatus: "READY" as const,
    blockingReason: null,
    minorNeedsAuthorization: rule.needsAuthorization,
  };
}
