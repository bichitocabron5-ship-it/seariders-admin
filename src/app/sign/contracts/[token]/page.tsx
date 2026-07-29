import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyContractSignatureToken } from "@/lib/contracts/signature-link";
import {
  buildContractHtml,
  loadLogoSrc,
} from "@/lib/contracts/render-contract";
import { resolveContractRenderLanguage } from "@/lib/contracts/language";
import { evaluatePublicContractAccess } from "@/lib/contracts/public-contract-access";
import { resolveContractRenderContext } from "@/lib/contracts/render-context";
import { buildPublicPageMetadata } from "@/lib/metadata";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";
import { SignContractPageClient } from "./sign-contract-page-client";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return buildPublicPageMetadata({
    title: "Firma de contrato SeaRiders",
    description: "Firma publica y segura de contratos dentro del ecosistema SeaRiders.",
    path: `/sign/contracts/${encodeURIComponent(token)}`,
  });
}

export default async function SignContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const requestedLanguage = normalizePublicLanguage(lang);
  const payload = verifyContractSignatureToken(token);
  if (!payload) notFound();

  const contract = await prisma.reservationContract.findUnique({
    where: { id: payload.contractId },
    select: {
      id: true,
      reservationId: true,
      reservationItemId: true,
      templateCode: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
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
      signedLanguage: true,
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
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          totalPriceCents: true,
          isLicense: true,
          service: { select: { name: true, category: true } },
          activityDate: true,
          scheduledTime: true,
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              reservationId: true,
              serviceId: true,
              optionId: true,
              quantity: true,
              pax: true,
              totalPriceCents: true,
              isExtra: true,
              service: { select: { name: true, category: true } },
              option: { select: { durationMinutes: true } },
            },
          },
          contracts: {
            select: {
              id: true,
              reservationId: true,
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
      reservationItem: {
        select: {
          id: true,
          reservationId: true,
          serviceId: true,
          optionId: true,
          quantity: true,
          pax: true,
          totalPriceCents: true,
          option: { select: { durationMinutes: true } },
          service: { select: { name: true, category: true } },
        },
      },
    },
  });

  if (!contract) notFound();
  const access = evaluatePublicContractAccess({
    reservation: contract.reservation,
    contract,
  });
  if (!access.ok) notFound();

  const language = resolveContractRenderLanguage({
    requestedLanguage,
    signedLanguage: contract.signedLanguage,
  });

  const logoSrc = await loadLogoSrc();
  const renderContext = resolveContractRenderContext(contract);
  const renderedHtml = buildContractHtml({
    templateCode: renderContext.templateCode,
    templateVersion: "v1",
    language,
    logoSrc,
    reservation: renderContext.reservation,
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
