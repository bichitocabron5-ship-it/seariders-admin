// src/lib/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno ${name}`);
  }
  return value;
}

export const s3 = new S3Client({
  region: requireEnv("S3_REGION"),
  credentials: {
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
  },
});

export async function uploadPdfToS3(args: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  const bucket = requireEnv("S3_BUCKET");
  const contentType = args.contentType ?? "application/pdf";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: args.key,
      Body: args.body,
      ContentType: contentType,
    })
  );

  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();

  return {
    key: args.key,
    url: publicBaseUrl ? `${publicBaseUrl}/${args.key}` : null,
  };
}

export async function getSignedContractPdfUrl(key: string, expiresIn = 300) {
  const bucket = requireEnv("S3_BUCKET");

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn });
}

export async function getSignedPrivateFileUrl(key: string, expiresIn = 300) {
  const bucket = requireEnv("S3_BUCKET");

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3, command, { expiresIn });
}

function slugPart(v: string | null | undefined, fallback: string) {
  const normalized = String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || fallback;
}

export function buildContractPdfKey(args: {
  reservationId: string;
  contractId: string;
  displayName?: string | null;
  date?: Date;
}) {
  const d = args.date ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const safeName = slugPart(args.displayName, "contract");

  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/contract_${safeName}_${args.contractId}.pdf`;
}

export function buildMinorAuthorizationKey(args: {
  reservationId: string;
  contractId: string;
  displayName?: string | null;
  fileName: string;
  date?: Date;
}) {
  const d = args.date ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const safeDisplayName = slugPart(args.displayName, "minor_authorization");
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/minor_auth_${safeDisplayName}_${args.contractId}_${safeName}`;
}

export function buildManualReservationContractKey(args: {
  reservationId: string;
  displayName?: string | null;
  fileName: string;
  date?: Date;
}) {
  const d = args.date ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const safeDisplayName = slugPart(args.displayName, "manual_contract");
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/manual_signed_contract_${safeDisplayName}_${safeName}`;
}
