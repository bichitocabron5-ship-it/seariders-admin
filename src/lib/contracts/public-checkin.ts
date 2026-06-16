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

type CheckinLanguage = "es" | "en" | "fr";

const FIELD_LABELS: Record<CheckinLanguage, Record<ContractCheckinMissingField, string>> = {
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
  fr: {
    driverName: "nom du conducteur",
    driverCountry: "pays du conducteur",
    driverAddress: "adresse du conducteur",
    driverDocType: "type de document",
    driverDocNumber: "numero de document",
    driverBirthDate: "date de naissance du conducteur",
    minorAuthorizationProvided: "autorisation du parent ou tuteur",
    minorAuthorizationFile: "document d'autorisation du parent ou tuteur",
    licenseSchool: "ecole ou emetteur du permis",
    licenseType: "type de permis",
    licenseNumber: "numero de permis",
  },
};

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function normalizeCheckinLanguage(language: string | null | undefined): CheckinLanguage {
  if (language === "en") return "en";
  if (language === "fr") return "fr";
  return "es";
}

function textForLanguage(language: string | null | undefined, texts: Record<CheckinLanguage, string>) {
  return texts[normalizeCheckinLanguage(language)];
}

function labelsForLanguage(language: string | null | undefined) {
  return FIELD_LABELS[normalizeCheckinLanguage(language)];
}

function buildMissingFieldsReason(fields: ContractCheckinMissingField[], language: string | null | undefined) {
  const labels = labelsForLanguage(language);
  const names = fields.map((field) => labels[field]).join(", ");
  return textForLanguage(language, {
    es: `Faltan campos obligatorios: ${names}.`,
    en: `Missing required fields: ${names}.`,
    fr: `Champs obligatoires manquants : ${names}.`,
  });
}

function buildMissingLicenseReason(fields: ContractCheckinMissingField[], language: string | null | undefined) {
  const labels = labelsForLanguage(language);
  const names = fields.map((field) => labels[field]).join(", ");
  return textForLanguage(language, {
    es: `Faltan campos obligatorios de licencia: ${names}.`,
    en: `Missing required license fields: ${names}.`,
    fr: `Champs obligatoires du permis manquants : ${names}.`,
  });
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
      blockingReason: textForLanguage(args.language, {
        es: "La fecha de nacimiento del conductor no es valida.",
        en: "The driver's birth date is not valid.",
        fr: "La date de naissance du conducteur n'est pas valide.",
      }),
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
      blockingReason: textForLanguage(args.language, {
        es: "No se puede formalizar un contrato para un menor de 16 anos.",
        en: "A contract cannot be signed for a driver under 16 years old.",
        fr: "Un contrat ne peut pas etre signe pour un conducteur de moins de 16 ans.",
      }),
      blockingFields: ["driverBirthDate"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !args.contract.minorAuthorizationProvided) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: textForLanguage(args.language, {
        es: "Para un menor de 16 o 17 anos debe constar la autorizacion.",
        en: "Parent or guardian authorization is required for a 16 or 17 year old driver.",
        fr: "Une autorisation du parent ou tuteur est obligatoire pour un conducteur de 16 ou 17 ans.",
      }),
      blockingFields: ["minorAuthorizationProvided"] as ContractCheckinMissingField[],
      minorNeedsAuthorization: true,
    };
  }

  if (rule.needsAuthorization && !hasText(args.contract.minorAuthorizationFileKey)) {
    return {
      canBeReady: false,
      nextStatus: "DRAFT" as const,
      blockingReason: textForLanguage(args.language, {
        es: "La autorizacion del tutor debe adjuntarse en tienda antes de firmar.",
        en: "The parent or guardian authorization document must be validated in store before signing.",
        fr: "Le document d'autorisation du parent ou tuteur doit etre valide en boutique avant la signature.",
      }),
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
