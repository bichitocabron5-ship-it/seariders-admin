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

export function buildContractPdfKey(args: {
  reservationId: string;
  contractId: string;
  date?: Date;
}) {
  const d = args.date ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");

  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/contract_${args.contractId}.pdf`;
}