// src/app/api/store/reservations/[id]/contracts/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { countReadyVisibleContracts, pickVisibleContractsByLogicalUnit } from "@/lib/contracts/active-contracts";

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
      service: { select: { category: true } },

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
        select: {
          quantity: true,
          isExtra: true, 
          service: { select: { category: true } },
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
          signatureImageUrl: true,
          signatureImageKey: true,
          signatureSignedBy: true,
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
        },
      },
    },
  });

  if (!res) return new NextResponse("Reserva no existe", { status: 404 });

  const requiredUnits = computeRequiredContractUnits({
    quantity: res.quantity ?? 0,
    isLicense: Boolean(res.isLicense),
    serviceCategory: res.service?.category ?? null,
    items: (res.items ?? []).map((it) => ({
      quantity: it.quantity ?? 0,
      isExtra: Boolean(it.isExtra),
      service: it.service ? { category: it.service.category ?? null } : null,
    })),
  });

  // Solo contamos contratos de 1..requiredUnits (ignora legacy unitIndex 0 y sobrantes).
  const contracts = pickVisibleContractsByLogicalUnit(res.contracts ?? [], requiredUnits);
  const readyCount = countReadyVisibleContracts(res.contracts ?? [], requiredUnits);

  const needsContracts = requiredUnits > 0 && readyCount < requiredUnits;

  const contractsState: "OK" | "PARTIAL" | "MISSING" =
    requiredUnits <= 0 ? "OK" : readyCount >= requiredUnits ? "OK" : readyCount > 0 ? "PARTIAL" : "MISSING";

  return NextResponse.json({
    ok: true,
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
  });
}

