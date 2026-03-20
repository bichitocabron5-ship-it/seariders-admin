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
  const { category, hasLicense } = args;

  if (category === "JETSKI" && hasLicense) return "JETSKI_LICENSED";
  if (category === "JETSKI") return "JETSKI_STANDARD";
  if (category === "BOAT") return "BOAT_STANDARD";
  return "STANDARD_ACTIVITY";
}

function buildContractHtml(input: {
  templateCode: string;
  templateVersion: string;
  reservation: {
    id: string;
    activityDate: Date;
    scheduledTime: Date | null;
    customerName: string | null;
    serviceName: string | null;
    quantity: number;
    pax: number;
    customerEmail: string | null;
    customerPhone: string | null;
    customerCountry: string | null;
  };
  contract: {
    id: string;
    unitIndex: number;
    driverName: string | null;
    driverDocType: string | null;
    driverDocNumber: string | null;
    driverBirthDate: Date | null;
    driverAddress: string | null;
    driverPostalCode: string | null;
    driverPhone: string | null;
    driverEmail: string | null;
    driverCountry: string | null;
    licenseSchool: string | null;
    licenseType: string | null;
    licenseNumber: string | null;
    minorAuthorizationProvided: boolean;
  };
}) {
  const { templateCode, templateVersion, reservation, contract } = input;

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Contrato ${esc(contract.id)}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 32px;
      line-height: 1.45;
      font-size: 14px;
    }
    h1, h2, h3 { margin: 0 0 10px 0; }
    .muted { color: #555; }
    .box {
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px;
      margin: 12px 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
    }
    .label {
      font-size: 12px;
      color: #555;
      font-weight: bold;
      text-transform: uppercase;
    }
    .value {
      font-size: 14px;
      margin-top: 2px;
    }
    .sign {
      margin-top: 40px;
      border-top: 1px solid #999;
      width: 280px;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <h1>Contrato de actividad</h1>
  <div class="muted">Plantilla: ${esc(templateCode)} · Versión: ${esc(templateVersion)}</div>

  <div class="box">
    <h3>Reserva</h3>
    <div class="grid">
      <div>
        <div class="label">Reserva</div>
        <div class="value">${esc(reservation.id)}</div>
      </div>
      <div>
        <div class="label">Contrato / Unidad</div>
        <div class="value">#${esc(contract.unitIndex)}</div>
      </div>
      <div>
        <div class="label">Actividad</div>
        <div class="value">${esc(reservation.serviceName ?? "Actividad")}</div>
      </div>
      <div>
        <div class="label">Fecha</div>
        <div class="value">${esc(formatDate(reservation.scheduledTime ?? reservation.activityDate))}</div>
      </div>
      <div>
        <div class="label">Cantidad</div>
        <div class="value">${esc(reservation.quantity)}</div>
      </div>
      <div>
        <div class="label">PAX</div>
        <div class="value">${esc(reservation.pax)}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <h3>Conductor / firmante</h3>
    <div class="grid">
      <div>
        <div class="label">Nombre</div>
        <div class="value">${esc(contract.driverName)}</div>
      </div>
      <div>
        <div class="label">País</div>
        <div class="value">${esc(contract.driverCountry)}</div>
      </div>
      <div>
        <div class="label">Documento</div>
        <div class="value">${esc(contract.driverDocType)} ${esc(contract.driverDocNumber)}</div>
      </div>
      <div>
        <div class="label">Fecha nacimiento</div>
        <div class="value">${esc(formatDate(contract.driverBirthDate))}</div>
      </div>
      <div>
        <div class="label">Teléfono</div>
        <div class="value">${esc(contract.driverPhone)}</div>
      </div>
      <div>
        <div class="label">Email</div>
        <div class="value">${esc(contract.driverEmail)}</div>
      </div>
      <div style="grid-column: 1 / -1;">
        <div class="label">Dirección</div>
        <div class="value">${esc(contract.driverAddress)} ${esc(contract.driverPostalCode)}</div>
      </div>
    </div>
  </div>

  ${
    templateCode === "JETSKI_LICENSED" || contract.licenseNumber
      ? `
  <div class="box">
    <h3>Licencia</h3>
    <div class="grid">
      <div>
        <div class="label">Escuela</div>
        <div class="value">${esc(contract.licenseSchool)}</div>
      </div>
      <div>
        <div class="label">Tipo</div>
        <div class="value">${esc(contract.licenseType)}</div>
      </div>
      <div>
        <div class="label">Número</div>
        <div class="value">${esc(contract.licenseNumber)}</div>
      </div>
    </div>
  </div>
  `
      : ""
  }

  ${
    contract.minorAuthorizationProvided
      ? `
  <div class="box">
    <h3>Autorización</h3>
    <div class="value">Se declara que existe autorización válida para menor de edad.</div>
  </div>
  `
      : ""
  }

  <div class="box">
    <h3>Condiciones</h3>
    <p>
      El cliente declara que los datos son correctos, que conoce las normas de seguridad y
      acepta las condiciones de uso de la actividad contratada.
    </p>
  </div>

  <div class="sign">Firma cliente</div>
</body>
</html>
`.trim();
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

      const hasLicense = Boolean(contract.licenseNumber?.trim());
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