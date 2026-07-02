// src/app/api/store/reservations/[id]/contracts/ensure/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { countReadyVisibleContracts, pickVisibleContractsByLogicalUnit } from "@/lib/contracts/active-contracts";
import {
  ReservationContractSyncBlockedError,
  resolveReservationContractSyncTarget,
  syncReservationContractsTx,
} from "@/lib/reservation-contract-sync";
import {
  RESERVATION_CONTRACT_DEBUG,
  debugReservationContractFlow,
  summarizeReservationContractsDebug,
} from "@/lib/reservation-contract-debug";

export const runtime = "nodejs";

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);
  const debugBody = RESERVATION_CONTRACT_DEBUG
    ? await req.clone().json().catch(() => null)
    : null;

  debugReservationContractFlow("contracts.ensure.request", {
    reservationId: id,
    method: req.method,
    url: req.url,
    body: debugBody,
  });

  try {
    const out = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.findUnique({
        where: { id },
        select: {
          id: true,
          quantity: true,
          isLicense: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          customerCountry: true,
          customerAddress: true,
          customerPostalCode: true,
          customerBirthDate: true,
          customerDocType: true,
          customerDocNumber: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          service: { select: { category: true } },
          items: {
            select: {
              quantity: true,
              isExtra: true,
              service: { select: { category: true, code: true } },
            },
          },
          contracts: {
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
              licenseSchool: true,
              licenseType: true,
              licenseNumber: true,
            },
          },
        },
      });

      if (!res) throw new Error("Reserva no existe");

      const requiredUnits = computeRequiredContractUnits({
        quantity: res.quantity ?? 0,
        isLicense: Boolean(res.isLicense),
        serviceCategory: res.service?.category ?? null,
        items: (res.items ?? []).map((it) => ({
          quantity: it.quantity ?? 0,
          isExtra: Boolean(it.isExtra),
          service: it.service ? { category: it.service.category ?? null, code: it.service.code ?? null } : null,
        })),
      });

      const existingContracts = res.contracts ?? [];
      const hasUnitOne = existingContracts.some((c) => Number(c.unitIndex) === 1);

      // Compat legacy: si existe contrato principal en unitIndex 0, se reutiliza como #1.
      if (requiredUnits > 0 && !hasUnitOne) {
        const legacyPrimary = existingContracts
          .filter((c) => Number(c.unitIndex) <= 0)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        if (legacyPrimary) {
          await tx.reservationContract.update({
            where: { id: legacyPrimary.id },
            data: { unitIndex: 1, logicalUnitIndex: 1 },
          });
        }
      }

      await syncReservationContractsTx(tx, {
        reservationId: id,
        requiredUnits,
        ...resolveReservationContractSyncTarget({
          serviceCategory: res.service?.category ?? null,
          isLicense: Boolean(res.isLicense),
        }),
      });

      const rowsAfterSync = await tx.reservationContract.findMany({
        where: { reservationId: id },
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
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
        },
      });

      const visibleDraftContracts = rowsAfterSync.filter((contract) => {
        const slot = Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
        return !contract.supersededAt && contract.status === "DRAFT" && slot >= 1 && slot <= requiredUnits;
      });

      await Promise.all(
        visibleDraftContracts.map(async (contract) => {
          const slot = Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
          if (slot !== 1) return;

          const patch = {
            driverName: normalizeOptionalString(contract.driverName) ?? normalizeOptionalString(res.customerName),
            driverPhone: normalizeOptionalString(contract.driverPhone) ?? normalizeOptionalString(res.customerPhone),
            driverEmail: normalizeOptionalString(contract.driverEmail) ?? normalizeOptionalString(res.customerEmail),
            driverCountry: normalizeOptionalString(contract.driverCountry) ?? normalizeOptionalString(res.customerCountry),
            driverAddress: normalizeOptionalString(contract.driverAddress) ?? normalizeOptionalString(res.customerAddress),
            driverPostalCode: normalizeOptionalString(contract.driverPostalCode) ?? normalizeOptionalString(res.customerPostalCode),
            driverDocType: normalizeOptionalString(contract.driverDocType) ?? normalizeOptionalString(res.customerDocType),
            driverDocNumber: normalizeOptionalString(contract.driverDocNumber) ?? normalizeOptionalString(res.customerDocNumber),
            driverBirthDate: contract.driverBirthDate ?? res.customerBirthDate ?? null,
            licenseSchool:
              normalizeOptionalString(contract.licenseSchool) ??
              (res.isLicense ? normalizeOptionalString(res.licenseSchool) : null),
            licenseType:
              normalizeOptionalString(contract.licenseType) ??
              (res.isLicense ? normalizeOptionalString(res.licenseType) : null),
            licenseNumber:
              normalizeOptionalString(contract.licenseNumber) ??
              (res.isLicense ? normalizeOptionalString(res.licenseNumber) : null),
          };

          const changed =
            patch.driverName !== contract.driverName ||
            patch.driverPhone !== contract.driverPhone ||
            patch.driverEmail !== contract.driverEmail ||
            patch.driverCountry !== contract.driverCountry ||
            patch.driverAddress !== contract.driverAddress ||
            patch.driverPostalCode !== contract.driverPostalCode ||
            patch.driverDocType !== contract.driverDocType ||
            patch.driverDocNumber !== contract.driverDocNumber ||
            patch.driverBirthDate?.getTime?.() !== contract.driverBirthDate?.getTime?.() ||
            patch.licenseSchool !== contract.licenseSchool ||
            patch.licenseType !== contract.licenseType ||
            patch.licenseNumber !== contract.licenseNumber;

          if (!changed) return;

          await tx.reservationContract.update({
            where: { id: contract.id },
            data: patch,
          });
        })
      );

      const contracts = await tx.reservationContract.findMany({
        where: { reservationId: id },
        orderBy: { unitIndex: "asc" },
        select: { id: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
      });

      const visibleContracts = pickVisibleContractsByLogicalUnit(contracts, requiredUnits);
      const readyCount = countReadyVisibleContracts(contracts, requiredUnits);

      return { reservationId: id, requiredUnits, readyCount, contracts: visibleContracts };
    });

    const response = { ok: true, ...out };
    debugReservationContractFlow("contracts.ensure.response", {
      reservationId: id,
      requiredUnits: out.requiredUnits,
      readyCount: out.readyCount,
      returnedContractsCount: out.contracts.length,
      returnedContracts: summarizeReservationContractsDebug(out.contracts),
    });

    return NextResponse.json(response);
  } catch (e: unknown) {
    if (e instanceof ReservationContractSyncBlockedError) {
      return NextResponse.json(
        { error: e.code, message: e.message, blockers: e.blockers },
        { status: e.status }
      );
    }

    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

