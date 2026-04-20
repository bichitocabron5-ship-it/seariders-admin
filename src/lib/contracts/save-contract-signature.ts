import { PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { s3 } from "@/lib/s3";
import { regenerateSignedContractPdf } from "@/lib/contracts/render-contract-pdf";
import type { PublicLanguage } from "@/lib/public-links/i18n";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta variable de entorno ${name}`);
  return value;
}

function buildSignatureKey(args: { contractId: string; reservationId: string }) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `contracts/${yyyy}/${mm}/reservation_${args.reservationId}/signature_${args.contractId}.png`;
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error("Formato de firma no válido");
  return Buffer.from(match[1], "base64");
}

export async function saveContractSignature(args: {
  contractId: string;
  signerName: string;
  imageDataUrl: string;
  imageConsentAccepted?: boolean;
  language?: PublicLanguage;
}) {
  const contract = await prisma.reservationContract.findUnique({
    where: { id: args.contractId },
    select: {
      id: true,
      reservationId: true,
    },
  });

  if (!contract) throw new Error("Contrato no encontrado");

  const buffer = dataUrlToBuffer(args.imageDataUrl);
  const bucket = requireEnv("S3_BUCKET");
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();
  const key = buildSignatureKey({
    contractId: contract.id,
    reservationId: contract.reservationId,
  });

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    })
  );

  const imageUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : args.imageDataUrl;

  await prisma.reservationContract.update({
    where: { id: contract.id },
    data: {
      signatureImageKey: key,
      signatureImageUrl: imageUrl,
      signatureSignedBy: args.signerName,
      signedAt: new Date(),
      status: "SIGNED",
      imageConsentAccepted: args.imageConsentAccepted ?? undefined,
      imageConsentAcceptedAt: args.imageConsentAccepted ? new Date() : undefined,
      imageConsentAcceptedBy: args.imageConsentAccepted ? args.signerName : undefined,
    },
  });

  return await regenerateSignedContractPdf(contract.id, args.language ?? "es");
}
