import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import {
  buildContractHtml,
  loadLogoSrc,
  templateCodeForContract,
} from "@/lib/contracts/render-contract";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";
import { SignContractPageClient } from "./sign-contract-page-client";

export const runtime = "nodejs";

export default async function SignContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const language = normalizePublicLanguage(lang);
  const payload = verifyContractSignatureToken(token);
  if (!payload) notFound();

  const contract = await prisma.reservationContract.findUnique({
    where: { id: payload.contractId },
    select: {
      id: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      driverName: true,
      driverDocType: true,
      driverDocNumber: true,
      driverBirthDate: true,
      driverAddress: true,
      driverPostalCode: true,
      driverPhone: true,
      driverEmail: true,
      driverCountry: true,
      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,
      minorAuthorizationProvided: true,
      imageConsentAccepted: true,
      minorAuthorizationFileKey: true,
      minorAuthorizationFileName: true,
      signatureImageUrl: true,
      signatureSignedBy: true,
      signedAt: true,
      renderedHtml: true,
      preparedJetski: {
        select: {
          id: true,
          number: true,
          model: true,
          plate: true,
        },
      },
      preparedAsset: {
        select: {
          id: true,
          name: true,
          type: true,
          plate: true,
        },
      },
      reservation: {
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerCountry: true,
          option: { select: { durationMinutes: true } },
          quantity: true,
          pax: true,
          totalPriceCents: true,
          isLicense: true,
          service: { select: { name: true, category: true } },
          activityDate: true,
          scheduledTime: true,
        },
      },
    },
  });

  if (!contract) notFound();

  const logoSrc = await loadLogoSrc();
  const hasLicense =
    Boolean(contract.licenseNumber?.trim()) || Boolean(contract.reservation.isLicense);
  const renderedHtml =
    contract.renderedHtml?.trim() ||
    buildContractHtml({
      templateCode: templateCodeForContract({
        category: contract.reservation.service?.category ?? null,
        hasLicense,
      }),
      templateVersion: "v1",
      language,
      logoSrc,
      reservation: {
        id: contract.reservation.id,
        activityDate: contract.reservation.activityDate,
        scheduledTime: contract.reservation.scheduledTime,
        customerName: contract.reservation.customerName,
        customerEmail: contract.reservation.customerEmail,
        customerPhone: contract.reservation.customerPhone,
        customerCountry: contract.reservation.customerCountry,
        serviceName: contract.reservation.service?.name ?? null,
        serviceCategory: contract.reservation.service?.category ?? null,
        quantity: contract.reservation.quantity,
        pax: contract.reservation.pax,
        durationMinutes: contract.reservation.option?.durationMinutes ?? null,
        totalPriceCents: contract.reservation.totalPriceCents,
      },
      contract: {
        id: contract.id,
        unitIndex: contract.unitIndex,
        logicalUnitIndex: contract.logicalUnitIndex,
        driverName: contract.driverName,
        driverDocType: contract.driverDocType,
        driverDocNumber: contract.driverDocNumber,
        driverBirthDate: contract.driverBirthDate,
        driverAddress: contract.driverAddress,
        driverPostalCode: contract.driverPostalCode,
        driverPhone: contract.driverPhone,
        driverEmail: contract.driverEmail,
        driverCountry: contract.driverCountry,
        licenseSchool: contract.licenseSchool,
        licenseType: contract.licenseType,
        licenseNumber: contract.licenseNumber,
        minorAuthorizationProvided: contract.minorAuthorizationProvided,
        imageConsentAccepted: contract.imageConsentAccepted,
        minorAuthorizationFileKey: contract.minorAuthorizationFileKey,
        minorAuthorizationFileName: contract.minorAuthorizationFileName,
        signatureImageUrl: contract.signatureImageUrl,
        signatureSignedBy: contract.signatureSignedBy,
        signedAt: contract.signedAt,
        preparedJetski: contract.preparedJetski ?? null,
        preparedAsset: contract.preparedAsset ?? null,
      },
    });

  return (
    <SignContractPageClient
      token={token}
      language={language}
      contract={{
        id: contract.id,
        unitIndex: Number(contract.logicalUnitIndex ?? contract.unitIndex),
        status: contract.status,
        driverName: contract.driverName ?? "",
        signatureSignedBy: contract.signatureSignedBy ?? "",
        signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
        reservationId: contract.reservation.id,
        customerName: contract.reservation.customerName ?? "",
        serviceName: contract.reservation.service?.name ?? "",
        durationMinutes: contract.reservation.option?.durationMinutes ?? null,
        activityDate: contract.reservation.activityDate.toISOString(),
        renderedHtml,
      }}
    />
  );
}
