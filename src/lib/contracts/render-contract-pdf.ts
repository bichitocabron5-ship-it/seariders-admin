// src/lib/contracts/render-contract-pdf.ts
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { prisma } from "@/lib/prisma";
import { buildContractPdfKey, uploadPdfToS3 } from "@/lib/s3";
import {
  buildContractHtml,
  loadLogoSrc,
  templateCodeForContract,
} from "@/lib/contracts/render-contract";
import type { PublicLanguage } from "@/lib/public-links/i18n";

async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function generateContractPdfFromHtml(
  html: string,
  language: PublicLanguage = "es"
) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const htmlWithAbsoluteLogo = html.replace(
      /src="\/logo-seariders\.png"/g,
      `src="${baseUrl}/logo-seariders.png"`
    );

    await page.setContent(htmlWithAbsoluteLogo, {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      margin: {
        top: "20mm",
        right: "12mm",
        bottom: "20mm",
        left: "12mm",
      },
      headerTemplate: `
        <div style="width:100%; font-size:9px; padding:0 12mm; color:#222; text-align:center;">
          UTE JETSKI CENTER- NOMAD NAUTIC | CIF: U16457343 | Tel: 608101272 | Email: seariderjetski@gmail.com | Direccion: C/ MARINA L-401 402, NUM 401 402 08330 PREMIA DE MAR - (BARCELONA)
        </div>
      `,
      footerTemplate: `
        <div style="width:100%; font-size:9px; padding:0 12mm; color:#444; display:flex; justify-content:flex-end;">
          ${language === "en" ? "Page" : "Pagina"} <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>
      `,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function generatePdf(html: string) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function regenerateSignedContractPdf(
  contractId: string,
  language: PublicLanguage = "es"
) {
  const logoSrc = await loadLogoSrc();

  const contract = await prisma.reservationContract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      reservationId: true,
      unitIndex: true,
      logicalUnitIndex: true,
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
          activityDate: true,
          scheduledTime: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerCountry: true,
          quantity: true,
          pax: true,
          totalPriceCents: true,
          isLicense: true,
          option: {
            select: {
              durationMinutes: true,
            },
          },
          service: {
            select: {
              name: true,
              category: true,
            },
          },
        },
      },
    },
  });

  if (!contract) throw new Error("Contrato no encontrado");

  const hasLicense =
    Boolean(contract.licenseNumber?.trim()) ||
    Boolean(contract.reservation.isLicense);

  const templateCode = templateCodeForContract({
    category: contract.reservation.service?.category ?? null,
    hasLicense,
  });

  const templateVersion = "v1";

  const renderedHtml = buildContractHtml({
    templateCode,
    templateVersion,
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
      preparedJetski: contract.preparedJetski ?? null,
      preparedAsset: contract.preparedAsset ?? null,
      signatureImageUrl: contract.signatureImageUrl,
      signatureSignedBy: contract.signatureSignedBy,
      signedAt: contract.signedAt,
    },
  });

  const pdfBuffer = await generateContractPdfFromHtml(renderedHtml, language);

  const uploaded = await uploadPdfToS3({
    key: buildContractPdfKey({
      reservationId: contract.reservationId,
      contractId: contract.id,
      displayName: contract.driverName ?? contract.reservation.customerName,
    }),
    body: pdfBuffer,
    contentType: "application/pdf",
  });

  const updated = await prisma.reservationContract.update({
    where: { id: contract.id },
    data: {
      templateCode,
      templateVersion,
      renderedHtml,
      renderedPdfKey: uploaded.key,
      renderedPdfUrl: uploaded.url,
    },
    select: {
      id: true,
      status: true,
      signedAt: true,
      renderedPdfKey: true,
      renderedPdfUrl: true,
    },
  });

  return updated;
}
