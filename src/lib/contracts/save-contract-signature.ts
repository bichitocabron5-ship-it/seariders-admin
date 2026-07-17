import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ContractStatus, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { s3 } from "@/lib/s3";
import { regenerateSignedContractPdf } from "@/lib/contracts/render-contract-pdf";
import type { PublicLanguage } from "@/lib/public-links/i18n";
import { pickVisibleContractsByTargets } from "@/lib/contracts/active-contracts";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import { verifyReservationCheckinToken } from "@/lib/reservations/public-checkin-link";

export type ContractSignatureErrorCode =
  | "CONTRACT_NOT_FOUND"
  | "INVALID_SIGNATURE_TOKEN"
  | "RESERVATION_NOT_ACTIVE"
  | "CONTRACT_VOID"
  | "CONTRACT_SUPERSEDED"
  | "CONTRACT_ALREADY_SIGNED"
  | "CONTRACT_NOT_READY"
  | "CONTRACT_NOT_VISIBLE";

export class ContractSignatureError extends Error {
  public readonly code: ContractSignatureErrorCode;
  public readonly status: number;

  constructor(
    message: string,
    code: ContractSignatureErrorCode,
    status: number
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ContractSignatureError";
  }
}

type ContractSignatureAccess =
  | { type: "internal" }
  | { type: "contract-signature-token"; token: string }
  | { type: "reservation-checkin-token"; token: string };

export type ContractSignatureValidationContract = {
  id: string;
  reservationId: string;
  reservationItemId?: string | null;
  unitIndex: number;
  logicalUnitIndex: number | null;
  status: ContractStatus | string;
  supersededAt: Date | null;
  signedAt: Date | null;
  reservation: {
    id: string;
    status: ReservationStatus | string;
    quantity: number | null;
    serviceId?: string | null;
    optionId?: string | null;
    pax?: number | null;
    isLicense: boolean;
    service: { category: string | null } | null;
    items: Array<{
      id?: string | null;
      serviceId?: string | null;
      optionId?: string | null;
      quantity: number | null;
      pax?: number | null;
      isExtra: boolean;
      service: { category: string | null } | null;
    }>;
    contracts: Array<{
      id: string;
      reservationItemId?: string | null;
      unitIndex: number | null;
      logicalUnitIndex: number | null;
      status: ContractStatus | string | null;
      supersededAt: Date | string | null;
      createdAt: Date | string | null;
    }>;
  };
};

type SignatureUpdateData = {
  signatureImageKey: string;
  signatureImageUrl: string;
  signatureSignedBy: string;
  signedLanguage?: PublicLanguage;
  signedAt: Date;
  status: ContractStatus;
  imageConsentAccepted?: boolean;
  imageConsentAcceptedAt?: Date;
  imageConsentAcceptedBy?: string;
};

