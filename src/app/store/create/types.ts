// src/app/store/create/types.ts
export type ServiceMain = { id: string; name: string; category?: string | null; code?: string | null; isLicense?: boolean | null };
export type JetskiLicenseMode = "NONE" | "GREEN_LIMITED" | "YELLOW_UNLIMITED";
export type PricingTier = "STANDARD" | "RESIDENT";

export type Option = {
  id: string;
  serviceId: string;
  code?: string | null;
  durationMinutes?: number | null;
  paxMax?: number | null;
  contractedMinutes?: number | null;
  basePriceCents?: number | null;
  standardPriceCents?: number | null;
  residentPriceCents?: number | null;
  hasPrice?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  kind?: "STANDARD" | "EXTERNAL_ACTIVITY" | null;
  visibleInStore?: boolean | null;
  visibleInBooth?: boolean | null;
  showDiscountPolicyInStore?: boolean | null;
  showDiscountPolicyInBooth?: boolean | null;
  allowsPromotions?: boolean | null;
  commissionEnabled?: boolean | null;
  commissionBps?: number | null;
  discountResponsibility?: "COMPANY" | "PROMOTER" | "SHARED" | null;
  promoterDiscountShareBps?: number | null;
  commissionRules?: Array<{ serviceId: string; commissionPct?: number | null }> | null;
};

export type CartItem = {
  id: string;
  serviceId: string;
  optionId: string;
  quantity: number;
  pax: number;
  applyPromo?: boolean;
  promoCode?: string | null;
  availablePromos?: DiscountPromoChoice[];
};

export type DiscountPromoChoice = {
  code: string | null;
  name: string;
  kind: "FIXED" | "PERCENT";
  value: number;
  discountCents: number;
};

export type CustomerSearchRow = {
  reservationId: string;
  customerName: string | null;
  email: string | null;
  phone: string | null;
  customerDocNumber: string | null;
  country: string | null;
  birthDate: string | null;
  address: string | null;
  postalCode: string | null;
  licenseNumber: string | null;
  lastActivityAt: string | null;
};

export type UIMode = "CREATE" | "FORMALIZE" | "EDIT";

export type ContractDto = {
  id: string;
  unitIndex: number;
  logicalUnitIndex?: number | null;
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
  renderedPdfKey?: string | null;
  renderedPdfUrl?: string | null;

  signatureRequestId?: string | null;
  signatureStatusRaw?: string | null;
  signaturePayloadJson?: unknown | null;

  imageConsentAccepted?: boolean | null;
  imageConsentAcceptedAt?: string | null;
  imageConsentAcceptedBy?: string | null;

  minorAuthorizationFileKey?: string | null;
  minorAuthorizationFileUrl?: string | null;
  minorAuthorizationFileName?: string | null;
  minorAuthorizationUploadedAt?: string | null;

  signatureSignedPdfUrl?: string | null;
  signatureAuditJson?: unknown | null;

  signedAt?: string | null;
  signatureImageUrl?: string | null;
  signatureImageKey?: string | null;
  signatureSignedBy?: string | null;

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

  notifications?: Array<{
    id: string;
    status: string;
    provider: string;
    recipientPhone: string | null;
    linkUrl: string | null;
    errorMessage: string | null;
    createdAt: string;
    sentAt: string | null;
  }>;
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
  imageConsentAccepted?: boolean;
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
  pricingTier?: PricingTier | null;
  pricingMeta?: {
    pricingTier: PricingTier;
    unitPriceCents: number;
    quantity: number;
    modeLabel: string;
  } | null;
  reason?: string | null;
  channelPricingSummary?: {
    channelName: string;
    basePriceCents: number;
    referencePriceCents: number;
    optionLabel: string;
  } | null;
  availablePromos?: DiscountPromoChoice[];
  appliedRule?: { id: string; name: string; code: string | null } | null;
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
  isCanceled?: boolean;
  isCompleted?: boolean;
  isReadOnly?: boolean;
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
    imageConsentAccepted: boolean;
    licenseSchool: string;
    licenseType: string;
    licenseNumber: string;
    preparedJetskiId: string;
    preparedAssetId: string;
  }
>;
