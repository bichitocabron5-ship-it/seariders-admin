import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { evaluateContractCheckinState } from "@/lib/contracts/public-checkin";
import {
  buildContractHtml,
  loadLogoSrc,
  templateCodeForContract,
} from "@/lib/contracts/render-contract";
import { normalizePublicLanguage } from "@/lib/public-links/i18n";
import { verifyReservationCheckinToken } from "@/lib/reservations/public-checkin-link";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import {
  countReadyVisibleContracts,
  pickVisibleContractsByLogicalUnit,
} from "@/lib/contracts/active-contracts";

export const runtime = "nodejs";

const NullableStr = z.string().optional().nullable();

const BodySchema = z.object({
  reservation: z.object({
    customerName: NullableStr,
    customerPhone: NullableStr,
    customerEmail: NullableStr,
    marketing: NullableStr,
    customerCountry: NullableStr,
    customerAddress: NullableStr,
    customerPostalCode: NullableStr,
    customerBirthDate: z.string().datetime().optional().nullable(),
    customerDocType: NullableStr,
    customerDocNumber: NullableStr,
  }),
  contracts: z.array(
    z.object({
      id: z.string().min(1),
      driverName: NullableStr,
      driverPhone: NullableStr,
      driverEmail: NullableStr,
      driverCountry: NullableStr,
      driverAddress: NullableStr,
      driverPostalCode: NullableStr,
      driverDocType: NullableStr,
      driverDocNumber: NullableStr,
      driverBirthDate: z.string().datetime().optional().nullable(),
      minorAuthorizationProvided: z.boolean().optional(),
      imageConsentAccepted: z.boolean().optional(),
      licenseSchool: NullableStr,
      licenseType: NullableStr,
      licenseNumber: NullableStr,
    })
  ),
});

