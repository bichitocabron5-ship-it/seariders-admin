// src/app/api/store/reservations/[id]/contracts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { OperationalOverrideAction, OperationalOverrideTarget } from "@prisma/client";
import { sessionOptions, AppSession } from "@/lib/session";
import {
  countReadyVisibleContractsByTargets,
  pickVisibleContractsByTargets,
} from "@/lib/contracts/active-contracts";
import { resolveReadyContractCountWithManualAttachments } from "@/lib/manual-contract-attachments";
import {
  buildReservationContractRequirements,
  reservationContractRequirementsToSyncTargets,
} from "@/lib/reservation-contract-requirements";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params); // FIX Next params Promise

  const res = await prisma.reservation.findUnique({
    where: { id },
    select: {
      id: true,
      isLicense: true,
      quantity: true,
      serviceId: true,
      optionId: true,
      pax: true,
      totalPriceCents: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },

      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerCountry: true,
      customerAddress: true,
      customerPostalCode: true,
      customerDocType: true,
      customerDocNumber: true,

      licenseSchool: true,
      licenseType: true,
      licenseNumber: true,

      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
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
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          reservationItemId: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          templateCode: true,
          templateVersion: true,

          driverName: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          driverAddress: true,
          driverPostalCode: true,
          driverDocType: true,
          driverDocNumber: true,

          driverBirthDate: true,
          minorNeedsAuthorization: true,
          minorAuthorizationProvided: true,

          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,

          signedAt: true,
          renderedHtml: true,
          signatureImageUrl: true,
          signatureImageKey: true,
          signatureSignedBy: true,
          signatureRequestId: true,
          signatureStatusRaw: true,
          signaturePayloadJson: true,
          signatureSignedPdfUrl: true,
          signatureAuditJson: true,
          updatedAt: true,
          createdAt: true,
          renderedPdfKey: true,
          renderedPdfUrl: true,

          imageConsentAccepted: true,
          imageConsentAcceptedAt: true,
          imageConsentAcceptedBy: true,

          minorAuthorizationFileKey: true,
          minorAuthorizationFileUrl: true,
          minorAuthorizationFileName: true,
          minorAuthorizationUploadedAt: true,

          preparedJetskiId: true,
          preparedAssetId: true,

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
          notifications: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              status: true,
              provider: true,
              recipientPhone: true,
              linkUrl: true,
              errorMessage: true,
              createdAt: true,
              sentAt: true,
            },
          },
        },
      },
    },
  });

  if (!res) return new NextResponse("Reserva no existe", { status: 404 });

  const contractRequirements = buildReservationContractRequirements({
    quantity: res.quantity ?? 0,
    isLicense: Boolean(res.isLicense),
    serviceCategory: res.service?.category ?? null,
    serviceId: res.serviceId,
    optionId: res.optionId,
    serviceName: res.service?.name ?? null,
    durationMinutes: res.option?.durationMinutes ?? null,
    pax: res.pax,
    totalPriceCents: res.totalPriceCents,
    items: res.items ?? [],
  });
  const syncTargets = reservationContractRequirementsToSyncTargets(contractRequirements);
  const requiredUnits = contractRequirements.length;

  // Solo contamos contratos de 1..requiredUnits (ignora legacy unitIndex 0 y sobrantes).
  const contracts = pickVisibleContractsByTargets(res.contracts ?? [], syncTargets);
  const manualAttachmentCount =
    requiredUnits > 0
      ? await prisma.operationalOverrideLog.count({
          where: {
            targetType: OperationalOverrideTarget.RESERVATION,
            action: OperationalOverrideAction.MANUAL_RESERVATION_CREATE,
            targetId: res.id,
            reason: "Adjunto contrato manual",
          },
        })
      : 0;
  const readyCount = resolveReadyContractCountWithManualAttachments({
    requiredUnits,
    readyContractsCount: countReadyVisibleContractsByTargets(res.contracts ?? [], syncTargets),
    manualAttachmentCount,
  });

  const needsContracts = requiredUnits > 0 && readyCount < requiredUnits;

  const contractsState: "OK" | "PARTIAL" | "MISSING" =
    requiredUnits <= 0 ? "OK" : readyCount >= requiredUnits ? "OK" : readyCount > 0 ? "PARTIAL" : "MISSING";

  const response = {
    ok: true,
    reservationId: res.id,
    reservation: {
      id: res.id,
      isLicense: res.isLicense,
      quantity: res.quantity,

      customerName: res.customerName,
      customerPhone: res.customerPhone,
      customerEmail: res.customerEmail,
      customerCountry: res.customerCountry,
      customerAddress: res.customerAddress,
      customerPostalCode: res.customerPostalCode,
      customerDocType: res.customerDocType,
      customerDocNumber: res.customerDocNumber,

      licenseSchool: res.licenseSchool,
      licenseType: res.licenseType,
      licenseNumber: res.licenseNumber,
    },

    // Nuevo: métricas "fuente de verdad" para badge
    requiredUnits,
    readyCount,
    needsContracts,
    contractsState,

    // Contratos ya filtrados
    contracts,
  };

  return NextResponse.json(response);
}
