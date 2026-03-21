// src/app/api/store/contracts/[id]/render/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, AppSession } from "@/lib/session";

export const runtime = "nodejs";

async function requireStoreOrAdmin() {
  const cookieStore = await cookies();
  const session = await getIronSession<AppSession>(
    cookieStore as unknown as never,
    sessionOptions
  );

  if (!session?.userId) return null;
  if (session.role === "ADMIN" || session.role === "STORE") return session;
  return null;
}

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(v: Date | string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("es-ES");
}

function templateCodeForContract(args: {
  category: string | null | undefined;
  hasLicense: boolean;
}) {
  const category = (args.category ?? "").toUpperCase();

  if (category === "JETSKI" && args.hasLicense) return "JETSKI_LICENSED";
  if (category === "JETSKI") return "JETSKI_NO_LICENSE";
  if (category === "BOAT" && args.hasLicense) return "BOAT_LICENSED";

  throw new Error(`No hay plantilla para ${category} / license=${args.hasLicense}`);
}

type ContractRenderReservation = {
  activityDate: Date | string | null | undefined;
  pax: number | null | undefined;
};

type ContractRenderDriver = {
  driverName: string | null | undefined;
  driverDocNumber: string | null | undefined;
  driverAddress: string | null | undefined;
  driverEmail: string | null | undefined;
  driverPhone: string | null | undefined;
  licenseType: string | null | undefined;
  licenseNumber: string | null | undefined;
};

type ContractRenderInput = {
  templateCode: string;
  reservation: ContractRenderReservation;
  contract: ContractRenderDriver;
};

function buildContractHtml(input: ContractRenderInput) {
  switch (input.templateCode) {
    case "JETSKI_NO_LICENSE":
      return buildJetskiNoLicenseHtml(input);
    case "JETSKI_LICENSED":
    case "BOAT_LICENSED":
      return buildLicensedHtml(input);
    default:
      throw new Error(`Template no soportada: ${input.templateCode}`);
  }
}

function buildJetskiNoLicenseHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  return `
  <html>
  <body style="font-family: Arial; padding: 24px;">

    <h1>ALQUILER DE MOTOS ACUÁTICAS SIN LICENCIA</h1>

    <p><b>Nombre:</b> ${esc(contract.driverName)}</p>
    <p><b>DNI:</b> ${esc(contract.driverDocNumber)}</p>
    <p><b>Dirección:</b> ${esc(contract.driverAddress)}</p>
    <p><b>Fecha:</b> ${formatDate(reservation.activityDate)}</p>

    <p><b>Moto:</b> Se asigna en plataforma</p>
    <p><b>Duración:</b> ${esc(reservation.pax)} pax</p>

    <hr/>

    <p>El cliente declara aceptar las normas de navegación y condiciones.</p>

    <br/><br/>
    <div style="border-top:1px solid #000; width:200px;">Firma</div>

    <p><b>Fianza:</b> 100 €</p>

  </body>
  </html>
  `;
}

function buildLicensedHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  return `
  <html>
  <body style="font-family: Arial; padding: 24px;">

    <h1>CONTRATO DE MOTO DE AGUA / EMBARCACIÓN CON LICENCIA</h1>

    <h3>Arrendatario</h3>
    <p><b>Nombre:</b> ${esc(contract.driverName)}</p>
    <p><b>DNI:</b> ${esc(contract.driverDocNumber)}</p>
    <p><b>Email:</b> ${esc(contract.driverEmail)}</p>
    <p><b>Teléfono:</b> ${esc(contract.driverPhone)}</p>

    <h3>Embarcación</h3>
    <p><b>Modelo:</b> Moto preparada</p>
    <p><b>Matrícula:</b> _________</p>

    <h3>Periodo</h3>
    <p>${formatDate(reservation.activityDate)}</p>

    <h3>Licencia</h3>
    <p>${esc(contract.licenseType)} - ${esc(contract.licenseNumber)}</p>

    <hr/>

    <p>Condiciones legales del contrato según normativa vigente.</p>

    <br/><br/>
    <div style="border-top:1px solid #000; width:200px;">Firma</div>

    <p><b>Fianza:</b> 500 €</p>

  </body>
  </html>
  `;
}

export async function POST(
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireStoreOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contractId = id;

  try {
    const out = await prisma.$transaction(async (tx) => {
      const contract = await tx.reservationContract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          unitIndex: true,
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
              isLicense: true,
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

      if (!contract) {
        throw new Error("Contrato no encontrado");
      }

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
        reservation: {
          id: contract.reservation.id,
          activityDate: contract.reservation.activityDate,
          scheduledTime: contract.reservation.scheduledTime,
          customerName: contract.reservation.customerName,
          customerEmail: contract.reservation.customerEmail,
          customerPhone: contract.reservation.customerPhone,
          customerCountry: contract.reservation.customerCountry,
          serviceName: contract.reservation.service?.name ?? null,
          quantity: contract.reservation.quantity,
          pax: contract.reservation.pax,
        },
        contract: {
          id: contract.id,
          unitIndex: contract.unitIndex,
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
        },
      });

      const updated = await tx.reservationContract.update({
        where: { id: contractId },
        data: {
          templateCode,
          templateVersion,
          renderedHtml,
        },
        select: {
          id: true,
          templateCode: true,
          templateVersion: true,
          renderedHtml: true,
        },
      });

      return { ok: true, contract: updated };
    });

    return NextResponse.json(out);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return new NextResponse(message, { status: 400 });
  }
}
