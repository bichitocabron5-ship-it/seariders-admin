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

export type ContractCheckinMissingField =
  | "driverName"
  | "driverCountry"
  | "driverAddress"
  | "driverDocType"
  | "driverDocNumber"
  | "driverBirthDate"
  | "minorAuthorizationProvided"
  | "minorAuthorizationFile"
  | "licenseSchool"
  | "licenseType"
  | "licenseNumber";

const BASE_REQUIRED_FIELDS = [
  "driverName",
  "driverCountry",
  "driverAddress",
  "driverDocType",
  "driverDocNumber",
] as const satisfies readonly ContractCheckinMissingField[];

const LICENSE_REQUIRED_FIELDS = [
  "licenseSchool",
  "licenseType",
  "licenseNumber",
] as const satisfies readonly ContractCheckinMissingField[];

const FIELD_LABELS: Record<"es" | "en", Record<ContractCheckinMissingField, string>> = {
  es: {
    driverName: "nombre del conductor",
    driverCountry: "pais del conductor",
    driverAddress: "direccion del conductor",
    driverDocType: "tipo de documento",
    driverDocNumber: "numero de documento",
    driverBirthDate: "fecha de nacimiento del conductor",
    minorAuthorizationProvided: "autorizacion del tutor",
    minorAuthorizationFile: "documento de autorizacion del tutor",
    licenseSchool: "escuela o emisor de la licencia",
    licenseType: "tipo de licencia",
    licenseNumber: "numero de licencia",
  },
  en: {
    driverName: "driver name",
    driverCountry: "driver country",
    driverAddress: "driver address",
    driverDocType: "document type",
    driverDocNumber: "document number",
    driverBirthDate: "driver birth date",
    minorAuthorizationProvided: "parent or guardian authorization",
    minorAuthorizationFile: "parent or guardian authorization document",
    licenseSchool: "license issuer or school",
    licenseType: "license type",
    licenseNumber: "license number",
  },
};

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function labelsForLanguage(language: string | null | undefined) {
  return language === "en" ? FIELD_LABELS.en : FIELD_LABELS.es;
}

function buildMissingFieldsReason(fields: ContractCheckinMissingField[], language: string | null | undefined) {
  const labels = labelsForLanguage(language);
  const names = fields.map((field) => labels[field]).join(", ");
  if (language === "en") return `Missing required fields: ${names}.`;
  return `Faltan campos obligatorios: ${names}.`;
}

function buildMissingLicenseReason(fields: ContractCheckinMissingField[], language: string | null | undefined) {
  const labels = labelsForLanguage(language);
  const names = fields.map((field) => labels[field]).join(", ");
  if (language === "en") return `Missing required license fields: ${names}.`;
  return `Faltan campos obligatorios de licencia: ${names}.`;
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
  language?: string | null;
}) {
  const status = String(args.status ?? "").toUpperCase();
  if (status === "SIGNED") {
    return {
      canBeReady: true,
      nextStatus: "SIGNED" as const,
      blockingReason: null,
      blockingFields: [] as ContractCheckinMissingField[],
      minorNeedsAuthorization: Boolean(args.contract.minorAuthorizationProvided),
    };
  }

  const missingBaseFields = BASE_REQUIRED_FIELDS.filter((field) => !hasText(args.contract[field]));
  if (missingBaseFields.length > 0) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: buildMissingFieldsReason([...missingBaseFields], args.language),
      blockingFields: [...missingBaseFields],
      minorNeedsAuthorization: false,
    };
  }

  if (!args.contract.driverBirthDate) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: buildMissingFieldsReason(["driverBirthDate"], args.language),
      blockingFields: ["driverBirthDate"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: false,
    };
  }

  const birthDate = new Date(args.contract.driverBirthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason:
        args.language === "en"
          ? "The driver's birth date is not valid."
          : "La fecha de nacimiento del conductor no es valida.",
      blockingFields: ["driverBirthDate"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: false,
    };
  }

  if (args.isLicense) {
    const missingLicenseFields = LICENSE_REQUIRED_FIELDS.filter((field) => !hasText(args.contract[field]));
    if (missingLicenseFields.length > 0) {
      return {
        canBeReady: false,
        nextStatus: "DRAFT" as const,
        blockingReason: buildMissingLicenseReason([...missingLicenseFields], args.language),
        blockingFields: [...missingLicenseFields],
        minorNeedsAuthorization: false,
      };
    }
  }

  const rule = minorRules(birthDate, new Date());
  if (rule.isUnder16) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason:
        args.language === "en"
          ? "A contract cannot be signed for a driver under 16 years old."
          : "No se puede formalizar un contrato para un menor de 16 anos.",
      blockingFields: ["driverBirthDate"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !args.contract.minorAuthorizationProvided) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason:
        args.language === "en"
          ? "Parent or guardian authorization is required for a 16 or 17 year old driver."
          : "Para un menor de 16 o 17 anos debe constar la autorizacion.",
      blockingFields: ["minorAuthorizationProvided"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !hasText(args.contract.minorAuthorizationFileKey)) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason:
        args.language === "en"
          ? "The parent or guardian authorization document must be validated in store before signing."
          : "La autorizacion del tutor debe adjuntarse en tienda antes de firmar.",
      blockingFields: ["minorAuthorizationFile"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: true,
    };
  }

  return {
    canBeReady: true,
    nextStatus: "READY" as const,
    blockingReason: null,
    blockingFields: [] as ContractCheckinMissingField[],
    minorNeedsAuthorization: rule.needsAuthorization,
  };
}
