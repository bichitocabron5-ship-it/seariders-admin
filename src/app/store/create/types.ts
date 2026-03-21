// src/app/store/create/types.ts
export type ServiceMain = { id: string; name: string; category?: string | null; code?: string | null; isLicense?: boolean | null };

export type Option = {
  id: string;
  serviceId: string;
  code?: string | null;
  durationMinutes?: number | null;
  paxMax?: number | null;
  contractedMinutes?: number | null;
  basePriceCents?: number | null;
  hasPrice?: boolean;
};

export type Channel = { id: string; name: string; commissionEnabled?: boolean; commissionBps?: number };

export type CartItem = {
  id: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
};

export type UIMode = "CREATE" | "FORMALIZE" | "EDIT";

export type ContractDto = {
  id: string;
  unitIndex: number;
  status: "DRAFT" | "READY" | "SIGNED" | "VOID";
  driverName: string | null;
  driverPhone: string | null;
  driverEmail: string | null;
  driverCountry: string | null;
  driverAddress: string | null;
  driverPostalCode?: string | null;
  driverDocType: string | null;
  driverDocNumber: string | null;
  driverBirthDate?: string | null;
  minorAuthorizationProvided?: boolean | null;
  licenseSchool: string | null;
  licenseType: string | null;
  licenseNumber: string | null;
  templateCode?: string | null;
  templateVersion?: string | null;

  renderedHtml?: string | null;
  renderedPdfUrl?: string | null;

  signatureRequestId?: string | null;
  signatureStatusRaw?: string | null;
  signaturePayloadJson?: unknown | null;

  signatureSignedPdfUrl?: string | null;
  signatureAuditJson?: unknown | null;

  preparedJetskiId?: string | null;
  preparedAssetId?: string | null;

  preparedJetski?: {
    id: string;
    number?: number | null;
    model?: string | null;
    plate?: string | null;
  } | null;

  preparedAsset?: {
    id: string;
    name?: string | null;
    type?: string | null;
    plate?: string | null;
  } | null;
};

export type PreparedJetskiOption = {
  id: string;
  number: number | null;
  model: string | null;
  plate: string | null;
};

export type PreparedAssetOption = {
  id: string;
  name: string | null;
  type: string | null;
  plate: string | null;
};

export type PreparedResourcesResponse = {
  ok: true;
  jetskis: Array<{
    id: string;
    number: number | null;
    model: string | null;
    plate: string | null;
  }>;
  assets: Array<{
    id: string;
    name: string | null;
    type: string | null;
    plate: string | null;
  }>;
};

export type ContractPatch = {
  status?: "DRAFT" | "READY" | "SIGNED" | "VOID";
  driverName?: string | null;
  driverPhone?: string | null;
  driverEmail?: string | null;
  driverCountry?: string | null;
  driverAddress?: string | null;
  driverPostalCode?: string | null;
  driverDocType?: string | null;
  driverDocNumber?: string | null;
  driverBirthDate?: string | null;
  minorAuthorizationProvided?: boolean;
  licenseSchool?: string | null;
  licenseType?: string | null;
  licenseNumber?: string | null;
  preparedJetskiId?: string | null;
  preparedAssetId?: string | null;
};

export type AvailabilitySlot = {
  time: string;
  used?: Record<string, number>;
  isFull?: Record<string, boolean>;
};

export type AvailabilityData = {
  ok: boolean;
  slots: AvailabilitySlot[];
  limits?: Record<string, number>;
};

export type DiscountPreview = {
  baseTotalCents: number;
  autoDiscountCents: number;
  finalTotalCents: number;
  reason?: string | null;
};

export type PackPreviewItem = {
  quantity?: number | null;
  service?: { name?: string | null } | null;
  option?: { durationMinutes?: number | null } | null;
};

export type PackPreview = {
  items?: PackPreviewItem[];
};

export type MigrateFlags = {
  isPast: boolean;
  isHistorical: boolean;
  isGift?: boolean;
  isPass?: boolean;
};

export type ContractsState = "NONE" | "MISSING" | "PARTIAL" | "OK";

export type ReservationContractsResponse = {
  reservationId: string;
  requiredUnits: number;
  readyCount: number;
  needsContracts: boolean;
  contractsState: ContractsState;
  contracts: ContractDto[];
};

export type ContractDraftState = Record<
  string,
  {
    driverName: string;
    driverPhone: string;
    driverEmail: string;
    driverCountry: string;
    driverAddress: string;
    driverPostalCode: string;
    driverDocType: string;
    driverDocNumber: string;
    driverBirthDate: string;
    minorAuthorizationProvided: boolean;
    licenseSchool: string;
    licenseType: string;
    licenseNumber: string;
    preparedJetskiId: string;
    preparedAssetId: string;
  }
>;
