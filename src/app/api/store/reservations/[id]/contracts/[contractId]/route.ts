// src/app/api/store/reservations/[id]/contracts/[contractId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";
import { z } from "zod";
import { ContractStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(cookieStore as unknown as never, sessionOptions);
  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

const NullableStr = z.string().optional().nullable();

const Body = z.object({
  status: z.nativeEnum(ContractStatus).optional(),

  driverName: NullableStr,
  driverPhone: NullableStr,
  driverEmail: NullableStr,
  driverCountry: NullableStr,
  driverAddress: NullableStr,
  driverPostalCode: NullableStr,
  driverDocType: NullableStr,
  driverDocNumber: NullableStr,

  // NUEVO
  driverBirthDate: z.string().datetime().optional().nullable(), // ISO string
  minorAuthorizationProvided: z.boolean().optional(),
  imageConsentAccepted: z.boolean().optional(),
  preparedJetskiId: z.string().optional().nullable(),
  preparedAssetId: z.string().optional().nullable(),

  licenseSchool: NullableStr,
  licenseType: NullableStr,
  licenseNumber: NullableStr,
});

function norm(v: string | null | undefined) {
  if (v === undefined) return undefined; // no tocar
  if (v === null) return null; // borrar
  const t = String(v).trim();
  return t.length ? t : null;
}

function must(s: unknown) {
  return String(s ?? "").trim().length > 0;
}

function ageAtDate(birth: Date, at: Date) {
  let age = at.getUTCFullYear() - birth.getUTCFullYear();
  const m = at.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

function minorRules(birth: Date, at: Date) {
  const age = ageAtDate(birth, at);
  return {
    age,
    isUnder16: age < 16,
    needsAuthorization: age >= 16 && age < 18,
  };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; contractId: string }> } // incluye reservation id
) {
  const session = await requireStoreOrAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: reservationId, contractId } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return new NextResponse("Body inválido", { status: 400 });
  const b = parsed.data;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const current = await tx.reservationContract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          reservationId: true,
          status: true,
          driverName: true,
          reservation: { select: { id: true, isLicense: true } },
        },
      });

      if (!current) throw new Error("Contrato no existe");

      // Seguridad / coherencia: el contrato debe pertenecer a la reserva de la URL
      if (current.reservationId !== reservationId) {
        throw new Error("Contrato no pertenece a esta reserva");
      }

      if (current.status === ContractStatus.SIGNED) {
        throw new Error("Contrato ya firmado. No se puede modificar.");
      }

      const data: Prisma.ReservationContractUpdateInput = {};

      const driverName = norm(b.driverName);
      if (driverName !== undefined) data.driverName = driverName;
      const driverPhone = norm(b.driverPhone);
      if (driverPhone !== undefined) data.driverPhone = driverPhone;
      const driverEmail = norm(b.driverEmail);
      if (driverEmail !== undefined) data.driverEmail = driverEmail;
      const driverCountry = norm(b.driverCountry);
      if (driverCountry !== undefined) data.driverCountry = driverCountry;
      const driverAddress = norm(b.driverAddress);
      if (driverAddress !== undefined) data.driverAddress = driverAddress;
      const driverPostalCode = norm(b.driverPostalCode);
      if (driverPostalCode !== undefined) data.driverPostalCode = driverPostalCode;
      const driverDocType = norm(b.driverDocType);
      if (driverDocType !== undefined) data.driverDocType = driverDocType;
      const driverDocNumber = norm(b.driverDocNumber);
      if (driverDocNumber !== undefined) data.driverDocNumber = driverDocNumber;
      const licenseSchool = norm(b.licenseSchool);
      if (licenseSchool !== undefined) data.licenseSchool = licenseSchool;
      const licenseType = norm(b.licenseType);
      if (licenseType !== undefined) data.licenseType = licenseType;
      const licenseNumber = norm(b.licenseNumber);
      if (licenseNumber !== undefined) data.licenseNumber = licenseNumber;

      if (b.driverBirthDate !== undefined) data.driverBirthDate = b.driverBirthDate ? new Date(b.driverBirthDate) : null;
      if (b.minorAuthorizationProvided !== undefined) data.minorAuthorizationProvided = b.minorAuthorizationProvided;

      if (b.preparedJetskiId !== undefined) {
        if (b.preparedJetskiId) {
          data.preparedJetski = { connect: { id: b.preparedJetskiId } };
          data.preparedAsset = { disconnect: true };
        } else {
          data.preparedJetski = { disconnect: true };
        }
      }

      if (b.preparedAssetId !== undefined) {
        if (b.preparedAssetId) {
          data.preparedAsset = { connect: { id: b.preparedAssetId } };
          data.preparedJetski = { disconnect: true };
        } else {
          data.preparedAsset = { disconnect: true };
        }
      }

      if (b.imageConsentAccepted !== undefined) {
        data.imageConsentAccepted = b.imageConsentAccepted;
        data.imageConsentAcceptedAt = b.imageConsentAccepted ? new Date() : null;
        data.imageConsentAcceptedBy = b.imageConsentAccepted
          ? (norm(b.driverName) ?? current.driverName ?? null)
          : null;
      }
      
      if (b.status !== undefined) data.status = b.status;

      const updated = await tx.reservationContract.update({
        where: { id: contractId },
        data,
        select: {
          id: true,
          reservationId: true,
          unitIndex: true,
          status: true,
          driverName: true,
          driverPhone: true,
          driverEmail: true,
          driverCountry: true,
          driverAddress: true,
          driverPostalCode: true,
          driverDocType: true,
          driverDocNumber: true,
          driverBirthDate: true,
          minorAuthorizationProvided: true,
          minorAuthorizationFileKey: true,
          minorNeedsAuthorization: true,
          licenseSchool: true,
          licenseType: true,
          licenseNumber: true,
          updatedAt: true,
        },
      });

      // Regla PRO: si se marca READY, validamos que está completo
      if (updated.status === ContractStatus.READY) {
        const baseOk =
          must(updated.driverName) &&
          must(updated.driverCountry) &&
          must(updated.driverAddress) &&
          must(updated.driverDocType) &&
          must(updated.driverDocNumber);

        if (!baseOk) {
          await tx.reservationContract.update({
            where: { id: contractId },
            data: { status: ContractStatus.DRAFT },
            select: { id: true },
          });
          throw new Error("Para marcar READY faltan datos del conductor/documento.");
        }

        if (current.reservation.isLicense) {
          const licOk = must(updated.licenseSchool) && must(updated.licenseType) && must(updated.licenseNumber);
          if (!licOk) {
            await tx.reservationContract.update({
              where: { id: contractId },
              data: { status: ContractStatus.DRAFT },
              select: { id: true },
            });
            throw new Error("Para marcar READY faltan datos de licencia.");
          }
        }
          // NUEVO: birthDate obligatorio para READY
          if (!updated.driverBirthDate) {
            await tx.reservationContract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } });
            throw new Error("Para marcar READY falta la fecha de nacimiento.");
          }

          const rule = minorRules(updated.driverBirthDate, new Date());

          // <16 => no permitido
          if (rule.isUnder16) {
            await tx.reservationContract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } });
            throw new Error("Menor de 16: no se puede formalizar este contrato.");
          }

          // 16-17 => requiere autorizacion marcada
          if (rule.needsAuthorization && !updated.minorAuthorizationProvided) {
            await tx.reservationContract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } });
            throw new Error("Menor (16-17): falta autorizacion.");
          }

          if (rule.needsAuthorization && !updated.minorAuthorizationFileKey) {
            await tx.reservationContract.update({ where: { id: contractId }, data: { status: ContractStatus.DRAFT } });
            throw new Error("Para menor de edad es obligatorio adjuntar la autorización del padre/madre/tutor.");
          }

          // cache para UI (opcional)
          await tx.reservationContract.update({
            where: { id: contractId },
            data: {
              minorNeedsAuthorization: rule.needsAuthorization,
            },
          });
        }

      return updated;
    });

    return NextResponse.json({ ok: true, contract: out });
  } catch (e: unknown) {
    return new NextResponse(e instanceof Error ? e.message : "Error", { status: 400 });
  }
}


