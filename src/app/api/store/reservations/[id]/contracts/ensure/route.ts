// src/app/api/store/reservations/[id]/contracts/ensure/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { computeRequiredContractUnits } from "@/lib/reservation-rules";
import { countReadyVisibleContracts, listMissingLogicalUnits, pickVisibleContractsByLogicalUnit } from "@/lib/contracts/active-contracts";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await Promise.resolve(ctx.params);

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
            select: { id: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
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

      // Si no requiere contratos, devolvemos ok (pero dejamos endpoint idempotente)
      if (requiredUnits <= 0) {
        return {
          reservationId: id,
          requiredUnits: 0,
          readyCount: 0,
          contracts: [] as Array<{ id: string; unitIndex: number; status: string }>,
        };
      }

      const existingContracts = res.contracts ?? [];
      const hasUnitOne = existingContracts.some((c) => Number(c.unitIndex) === 1);

      // Compat legacy: si existe contrato principal en unitIndex 0, se reutiliza como #1.
      if (!hasUnitOne) {
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

      const existingRows = await tx.reservationContract.findMany({
        where: { reservationId: id },
        select: { unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
      });
      const missingSlots = listMissingLogicalUnits(existingRows, requiredUnits);
      const maxUnitIndex = Math.max(0, ...existingRows.map((c) => Number(c.unitIndex ?? 0)));
      const toCreate: Array<{
        reservationId: string;
        unitIndex: number;
        logicalUnitIndex: number;
        driverName: string | null;
        driverPhone: string | null;
        driverEmail: string | null;
        driverCountry: string | null;
        driverAddress: string | null;
        driverPostalCode: string | null;
        driverDocType: string | null;
        driverDocNumber: string | null;
        driverBirthDate: Date | null;
        licenseSchool: string | null;
        licenseType: string | null;
        licenseNumber: string | null;
      }> = missingSlots.map((slot, idx) => ({
        reservationId: id,
        unitIndex: maxUnitIndex + idx + 1,
        logicalUnitIndex: slot,
        driverName: res.customerName ?? null,
        driverPhone: res.customerPhone ?? null,
        driverEmail: res.customerEmail ?? null,
        driverCountry: res.customerCountry ?? null,
        driverAddress: res.customerAddress ?? null,
        driverPostalCode: res.customerPostalCode ?? null,
        driverDocType: res.customerDocType ?? null,
        driverDocNumber: res.customerDocNumber ?? null,
        driverBirthDate: res.customerBirthDate ?? null,
        licenseSchool: res.isLicense ? res.licenseSchool ?? null : null,
        licenseType: res.isLicense ? res.licenseType ?? null : null,
        licenseNumber: res.isLicense ? res.licenseNumber ?? null : null,
      }));

      if (toCreate.length) {
        await tx.reservationContract.createMany({
          data: toCreate,
          skipDuplicates: true, // idempotente
        });
      }

      const contracts = await tx.reservationContract.findMany({
        where: { reservationId: id },
        orderBy: { unitIndex: "asc" },
        select: { id: true, unitIndex: true, logicalUnitIndex: true, status: true, supersededAt: true, createdAt: true },
      });

      const visibleContracts = pickVisibleContractsByLogicalUnit(contracts, requiredUnits);
      const readyCount = countReadyVisibleContracts(contracts, requiredUnits);

      return { reservationId: id, requiredUnits, readyCount, contracts: visibleContracts };
    });

    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}