export type SaveContractSignatureDeps = {
  loadContract?: (contractId: string) => Promise<ContractSignatureValidationContract | null>;
  putSignatureImage?: (args: { bucket: string; key: string; body: Buffer }) => Promise<void>;
  updateContractSignature?: (args: { contractId: string; data: SignatureUpdateData }) => Promise<void>;
  regenerateSignedContractPdf?: typeof regenerateSignedContractPdf;
  now?: () => Date;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

function buildSignatureKey(args: { contractId: string; reservationId: string; date: Date }) {
  const d = args.date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/signature_${args.contractId}.png`;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Formato de firma no valido");
  return Buffer.from(match[1], "base64");
}

function invalidToken(): never {
  throw new ContractSignatureError(
    "Token de firma no valido o caducado",
    "INVALID_SIGNATURE_TOKEN",
    401
  );
}

function resolveAuthorizedContract(args: {
  contractId?: string;
  access: ContractSignatureAccess;
}) {
  if (args.access.type === "internal") {
    if (!args.contractId) invalidToken();
    return { contractId: args.contractId, expectedReservationId: null };
  }

  if (args.access.type === "contract-signature-token") {
    const payload = verifyContractSignatureToken(args.access.token);
    if (!payload) invalidToken();
    if (args.contractId && payload.contractId !== args.contractId) invalidToken();
    return { contractId: payload.contractId, expectedReservationId: null };
  }

  const payload = verifyReservationCheckinToken(args.access.token);
  if (!payload || !args.contractId) invalidToken();
  return { contractId: args.contractId, expectedReservationId: payload.reservationId };
}

function assertActiveReservation(status: ReservationStatus | string) {
  if (status === ReservationStatus.CANCELED || status === ReservationStatus.COMPLETED) {
    throw new ContractSignatureError(
      "La reserva no esta activa",
      "RESERVATION_NOT_ACTIVE",
      409
    );
  }
}

function assertContractCanBeSigned(contract: ContractSignatureValidationContract) {
  assertActiveReservation(contract.reservation.status);

  if (contract.status === ContractStatus.VOID) {
    throw new ContractSignatureError(
      "No se puede firmar un contrato VOID",
      "CONTRACT_VOID",
      409
    );
  }

  if (contract.supersededAt) {
    throw new ContractSignatureError(
      "No se puede firmar un contrato sustituido",
      "CONTRACT_SUPERSEDED",
      409
    );
  }

  if (contract.signedAt || contract.status === ContractStatus.SIGNED) {
    throw new ContractSignatureError(
      "Este contrato ya esta firmado",
      "CONTRACT_ALREADY_SIGNED",
      409
    );
  }

  if (contract.status !== ContractStatus.READY) {
    throw new ContractSignatureError(
      "El contrato no esta listo para firmar",
      "CONTRACT_NOT_READY",
      409
    );
  }

  const contractRequirements = buildReservationContractRequirements({
    quantity: contract.reservation.quantity,
    isLicense: Boolean(contract.reservation.isLicense),
    serviceCategory: contract.reservation.service?.category ?? null,
    serviceId: contract.reservation.serviceId,
    optionId: contract.reservation.optionId,
    pax: contract.reservation.pax,
    items: contract.reservation.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const visibleContracts = pickVisibleContractsByTargets(
    contract.reservation.contracts ?? [],
    syncTargets
  );

  if (!visibleContracts.some((visibleContract) => visibleContract.id === contract.id)) {
    throw new ContractSignatureError(
      "El contrato no esta vigente para esta reserva",
      "CONTRACT_NOT_VISIBLE",
      409
    );
  }
}

async function loadContractForSignature(contractId: string) {
  return await prisma.reservationContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      reservationId: true,
      reservationItemId: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      signedAt: true,
      reservation: {
        select: {
          id: true,
          status: true,
          quantity: true,
          serviceId: true,
          optionId: true,
          pax: true,
          isLicense: true,
          service: { select: { category: true } },
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              isExtra: true,
              service: { select: { category: true } },
            },
          },
          contracts: {
            select: {
              id: true,
              reservationItemId: true,
              unitIndex: true,
              logicalUnitIndex: true,
              status: true,
              supersededAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}

async function putSignatureImage(args: { bucket: string; key: string; body: Buffer }) {
  await s3.send(
    new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      Body: args.body,
      ContentType: "image/png",
    })
  );
}

async function updateContractSignature(args: { contractId: string; data: SignatureUpdateData }) {
  await prisma.reservationContract.update({
    where: { id: args.contractId },
    data: args.data,
  });
}

export async function saveContractSignature(args: {
  contractId?: string;
  signerName: string;
  imageDataUrl: string;
  imageConsentAccepted?: boolean;
  language?: PublicLanguage;
  signedLanguage?: PublicLanguage;
  access: ContractSignatureAccess;
}, deps: SaveContractSignatureDeps = {}) {
  const access = resolveAuthorizedContract({
    contractId: args.contractId,
    access: args.access,
  });
  const contract = await (deps.loadContract ?? loadContractForSignature)(access.contractId);

  if (!contract) {
    throw new ContractSignatureError(
      "Contrato no encontrado",
      "CONTRACT_NOT_FOUND",
      404
    );
  }

  if (access.expectedReservationId && contract.reservationId !== access.expectedReservationId) {
    invalidToken();
  }

  assertContractCanBeSigned(contract);

  const buffer = dataUrlToBuffer(args.imageDataUrl);
  const bucket = requireEnv("S3_BUCKET");
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();
  const signedAt = (deps.now ?? (() => new Date()))();
  const key = buildSignatureKey({
    contractId: contract.id,
    reservationId: contract.reservationId,
    date: signedAt,
  });

  await (deps.putSignatureImage ?? putSignatureImage)({ bucket, key, body: buffer });

  const imageUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : args.imageDataUrl;

  await (deps.updateContractSignature ?? updateContractSignature)({
    contractId: contract.id,
    data: {
      signatureImageKey: key,
      signatureImageUrl: imageUrl,
      signatureSignedBy: args.signerName,
      signedLanguage: args.signedLanguage ?? undefined,
      signedAt,
      status: ContractStatus.SIGNED,
      imageConsentAccepted: args.imageConsentAccepted ?? undefined,
      imageConsentAcceptedAt: args.imageConsentAccepted ? signedAt : undefined,
      imageConsentAcceptedBy: args.imageConsentAccepted ? args.signerName : undefined,
    },
  });

  return await (deps.regenerateSignedContractPdf ?? regenerateSignedContractPdf)(
    contract.id,
    args.language ?? args.signedLanguage ?? "es"
  );
}