function norm(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

async function getReservationSnapshot(reservationId: string, language: ReturnType<typeof normalizePublicLanguage>) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerCountry: true,
      customerAddress: true,
      customerPostalCode: true,
      customerBirthDate: true,
      customerDocType: true,
      customerDocNumber: true,
      marketing: true,
      isLicense: true,
      quantity: true,
      pax: true,
      totalPriceCents: true,
      activityDate: true,
      scheduledTime: true,
      service: { select: { name: true, category: true } },
      option: { select: { durationMinutes: true } },
      items: {
        select: {
          quantity: true,
          isExtra: true,
          service: { select: { category: true, code: true } },
        },
      },
      contracts: {
        orderBy: { unitIndex: "asc" },
        select: {
          id: true,
          unitIndex: true,
          logicalUnitIndex: true,
          status: true,
          supersededAt: true,
          createdAt: true,
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
          minorAuthorizationFileKey: true,
          minorAuthorizationFileName: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          imageConsentAccepted: true,
          signedAt: true,
          signatureSignedBy: true,
          signatureImageUrl: true,
          renderedHtml: true,
          renderedPdfKey: true,
          renderedPdfUrl: true,
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
        },
      },
    },
  });

  if (!reservation) return null;

  const requiredUnits = computeRequiredContractUnits({
    quantity: reservation.quantity ?? 0,
    isLicense: Boolean(reservation.isLicense),
    serviceCategory: reservation.service?.category ?? null,
    items: (reservation.items ?? []).map((item) => ({
      quantity: item.quantity ?? 0,
      isExtra: Boolean(item.isExtra),
      service: item.service ? { category: item.service.category ?? null, code: item.service.code ?? null } : null,
    })),
  });

  const visibleContracts = pickVisibleContractsByLogicalUnit(reservation.contracts ?? [], requiredUnits);
  const readyCount = countReadyVisibleContracts(reservation.contracts ?? [], requiredUnits);
  const signedCount = visibleContracts.filter((contract) => String(contract.status) === "SIGNED").length;
  const logoSrc = await loadLogoSrc();

  const contracts = visibleContracts.map((contract) => {
    const hasLicense =
      Boolean(contract.licenseNumber?.trim()) ||
      Boolean(reservation.isLicense);

    const renderedHtml = buildContractHtml({
      templateCode: templateCodeForContract({
        category: reservation.service?.category ?? null,
        hasLicense,
      }),
      templateVersion: "v1",
      language,
      logoSrc,
      reservation: {
        id: reservation.id,
        activityDate: reservation.activityDate,
        scheduledTime: reservation.scheduledTime,
        customerName: reservation.customerName,
        customerEmail: reservation.customerEmail,
        customerPhone: reservation.customerPhone,
        customerCountry: reservation.customerCountry,
        serviceName: reservation.service?.name ?? null,
        serviceCategory: reservation.service?.category ?? null,
        quantity: reservation.quantity,
        pax: reservation.pax,
        durationMinutes: reservation.option?.durationMinutes ?? null,
        totalPriceCents: reservation.totalPriceCents,
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

    return {
      id: contract.id,
      unitIndex: Number(contract.logicalUnitIndex ?? contract.unitIndex),
      status: contract.status,
      driverName: contract.driverName,
      driverPhone: contract.driverPhone,
      driverEmail: contract.driverEmail,
      driverCountry: contract.driverCountry,
      driverAddress: contract.driverAddress,
      driverPostalCode: contract.driverPostalCode,
      driverDocType: contract.driverDocType,
      driverDocNumber: contract.driverDocNumber,
      driverBirthDate: contract.driverBirthDate?.toISOString() ?? null,
      minorNeedsAuthorization: Boolean(contract.minorNeedsAuthorization),
      minorAuthorizationProvided: Boolean(contract.minorAuthorizationProvided),
      minorAuthorizationFileKey: contract.minorAuthorizationFileKey,
      minorAuthorizationFileName: contract.minorAuthorizationFileName,
      licenseSchool: contract.licenseSchool,
      licenseType: contract.licenseType,
      licenseNumber: contract.licenseNumber,
      imageConsentAccepted: Boolean(contract.imageConsentAccepted),
      signedAt: contract.signedAt?.toISOString() ?? null,
      signatureSignedBy: contract.signatureSignedBy,
      preparedResourceLabel: contract.preparedJetski
        ? `Moto ${contract.preparedJetski.number ?? "?"}${contract.preparedJetski.model ? ` · ${contract.preparedJetski.model}` : ""}${contract.preparedJetski.plate ? ` · ${contract.preparedJetski.plate}` : ""}`
        : contract.preparedAsset
          ? `${contract.preparedAsset.name ?? "Recurso asignado"}${contract.preparedAsset.type ? ` · ${contract.preparedAsset.type}` : ""}${contract.preparedAsset.plate ? ` · ${contract.preparedAsset.plate}` : ""}`
          : "Pendiente de asignación en tienda",
      renderedHtml,
    };
  });

  return {
    reservation: {
      id: reservation.id,
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      customerEmail: reservation.customerEmail,
      customerCountry: reservation.customerCountry,
      customerAddress: reservation.customerAddress,
      customerPostalCode: reservation.customerPostalCode,
      customerBirthDate: reservation.customerBirthDate?.toISOString() ?? null,
      customerDocType: reservation.customerDocType,
      customerDocNumber: reservation.customerDocNumber,
      marketing: reservation.marketing,
      isLicense: Boolean(reservation.isLicense),
      activityDate: reservation.activityDate.toISOString(),
      scheduledTime: reservation.scheduledTime?.toISOString() ?? null,
      serviceName: reservation.service?.name ?? "",
      serviceCategory: reservation.service?.category ?? null,
      durationMinutes: reservation.option?.durationMinutes ?? null,
      requiredUnits,
      readyCount,
      signedCount,
    },
    contracts,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));
  const payload = verifyReservationCheckinToken(token);
  if (!payload) return new NextResponse(language === "en" ? "Pre-check-in link is invalid or expired" : "Enlace de pre-checkin no valido o caducado", { status: 401 });

  const snapshot = await getReservationSnapshot(payload.reservationId, language);
  if (!snapshot) return new NextResponse(language === "en" ? "Booking not found" : "Reserva no encontrada", { status: 404 });

  return NextResponse.json({ ok: true, language, ...snapshot });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const language = normalizePublicLanguage(new URL(req.url).searchParams.get("lang"));
  const payload = verifyReservationCheckinToken(token);
  if (!payload) return new NextResponse(language === "en" ? "Pre-check-in link is invalid or expired" : "Enlace de pre-checkin no valido o caducado", { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(language === "en" ? "Invalid request body" : "Body invalido", { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: payload.reservationId },
        select: {
          id: true,
          customerName: true,
          customerCountry: true,
          isLicense: true,
          contracts: {
            select: {
              id: true,
              status: true,
              minorAuthorizationFileKey: true,
            },
          },
        },
      });

      if (!reservation) throw new Error("Reserva no encontrada");

      const reservationPatch = parsed.data.reservation;
      await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          customerName: norm(reservationPatch.customerName) ?? reservation.customerName,
          customerPhone: norm(reservationPatch.customerPhone),
          customerEmail: norm(reservationPatch.customerEmail),
          marketing: norm(reservationPatch.marketing),
          customerCountry: norm(reservationPatch.customerCountry) ?? reservation.customerCountry,
          customerAddress: norm(reservationPatch.customerAddress),
          customerPostalCode: norm(reservationPatch.customerPostalCode),
          customerBirthDate:
            reservationPatch.customerBirthDate === undefined
              ? undefined
              : reservationPatch.customerBirthDate
                ? new Date(reservationPatch.customerBirthDate)
                : null,
          customerDocType: norm(reservationPatch.customerDocType),
          customerDocNumber: norm(reservationPatch.customerDocNumber),
        },
      });

      const contractMap = new Map(reservation.contracts.map((contract) => [contract.id, contract]));

      for (const contractPatch of parsed.data.contracts) {
        const current = contractMap.get(contractPatch.id);
        if (!current) throw new Error("Uno de los contratos no pertenece a esta reserva.");
        if (String(current.status) === "SIGNED") continue;

        const nextDriverBirthDate =
          contractPatch.driverBirthDate === undefined
            ? undefined
            : contractPatch.driverBirthDate
              ? new Date(contractPatch.driverBirthDate)
              : null;

        const evaluation = evaluateContractCheckinState({
          isLicense: Boolean(reservation.isLicense),
          status: current.status,
          contract: {
            driverName: norm(contractPatch.driverName),
            driverPhone: norm(contractPatch.driverPhone),
            driverCountry: norm(contractPatch.driverCountry),
            driverAddress: norm(contractPatch.driverAddress),
            driverDocType: norm(contractPatch.driverDocType),
            driverDocNumber: norm(contractPatch.driverDocNumber),
            driverBirthDate: nextDriverBirthDate,
            minorAuthorizationProvided: contractPatch.minorAuthorizationProvided,
            minorAuthorizationFileKey: current.minorAuthorizationFileKey,
            licenseSchool: norm(contractPatch.licenseSchool),
            licenseType: norm(contractPatch.licenseType),
            licenseNumber: norm(contractPatch.licenseNumber),
          },
        });

        await tx.reservationContract.update({
          where: { id: contractPatch.id },
          data: {
            driverName: norm(contractPatch.driverName),
            driverPhone: norm(contractPatch.driverPhone),
            driverEmail: norm(contractPatch.driverEmail),
            driverCountry: norm(contractPatch.driverCountry),
            driverAddress: norm(contractPatch.driverAddress),
            driverPostalCode: norm(contractPatch.driverPostalCode),
            driverDocType: norm(contractPatch.driverDocType),
            driverDocNumber: norm(contractPatch.driverDocNumber),
            driverBirthDate: nextDriverBirthDate,
            minorAuthorizationProvided: contractPatch.minorAuthorizationProvided ?? false,
            imageConsentAccepted: contractPatch.imageConsentAccepted ?? false,
            imageConsentAcceptedAt: contractPatch.imageConsentAccepted ? new Date() : null,
            imageConsentAcceptedBy: contractPatch.imageConsentAccepted ? norm(contractPatch.driverName) : null,
            licenseSchool: norm(contractPatch.licenseSchool),
            licenseType: norm(contractPatch.licenseType),
            licenseNumber: norm(contractPatch.licenseNumber),
            minorNeedsAuthorization: evaluation.minorNeedsAuthorization,
            status: evaluation.nextStatus,
          },
        });
      }
    });

      const snapshot = await getReservationSnapshot(payload.reservationId, language);
    if (!snapshot) return new NextResponse(language === "en" ? "Booking not found" : "Reserva no encontrada", { status: 404 });
    return NextResponse.json({ ok: true, language, ...snapshot });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
