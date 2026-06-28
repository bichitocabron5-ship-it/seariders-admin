import fs from "node:fs/promises";
import path from "node:path";
import type { PublicLanguage } from "@/lib/public-links/i18n";
import { translateContractHtml } from "@/lib/contracts/render-contract-i18n";

export type ContractRenderReservation = {
  id: string;
  activityDate: Date | string | null | undefined;
  scheduledTime: Date | string | null | undefined;
  customerName: string | null | undefined;
  customerEmail: string | null | undefined;
  customerPhone: string | null | undefined;
  customerCountry: string | null | undefined;
  serviceName: string | null | undefined;
  serviceCategory: string | null | undefined;
  quantity: number | null | undefined;
  pax: number | null | undefined;
  durationMinutes: number | null | undefined;
  totalPriceCents: number | null | undefined;
};

export type ContractRenderDriver = {
  id: string;
  unitIndex: number;
  logicalUnitIndex?: number | null | undefined;
  driverName: string | null | undefined;
  driverDocType: string | null | undefined;
  driverDocNumber: string | null | undefined;
  driverBirthDate: Date | string | null | undefined;
  driverAddress: string | null | undefined;
  driverPostalCode: string | null | undefined;
  driverEmail: string | null | undefined;
  driverPhone: string | null | undefined;
  driverCountry: string | null | undefined;
  licenseSchool: string | null | undefined;
  licenseType: string | null | undefined;
  licenseNumber: string | null | undefined;
  minorAuthorizationProvided: boolean | null | undefined;
  imageConsentAccepted?: boolean | null | undefined;
  minorAuthorizationFileKey?: string | null | undefined;
  minorAuthorizationFileName?: string | null | undefined;
  signatureImageUrl?: string | null | undefined;
  signatureSignedBy?: string | null | undefined;
  signedAt?: Date | string | null | undefined;
  preparedJetski?: {
    id: string;
    number: number | null;
    model: string | null;
    plate: string | null;
  } | null;
  preparedAsset?: {
    id: string;
    name: string | null;
    type: string | null;
    plate: string | null;
  } | null;
};

export type ContractRenderInput = {
  templateCode: string;
  templateVersion: string;
  language?: PublicLanguage;
  logoSrc: string;
  reservation: ContractRenderReservation;
  contract: ContractRenderDriver;
};

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

export function templateCodeForContract(args: {
  category: string | null | undefined;
  hasLicense: boolean;
}) {
  const category = (args.category ?? "").toUpperCase();

  if (category === "JETSKI" && args.hasLicense) return "JETSKI_LICENSED";
  if (category === "JETSKI") return "JETSKI_NO_LICENSE";
  if (category === "BOAT" && args.hasLicense) return "BOAT_LICENSED";

  throw new Error(`No hay plantilla para ${category} / license=${args.hasLicense}`);
}

let logoSrcCache: string | null = null;

export async function loadLogoSrc() {
  if (logoSrcCache) return logoSrcCache;

  const logoPath = path.join(process.cwd(), "public", "logo-seariders.png");
  const logoBuffer = await fs.readFile(logoPath);
  logoSrcCache = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  return logoSrcCache;
}

function formatTime(v: Date | string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eurosFromCents(cents: number | null | undefined) {
  const n = Number(cents ?? 0);
  return `${(n / 100).toFixed(2)} €`;
}

function safeUpper(v: string | null | undefined) {
  return String(v ?? "").trim().toUpperCase();
}

function addMinutes(v: Date | string | null | undefined, minutes: number | null | undefined) {
  if (!v || !minutes) return null;
  const d = new Date(v);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function preparedResourceSummary(contract: ContractRenderDriver) {
  if (contract.preparedJetski) {
    return {
      kind: "MOTO ACUATICA",
      name: `${contract.preparedJetski.model ?? "MOTO"}${contract.preparedJetski.number ? ` ${contract.preparedJetski.number}` : ""}`.trim(),
      plate: contract.preparedJetski.plate ?? "",
    };
  }

  if (contract.preparedAsset) {
    return {
      kind: contract.preparedAsset.type ? `ASSET ${contract.preparedAsset.type}` : "ASSET",
      name: contract.preparedAsset.name ?? "EMBARCACIÓN",
      plate: contract.preparedAsset.plate ?? "",
    };
  }

  return {
    kind: "RECURSO",
    name: "PENDIENTE DE ASIGNACIÓN",
    plate: "",
  };
}

function fixMojibake(html: string) {
  return html
    .replaceAll("\u00C2\u00B7", "\u00B7")
    .replaceAll("\u00E2\u20AC\u201D", "\u2014")
    .replaceAll("\u00E2\u201A\u00AC", "\u20AC")
    .replaceAll("\u00E2\u20AC\u00A2", "\u2022")
    .replaceAll("\u00C3\u00A1", "\u00E1")
    .replaceAll("\u00C3\u00A9", "\u00E9")
    .replaceAll("\u00C3\u00AD", "\u00ED")
    .replaceAll("\u00C3\u00B3", "\u00F3")
    .replaceAll("\u00C3\u00BA", "\u00FA")
    .replaceAll("\u00C3\u0081", "\u00C1")
    .replaceAll("\u00C3\u0089", "\u00C9")
    .replaceAll("\u00C3\u008D", "\u00CD")
    .replaceAll("\u00C3\u0093", "\u00D3")
    .replaceAll("\u00C3\u009A", "\u00DA")
    .replaceAll("\u00C3\u00B1", "\u00F1")
    .replaceAll("\u00C3\u0091", "\u00D1");
}

export function buildContractHtml(input: ContractRenderInput) {
  const baseHtml = (() => {
    switch (input.templateCode) {
      case "JETSKI_NO_LICENSE":
        if (input.language === "en") return buildJetskiNoLicenseEnglishHtml(input);
        if (input.language === "fr") return buildJetskiNoLicenseFrenchHtml(input);
        return buildJetskiNoLicenseHtml(input);
      case "JETSKI_LICENSED":
        if (input.language === "en") return buildJetskiLicensedEnglishHtml(input);
        if (input.language === "fr") return buildJetskiLicensedFrenchHtml(input);
        return buildLicensedHtml(input);
      case "BOAT_LICENSED":
        if (input.language === "en") return buildBoatLicensedEnglishHtml(input);
        return buildLicensedHtml(input);
      default:
        throw new Error(`Template no soportada: ${input.templateCode}`);
    }
  })();

  return translateContractHtml({
    html: fixMojibake(baseHtml),
    language: input.language ?? "es",
    templateCode: input.templateCode,
  });
}

function signatureBlockHtml(args: {
  signatureImageUrl?: string | null | undefined;
  signatureSignedBy?: string | null | undefined;
  signedAt?: Date | string | null | undefined;
  label: string;
}) {
  const signedDate = args.signedAt ? formatDate(args.signedAt) : "";

  if (args.signatureImageUrl) {
    return `
      <div style="text-align:center;">
        <img
          src="${esc(args.signatureImageUrl)}"
          style="max-width:220px; max-height:70px; object-fit:contain; display:block; margin:0 auto 4px auto;"
        />
        <div style="border-top:1px solid #111; width:220px; margin:0 auto; padding-top:6px; font-size:11px;">
          ${esc(args.label)}${args.signatureSignedBy ? ` · ${esc(args.signatureSignedBy)}` : ""}${signedDate ? ` · ${esc(signedDate)}` : ""}
        </div>
      </div>
    `;
  }

  return `
    <div style="text-align:center;">
      <div style="height:74px;"></div>
      <div style="border-top:1px solid #111; width:220px; margin:0 auto; padding-top:6px; font-size:11px;">
        ${esc(args.label)}
      </div>
    </div>
  `;
}

function buildJetskiNoLicenseHtml(input: ContractRenderInput) {
  const { templateCode, templateVersion, reservation, contract } = input;

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";
  const durationText = reservation.durationMinutes ? `${reservation.durationMinutes} min` : "—";
  const reservationSummary = [reservation.customerName, reservation.serviceName, dateText]
    .filter((value) => String(value ?? "").trim().length > 0)
    .join(" · ");

  const driverDocLabel =
    safeUpper(contract.driverDocType) === "PASSPORT"
      ? "PASAPORTE"
      : "D.N.I / N.I.E / PASSAPORTE";

  const name = esc(contract.driverName || "");
  const address = esc(contract.driverAddress || "");
  const docNumber = esc(contract.driverDocNumber || "");
  const birthDate = contract.driverBirthDate ? esc(formatDate(contract.driverBirthDate)) : "";
  const phone = esc(contract.driverPhone || "");
  const email = esc(contract.driverEmail || "");
  const postalCountry =
    `${esc(contract.driverPostalCode || "")}${contract.driverCountry ? ` · ${esc(contract.driverCountry)}` : ""}`.trim();

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Dirección: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Contrato ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
      line-height: 1.38;
    }

    .page {
      padding: 14mm 14mm 12mm 14mm;
      min-height: calc(297mm - 26mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 9.5px;
      text-align: center;
      margin-bottom: 6px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin: 2px 0 4px 0;
    }

    .logo {
      height: 56px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 21px;
      font-weight: 700;
      margin: 4px 0 8px 0;
      letter-spacing: 0.2px;
    }

    .subtitle {
      text-align: center;
      font-size: 10px;
      color: #555;
      margin-top: -2px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 10px 0 8px 0;
      text-transform: uppercase;
    }

    .clause-item {
      margin: 0 0 7px 0;
      text-align: justify;
    }

    .box {
      border: 1px solid #222;
      padding: 10px;
      margin-top: 10px;
      page-break-inside: avoid;
    }

    .box.final-legal {
      margin-top: 8px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
    }

    .field {
      page-break-inside: avoid;
    }

    .field-label {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 3px;
      text-transform: uppercase;
    }

    .field-line {
      min-height: 18px;
      border-bottom: 1px solid #222;
      padding-bottom: 2px;
    }

    .field-line.empty {
      color: transparent;
    }

    .sign-line {
      margin-top: 18px;
      border-bottom: 1px solid #222;
      min-height: 48px;
    }

    .check-line {
      margin-top: 10px;
      font-size: 12px;
    }

    .bullet-block {
      margin: 8px 0 0 0;
      padding-left: 0;
    }

    .bullet-block p {
      margin: 4px 0;
      text-align: justify;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #999;
      padding-top: 5px;
      gap: 12px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">ALQUILER DE MOTOS ACUÁTICAS SIN LICENCIA</div>
    <div class="subtitle">Plantilla ${esc(templateCode)} · Versión ${esc(templateVersion)}</div>

    <div class="section-title">1. NORMAS DE NAVEGACIÓN</div>

    <p class="clause-item"><b>a.</b> Se saldrá del puerto a una velocidad máxima de 3 nudos.</p>
    <p class="clause-item"><b>b.</b> Se mantendrá siempre una distancia mínima de seguridad de 50 metros entre las motos o respeto a otras embarcaciones.</p>
    <p class="clause-item"><b>c.</b> Las motos navegarán en fila, siempre detrás del monitor.</p>
    <p class="clause-item"><b>d.</b> Un monitor observará a las motos y a su tripulación durante la navegación y aclarará cualquier duda que puedan tener al respecto.</p>
    <p class="clause-item"><b>e.</b> En caso de confusión o no poder controlar la moto, debemos estirar de la llave que desconectará el motor y deberá esperar sobre la moto a que venga el monitor, sin abandonar en ningún caso la embarcación y efectuando señales con los brazos hacia la dirección del monitor.</p>
    <p class="clause-item"><b>f.</b> En ningún caso, se permite conducir motos de agua a los menores de 18 años. Los menores entre 16 y 18 años deberán presentar una autorización firmada del padre/madre/ tutor legal.</p>
    <p class="clause-item"><b>g.</b> Es obligatorio el chaleco salvavidas.</p>
    <p class="clause-item"><b>h.</b> Antes de iniciar la navegación, asegúrese de haber comprendido las normas de seguridad y funcionamiento de la moto, no dude en consultar cualquier duda respecto a estas.</p>
    <p class="clause-item"><b>i.</b> Está totalmente prohibido entrar a la zona de bañistas y se mantendrá siempre una distancia mínima de 300 metros respecto a la playa y de 50 metros entre las motos y las demás embarcaciones.</p>

    <div class="section-title">2. CONDICIONES DEL CONTRATO</div>

    <p class="clause-item"><b>a.</b> El usuario se compromete a leer y respetar las normas de seguridad detalladas en el contrato.</p>
    <p class="clause-item"><b>b.</b> El usuario que infrinja cualquiera de las normas de seguridad y navegación detalladas en el contrato responderá ante las autoridades españolas, en caso de responsabilidad civil, dando lugar a la cancelación instantánea del contrato de alquiler sin derecho a la reclamación o indemnización y se somete expresamente al fuero de los tribunales de Barcelona.</p>
    <p class="clause-item"><b>c.</b> Esta actividad está cubierta con una póliza de responsabilidad civil.</p>
    <p class="clause-item"><b>d.</b> El usuario reconoce que recibe el vehículo en perfectas condiciones y se compromete a conservar en buen estado, a conducir respetando las normas de navegación vigentes en este país, así como seguir con las normas indicadas anteriormente.</p>
    <p class="clause-item"><b>e.</b> El usuario libera de toda responsabilidad civil a la empresa o persona física de todos los daños físicos que se puedan causar por el mal uso y el erróneo disfrute de los servicios que se le proporcionarán por esta empresa.</p>
    <p class="clause-item"><b>f.</b> Queda totalmente prohibido el uso del teléfono móvil, a menos que el instructor dé permiso para utilizarlo. Solo se podrá utilizar el teléfono móvil cuando el instructor nos lo indique. El uso de este en cualquier otro momento puede comportar la retirada de fianza o cancelación de la actividad sin derecho a reclamación.</p>
    <p class="clause-item"><b>g.</b> El cliente declara no haber consumido ningún tipo de drogas, alcohol o estupefacientes, así como que no padece ninguna enfermedad, en la que la actividad pueda peligrar su salud.</p>
    <p class="clause-item"><b>h.</b> Si el usuario hace caso omiso al instructor, este suspenderá la actividad sin que se pueda reclamar la devolución del dinero de la actividad, o la fianza de la misma.</p>
    <p class="clause-item"><b>i.</b> El arrendatario declara haber comprendido correctamente todas las instrucciones para el correcto uso de la moto y el correcto desarrollo de la actividad.</p>

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Reserva")} · Contrato #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

  <div class="page page-break">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="section-title">3. ACCIDENTES Y REPARACIONES</div>

    <p class="clause-item">
      En caso de accidente o rotura por negligencia del cliente, este se compromete a abonar los desperfectos causados en las motos de acuerdo con las tarifas de precios vigentes, y a rellenar la declaración del accidente con sus datos.
    </p>

    <div class="box">
      <div class="grid-2">
        <div class="field">
          <div class="field-label">NOMBRE Y APELLIDOS</div>
          <div class="field-line ${!name ? "empty" : ""}">${name || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">NOMBRE DEL MENOR O DEL ACOMPAÑANTE</div>
          <div class="field-line empty"> </div>
        </div>

        <div class="field">
          <div class="field-label">DIRECCIÓN</div>
          <div class="field-line ${!address ? "empty" : ""}">${address || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">${esc(driverDocLabel)}</div>
          <div class="field-line ${!docNumber ? "empty" : ""}">${docNumber || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">TELÉFONO</div>
          <div class="field-line ${!phone ? "empty" : ""}">${phone || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">EMAIL</div>
          <div class="field-line ${!email ? "empty" : ""}">${email || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">CÓDIGO POSTAL / PAÍS</div>
          <div class="field-line ${!postalCountry ? "empty" : ""}">${postalCountry || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">FECHA DE NACIMIENTO</div>
          <div class="field-line ${!birthDate ? "empty" : ""}">${birthDate || " "}</div>
        </div>
      </div>

      <p style="margin-top:12px;">
        Declara haber comprendido las normas y acepta las condiciones del contrato.
      </p>


      <div class="grid-2" style="margin-top:10px;">
        <div class="field">
          <div class="field-label">FECHA</div>
          <div class="field-line">${esc(dateText)}</div>
        </div>
        <div class="field">
          <div class="field-label">RECURSO ASIGNADO</div>
          <div class="field-line">Se asigna en plataforma</div>
        </div>
      </div>

      <div class="field" style="margin-top:10px;">
        <div class="field-label">TIEMPO DE USO</div>
        <div class="field-line">${esc(durationText)} · ${esc(startTimeText)} - ${esc(endTimeText)}</div>
      </div>

      <div class="field" style="margin-top:12px;">
        ${signatureBlockHtml({
          signatureImageUrl: contract.signatureImageUrl,
          signatureSignedBy: contract.signatureSignedBy,
          signedAt: contract.signedAt,
          label: "Firma cliente",
        })}
        <div class="sign-line"></div>
      </div>
    </div>

    <div class="box final-legal">
      <div class="section-title" style="margin-top:0;">FIANZA Y AUTORIZACIÓN DE IMAGEN</div>

      <p class="clause-item">
        COMO GARANTÍA POR EL CORRECTO USO DE LA MOTO DE AGUA Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÁ UNA FIANZA DE 100 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.
      </p>

      <div class="bullet-block">
        <p><b>• ESTA FIANZA SERÁ REEMBOLSADA ÍNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:</b></p>
        <p><b>o</b> LA MOTO DE AGUA SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÓ.</p>
        <p><b>o</b> NO SE HAYA PRODUCIDO NINGÚN DAÑO O MAL USO DEL EQUIPO.</p>
        <p><b>o</b> SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.</p>
      </div>

      <p class="clause-item" style="margin-top:10px;">
        EL PAGO DE LA FIANZA PODRÁ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÚN DISPONIBILIDAD.
      </p>

      <p class="clause-item">
        El cliente autoriza a UTE JERSKI CENTER- NOMAD NAUTIC a utilizar las fotografías y vídeos tomados durante la actividad para su publicación en redes sociales, página web y material publicitario de la empresa. Esta autorización es gratuita y podrá ser revocada en cualquier momento mediante notificación por escrito.
      </p>

    </div>

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Reserva")} · Contrato #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

</body>
</html>
`.trim();
}

const jetskiNoLicenseEnglishNavigationClauses = [
  "The port will be exited at a maximum speed of 3 knots.",
  "A minimum safety distance of 50 metres must always be kept between jet skis or with respect to other craft.",
  "The jet skis will navigate in line, always behind the instructor.",
  "An instructor will observe the jet skis and their crew during navigation and will clarify any questions they may have in this regard.",
  "In case of confusion or inability to control the jet ski, we must pull the key that will disconnect the engine and wait on the jet ski for the instructor to come, without abandoning the craft under any circumstances and making signals with our arms towards the instructor's direction.",
  "Under no circumstances are minors under 18 years old permitted to drive jet skis. Minors between 16 and 18 years old must present an authorization signed by their father/mother/legal guardian.",
  "The life jacket is mandatory.",
  "Before starting navigation, make sure you have understood the safety and operating rules of the jet ski; do not hesitate to ask about any doubts regarding them.",
  "It is strictly forbidden to enter the bathing area and a minimum distance of 300 metres from the beach and 50 metres between jet skis and other craft must always be kept.",
] as const;

const jetskiNoLicenseEnglishContractClauses = [
  "The user undertakes to read and comply with the safety rules detailed in the contract.",
  "The user who breaches any of the safety and navigation rules detailed in the contract will be liable before the Spanish authorities; in the event of civil liability, this will give rise to immediate cancellation of the rental contract without the right to any claim or compensation, and the user expressly submits to the jurisdiction of the courts of Barcelona.",
  "This activity is covered by a civil liability insurance policy.",
  "The user acknowledges receiving the vehicle in perfect condition and undertakes to keep it in good condition, to drive in compliance with the navigation rules in force in this country, and to follow the rules indicated above.",
  "The user releases the company or individual from all civil liability for any physical harm that may be caused by misuse and improper enjoyment of the services provided by this company.",
  "The use of a mobile phone is strictly prohibited unless the instructor gives permission to use it. The mobile phone may only be used when the instructor indicates this. Its use at any other time may result in the retention of the deposit or cancellation of the activity without the right to claim.",
  "The customer declares that they have not consumed any type of drugs, alcohol or narcotics, and that they do not suffer from any illness that could endanger their health during the activity.",
  "If the user ignores the instructor, the instructor will suspend the activity without the user being able to claim a refund of the activity fee or its deposit.",
  "The hirer declares that they have correctly understood all instructions for the correct use of the jet ski and the correct development of the activity.",
] as const;

function renderJetskiNoLicenseEnglishClauses(clauses: readonly string[]) {
  return clauses
    .map((clause, index) => `    <p class="clause-item"><b>${String.fromCharCode(97 + index)}.</b> ${clause}</p>`)
    .join("\n");
}

function buildJetskiNoLicenseEnglishHtml(input: ContractRenderInput) {
  const { templateCode, templateVersion, reservation, contract } = input;

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";
  const durationText = reservation.durationMinutes ? `${reservation.durationMinutes} min` : "—";
  const reservationSummary = [reservation.customerName, reservation.serviceName, dateText]
    .filter((value) => String(value ?? "").trim().length > 0)
    .join(" · ");

  const driverDocLabel =
    safeUpper(contract.driverDocType) === "PASSPORT"
      ? "PASSPORT"
      : "ID / NIE / PASSPORT";

  const name = esc(contract.driverName || "");
  const address = esc(contract.driverAddress || "");
  const docNumber = esc(contract.driverDocNumber || "");
  const birthDate = contract.driverBirthDate ? esc(formatDate(contract.driverBirthDate)) : "";
  const phone = esc(contract.driverPhone || "");
  const email = esc(contract.driverEmail || "");
  const postalCountry =
    `${esc(contract.driverPostalCode || "")}${contract.driverCountry ? ` · ${esc(contract.driverCountry)}` : ""}`.trim();

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Address: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Contract ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
      line-height: 1.38;
    }

    .page {
      padding: 14mm 14mm 12mm 14mm;
      min-height: calc(297mm - 26mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 9.5px;
      text-align: center;
      margin-bottom: 6px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin: 2px 0 4px 0;
    }

    .logo {
      height: 56px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 21px;
      font-weight: 700;
      margin: 4px 0 8px 0;
      letter-spacing: 0.2px;
    }

    .subtitle {
      text-align: center;
      font-size: 10px;
      color: #555;
      margin-top: -2px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 10px 0 8px 0;
      text-transform: uppercase;
    }

    .clause-item {
      margin: 0 0 7px 0;
      text-align: justify;
    }

    .box {
      border: 1px solid #222;
      padding: 10px;
      margin-top: 10px;
      page-break-inside: avoid;
    }

    .box.final-legal {
      margin-top: 8px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
    }

    .field {
      page-break-inside: avoid;
    }

    .field-label {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 3px;
      text-transform: uppercase;
    }

    .field-line {
      min-height: 18px;
      border-bottom: 1px solid #222;
      padding-bottom: 2px;
    }

    .field-line.empty {
      color: transparent;
    }

    .sign-line {
      margin-top: 18px;
      border-bottom: 1px solid #222;
      min-height: 48px;
    }

    .check-line {
      margin-top: 10px;
      font-size: 12px;
    }

    .bullet-block {
      margin: 8px 0 0 0;
      padding-left: 0;
    }

    .bullet-block p {
      margin: 4px 0;
      text-align: justify;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #999;
      padding-top: 5px;
      gap: 12px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">JET SKI RENTAL WITHOUT LICENSE</div>
    <div class="subtitle">Template ${esc(templateCode)} · Version ${esc(templateVersion)}</div>

    <div class="section-title">1. NAVIGATION RULES</div>

${renderJetskiNoLicenseEnglishClauses(jetskiNoLicenseEnglishNavigationClauses)}

    <div class="section-title">2. CONTRACT TERMS</div>

${renderJetskiNoLicenseEnglishClauses(jetskiNoLicenseEnglishContractClauses)}

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Booking")} · Contract #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

  <div class="page page-break">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="section-title">3. ACCIDENTS AND REPAIRS</div>

    <p class="clause-item">
      In the event of an accident or breakage due to customer negligence, the customer undertakes to pay for the damage caused to the jet skis according to the current price rates, and to complete the accident report with their details.
    </p>

    <div class="box">
      <div class="grid-2">
        <div class="field">
          <div class="field-label">FULL NAME</div>
          <div class="field-line ${!name ? "empty" : ""}">${name || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">NAME OF MINOR OR COMPANION</div>
          <div class="field-line empty"> </div>
        </div>

        <div class="field">
          <div class="field-label">ADDRESS</div>
          <div class="field-line ${!address ? "empty" : ""}">${address || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">${esc(driverDocLabel)}</div>
          <div class="field-line ${!docNumber ? "empty" : ""}">${docNumber || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">PHONE</div>
          <div class="field-line ${!phone ? "empty" : ""}">${phone || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">EMAIL</div>
          <div class="field-line ${!email ? "empty" : ""}">${email || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">POSTAL CODE / COUNTRY</div>
          <div class="field-line ${!postalCountry ? "empty" : ""}">${postalCountry || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">DATE OF BIRTH</div>
          <div class="field-line ${!birthDate ? "empty" : ""}">${birthDate || " "}</div>
        </div>
      </div>

      <p style="margin-top:12px;">
        The customer declares that they have understood the rules and accept the contract terms.
      </p>


      <div class="grid-2" style="margin-top:10px;">
        <div class="field">
          <div class="field-label">DATE</div>
          <div class="field-line">${esc(dateText)}</div>
        </div>
        <div class="field">
          <div class="field-label">ASSIGNED RESOURCE</div>
          <div class="field-line">Assigned on site</div>
        </div>
      </div>

      <div class="field" style="margin-top:10px;">
        <div class="field-label">USAGE TIME</div>
        <div class="field-line">${esc(durationText)} · ${esc(startTimeText)} - ${esc(endTimeText)}</div>
      </div>

      <div class="field" style="margin-top:12px;">
        ${signatureBlockHtml({
          signatureImageUrl: contract.signatureImageUrl,
          signatureSignedBy: contract.signatureSignedBy,
          signedAt: contract.signedAt,
          label: "Customer signature",
        })}
        <div class="sign-line"></div>
      </div>
    </div>

    <div class="box final-legal">
      <div class="section-title" style="margin-top:0;">DEPOSIT AND IMAGE AUTHORIZATION</div>

      <p class="clause-item">
        AS A GUARANTEE FOR THE CORRECT USE OF THE JET SKI AND COMPLIANCE WITH THE RENTAL TERMS, A 100 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS.
      </p>

      <div class="bullet-block">
        <p><b>• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:</b></p>
        <p><b>o</b> THE JET SKI IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED.</p>
        <p><b>o</b> NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED.</p>
        <p><b>o</b> THE SAFETY AND BEHAVIOUR RULES GIVEN BY STAFF HAVE BEEN FOLLOWED.</p>
      </div>

      <p class="clause-item" style="margin-top:10px;">
        THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY.
      </p>

      <p class="clause-item">
        The customer authorizes UTE JERSKI CENTER- NOMAD NAUTIC to use the photographs and videos taken during the activity for publication on social media, the website and the company's advertising material. This authorization is free of charge and may be revoked at any time by written notice.
      </p>

    </div>

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Booking")} · Contract #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

</body>
</html>
`.trim();
}

const jetskiNoLicenseFrenchNavigationClauses = [
  "La sortie du port se fera à une vitesse maximale de 3 noeuds.",
  "Une distance minimale de sécurité de 50 mètres devra toujours être maintenue entre les jet-skis ou par rapport aux autres embarcations.",
  "Les jet-skis navigueront en file, toujours derrière le moniteur.",
  "Un moniteur observera les jet-skis et leur équipage pendant la navigation et répondra à toute question qu'ils pourraient avoir à ce sujet.",
  "En cas de confusion ou d'impossibilité de contrôler le jet-ski, nous devons tirer sur la clé qui coupera le moteur et attendre sur le jet-ski que le moniteur arrive, sans abandonner l'embarcation en aucun cas et en faisant des signaux avec les bras en direction du moniteur.",
  "En aucun cas les mineurs de moins de 18 ans ne sont autorisés à conduire des jet-skis. Les mineurs entre 16 et 18 ans devront présenter une autorisation signée du père, de la mère ou du tuteur légal.",
  "Le port du gilet de sauvetage est obligatoire.",
  "Avant de commencer la navigation, assurez-vous d'avoir compris les règles de sécurité et de fonctionnement du jet-ski; n'hésitez pas à poser toute question à ce sujet.",
  "Il est strictement interdit d'entrer dans la zone de baignade et une distance minimale de 300 mètres de la plage et de 50 mètres entre les jet-skis et les autres embarcations devra toujours être maintenue.",
] as const;

const jetskiNoLicenseFrenchContractClauses = [
  "L'utilisateur s'engage à lire et à respecter les règles de sécurité détaillées dans le contrat.",
  "L'utilisateur qui enfreint l'une des règles de sécurité et de navigation détaillées dans le contrat répondra devant les autorités espagnoles; en cas de responsabilité civile, cela entraînera l'annulation immédiate du contrat de location sans droit à réclamation ni indemnisation, et l'utilisateur se soumet expressément à la juridiction des tribunaux de Barcelone.",
  "Cette activité est couverte par une police d'assurance de responsabilité civile.",
  "L'utilisateur reconnaît recevoir le véhicule en parfait état et s'engage à le conserver en bon état, à conduire en respectant les règles de navigation en vigueur dans ce pays, ainsi qu'à suivre les règles indiquées ci-dessus.",
  "L'utilisateur décharge l'entreprise ou la personne physique de toute responsabilité civile pour les dommages corporels qui pourraient être causés par une mauvaise utilisation et une jouissance incorrecte des services fournis par cette entreprise.",
  "L'utilisation du téléphone portable est strictement interdite, sauf si le moniteur donne l'autorisation de l'utiliser. Le téléphone portable ne pourra être utilisé que lorsque le moniteur l'indiquera. Son utilisation à tout autre moment pourra entraîner la retenue du dépôt de garantie ou l'annulation de l'activité sans droit à réclamation.",
  "Le client déclare n'avoir consommé aucun type de drogues, d'alcool ou de stupéfiants, et ne souffrir d'aucune maladie susceptible de mettre sa santé en danger pendant l'activité.",
  "Si l'utilisateur ne suit pas les instructions du moniteur, celui-ci suspendra l'activité sans que l'utilisateur puisse réclamer le remboursement du montant de l'activité ou de son dépôt de garantie.",
  "Le locataire déclare avoir correctement compris toutes les instructions relatives à la bonne utilisation du jet-ski et au bon déroulement de l'activité.",
] as const;

function renderJetskiNoLicenseFrenchClauses(clauses: readonly string[]) {
  return clauses
    .map((clause, index) => `    <p class="clause-item"><b>${String.fromCharCode(97 + index)}.</b> ${clause}</p>`)
    .join("\n");
}

function buildJetskiNoLicenseFrenchHtml(input: ContractRenderInput) {
  const { templateCode, templateVersion, reservation, contract } = input;

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";
  const durationText = reservation.durationMinutes ? `${reservation.durationMinutes} min` : "—";
  const reservationSummary = [reservation.customerName, reservation.serviceName, dateText]
    .filter((value) => String(value ?? "").trim().length > 0)
    .join(" · ");

  const driverDocLabel =
    safeUpper(contract.driverDocType) === "PASSPORT"
      ? "PASSEPORT"
      : "PIÈCE D'IDENTITÉ / NIE / PASSEPORT";

  const name = esc(contract.driverName || "");
  const address = esc(contract.driverAddress || "");
  const docNumber = esc(contract.driverDocNumber || "");
  const birthDate = contract.driverBirthDate ? esc(formatDate(contract.driverBirthDate)) : "";
  const phone = esc(contract.driverPhone || "");
  const email = esc(contract.driverEmail || "");
  const postalCountry =
    `${esc(contract.driverPostalCode || "")}${contract.driverCountry ? ` · ${esc(contract.driverCountry)}` : ""}`.trim();

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Adresse: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  return `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Contrat ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      font-size: 12px;
      line-height: 1.38;
    }

    .page {
      padding: 14mm 14mm 12mm 14mm;
      min-height: calc(297mm - 26mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 9.5px;
      text-align: center;
      margin-bottom: 6px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin: 2px 0 4px 0;
    }

    .logo {
      height: 56px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 21px;
      font-weight: 700;
      margin: 4px 0 8px 0;
      letter-spacing: 0.2px;
    }

    .subtitle {
      text-align: center;
      font-size: 10px;
      color: #555;
      margin-top: -2px;
      margin-bottom: 12px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 10px 0 8px 0;
      text-transform: uppercase;
    }

    .clause-item {
      margin: 0 0 7px 0;
      text-align: justify;
    }

    .box {
      border: 1px solid #222;
      padding: 10px;
      margin-top: 10px;
      page-break-inside: avoid;
    }

    .box.final-legal {
      margin-top: 8px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
    }

    .field {
      page-break-inside: avoid;
    }

    .field-label {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 3px;
      text-transform: uppercase;
    }

    .field-line {
      min-height: 18px;
      border-bottom: 1px solid #222;
      padding-bottom: 2px;
    }

    .field-line.empty {
      color: transparent;
    }

    .sign-line {
      margin-top: 18px;
      border-bottom: 1px solid #222;
      min-height: 48px;
    }

    .check-line {
      margin-top: 10px;
      font-size: 12px;
    }

    .bullet-block {
      margin: 8px 0 0 0;
      padding-left: 0;
    }

    .bullet-block p {
      margin: 4px 0;
      text-align: justify;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #999;
      padding-top: 5px;
      gap: 12px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">LOCATION DE JET-SKIS SANS PERMIS</div>
    <div class="subtitle">Modèle ${esc(templateCode)} · Version ${esc(templateVersion)}</div>

    <div class="section-title">1. RÈGLES DE NAVIGATION</div>

${renderJetskiNoLicenseFrenchClauses(jetskiNoLicenseFrenchNavigationClauses)}

    <div class="section-title">2. CONDITIONS DU CONTRAT</div>

${renderJetskiNoLicenseFrenchClauses(jetskiNoLicenseFrenchContractClauses)}

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Réservation")} · Contrat #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

  <div class="page page-break">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="section-title">3. ACCIDENTS ET RÉPARATIONS</div>

    <p class="clause-item">
      En cas d'accident ou de casse due à la négligence du client, celui-ci s'engage à payer les dommages causés aux jet-skis selon les tarifs en vigueur, et à remplir la déclaration d'accident avec ses données.
    </p>

    <div class="box">
      <div class="grid-2">
        <div class="field">
          <div class="field-label">NOM ET PRÉNOM(S)</div>
          <div class="field-line ${!name ? "empty" : ""}">${name || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">NOM DU MINEUR OU DE L'ACCOMPAGNANT</div>
          <div class="field-line empty"> </div>
        </div>

        <div class="field">
          <div class="field-label">ADRESSE</div>
          <div class="field-line ${!address ? "empty" : ""}">${address || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">${esc(driverDocLabel)}</div>
          <div class="field-line ${!docNumber ? "empty" : ""}">${docNumber || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">TÉLÉPHONE</div>
          <div class="field-line ${!phone ? "empty" : ""}">${phone || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">EMAIL</div>
          <div class="field-line ${!email ? "empty" : ""}">${email || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">CODE POSTAL / PAYS</div>
          <div class="field-line ${!postalCountry ? "empty" : ""}">${postalCountry || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">DATE DE NAISSANCE</div>
          <div class="field-line ${!birthDate ? "empty" : ""}">${birthDate || " "}</div>
        </div>
      </div>

      <p style="margin-top:12px;">
        Le client déclare avoir compris les règles et accepte les conditions du contrat.
      </p>


      <div class="grid-2" style="margin-top:10px;">
        <div class="field">
          <div class="field-label">DATE</div>
          <div class="field-line">${esc(dateText)}</div>
        </div>
        <div class="field">
          <div class="field-label">RESSOURCE ATTRIBUÉE</div>
          <div class="field-line">Attribuée sur plateforme</div>
        </div>
      </div>

      <div class="field" style="margin-top:10px;">
        <div class="field-label">DURÉE D'UTILISATION</div>
        <div class="field-line">${esc(durationText)} · ${esc(startTimeText)} - ${esc(endTimeText)}</div>
      </div>

      <div class="field" style="margin-top:12px;">
        ${signatureBlockHtml({
          signatureImageUrl: contract.signatureImageUrl,
          signatureSignedBy: contract.signatureSignedBy,
          signedAt: contract.signedAt,
          label: "Signature client",
        })}
        <div class="sign-line"></div>
      </div>
    </div>

    <div class="box final-legal">
      <div class="section-title" style="margin-top:0;">DÉPÔT DE GARANTIE ET AUTORISATION D'IMAGE</div>

      <p class="clause-item">
        À TITRE DE GARANTIE POUR LA BONNE UTILISATION DU JET-SKI ET LE RESPECT DES CONDITIONS DE LOCATION, UN DÉPÔT DE GARANTIE DE 100 EUROS SERA DEMANDÉ AU MOMENT DE LA SIGNATURE DU CONTRAT OU AVANT LE DÉBUT DE L'ACTIVITÉ.
      </p>

      <div class="bullet-block">
        <p><b>• CE DÉPÔT SERA INTÉGRALEMENT REMBOURSÉ À LA FIN DU SERVICE, À CONDITION QUE:</b></p>
        <p><b>o</b> LE JET-SKI SOIT RESTITUÉ DANS LE MÊME ÉTAT QUE CELUI DANS LEQUEL IL A ÉTÉ REMIS.</p>
        <p><b>o</b> AUCUN DOMMAGE NI MAUVAIS USAGE DE L'ÉQUIPEMENT N'AIT ÉTÉ CONSTATÉ.</p>
        <p><b>o</b> LES RÈGLES DE SÉCURITÉ ET DE COMPORTEMENT INDIQUÉES PAR LE PERSONNEL AIENT ÉTÉ RESPECTÉES.</p>
      </div>

      <p class="clause-item" style="margin-top:10px;">
        LE PAIEMENT DU DÉPÔT DE GARANTIE POURRA ÊTRE EFFECTUÉ EN ESPÈCES OU PAR CARTE BANCAIRE, SELON DISPONIBILITÉ.
      </p>

      <p class="clause-item">
        Le client autorise UTE JERSKI CENTER- NOMAD NAUTIC à utiliser les photographies et vidéos prises pendant l'activité pour leur publication sur les réseaux sociaux, le site web et les supports publicitaires de l'entreprise. Cette autorisation est gratuite et pourra être révoquée à tout moment par notification écrite.
      </p>

    </div>

    <div class="footer">
      <div>${esc(legalHeader)}</div>
      <div>${esc(reservationSummary || "Réservation")} · Contrat #${esc(contract.logicalUnitIndex ?? contract.unitIndex)}</div>
    </div>
  </div>

</body>
</html>
`.trim();
}

function buildJetskiLicensedEnglishHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Address: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";

  const priceText = eurosFromCents(reservation.totalPriceCents);
  const depositText = "500 €";

  const driverName = esc(contract.driverName || "");
  const driverDocType = esc(contract.driverDocType || "");
  const driverDoc = esc(contract.driverDocNumber || "");
  const driverAddress = esc(contract.driverAddress || "");
  const driverPostalCode = esc(contract.driverPostalCode || "");
  const driverCountry = esc(contract.driverCountry || "");
  const driverBirthDate = esc(formatDate(contract.driverBirthDate));
  const driverPhone = esc(contract.driverPhone || "");
  const driverEmail = esc(contract.driverEmail || "");
  const licenseSchool = esc(contract.licenseSchool || "");
  const licenseType = esc(contract.licenseType || "");
  const licenseNumber = esc(contract.licenseNumber || "");

  const resourceName = contract.preparedJetski
    ? `${contract.preparedJetski.model ?? "JET SKI"}${contract.preparedJetski.number ? ` ${contract.preparedJetski.number}` : ""}`.trim()
    : "PENDING ASSIGNMENT";

  const resourcePlate = contract.preparedJetski?.plate ?? "";
  const assetLabel = "jet ski";
  const assetLabelPlural = "jet skis";
  const assetLabelTitle = "JET SKI";
  const dispatchPersonsText =
    reservation.pax ? `MAXIMUM ${reservation.pax} PERSONS ON THE ${assetLabelTitle}` : "";

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Contract ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111;
    }

    .page {
      padding: 16mm 14mm 14mm 14mm;
      min-height: calc(297mm - 30mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 10px;
      text-align: center;
      margin-bottom: 8px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin-bottom: 6px;
    }

    .logo {
      height: 62px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0 16px 0;
      text-transform: uppercase;
    }

    .intro {
      margin-bottom: 14px;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #222;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 12px;
    }

    th {
      background: #f5f5f5;
      text-align: center;
      font-weight: 700;
    }

    .label-cell {
      width: 110px;
      font-weight: 700;
      background: #fafafa;
      text-align: left;
    }

    .section-title {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      margin: 10px 0 12px 0;
      text-transform: uppercase;
    }

    .clause-title {
      font-weight: 700;
      font-size: 12px;
      margin: 10px 0 6px 0;
      text-transform: uppercase;
    }

    .clause {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .signature-zone {
      margin-top: 18px;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 12px;
    }

    .signature-box {
      min-height: 80px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .signature-line {
      width: 220px;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 6px;
      font-size: 11px;
    }

    .final-box {
      margin-top: 18px;
      page-break-inside: avoid;
    }

    .final-box p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .bullet {
      margin-left: 18px;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      text-align: center;
      border-top: 1px solid #999;
      padding-top: 5px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">LICENSED JET SKI RENTAL CONTRACT</div>

    <p class="intro">
      On the one hand, UTE JETSKI CENTER- NOMAD NAUTIC, registered at C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA) with tax ID B- U16457343 (hereinafter the Lessor), and on the other hand,
    </p>

    <table>
      <tr>
        <td class="label-cell">Name</td>
        <td colspan="5">${driverName}</td>
      </tr>
      <tr>
        <td class="label-cell">Document type</td>
        <td colspan="2">${driverDocType}</td>
        <td class="label-cell">Document number</td>
        <td colspan="2">${driverDoc}</td>
      </tr>
      <tr>
        <td class="label-cell">Date of birth</td>
        <td colspan="2">${driverBirthDate}</td>
        <td class="label-cell">Phone</td>
        <td colspan="2">${driverPhone}</td>
      </tr>
      <tr>
        <td class="label-cell">Address</td>
        <td colspan="2">${driverAddress}</td>
        <td class="label-cell">Post code</td>
        <td>${driverPostalCode}</td>
        <td>${driverCountry}</td>
      </tr>
      <tr>
        <td class="label-cell">Email</td>
        <td colspan="5">${driverEmail}</td>
      </tr>
      <tr>
        <td class="label-cell">License</td>
        <td colspan="2">${licenseType}</td>
        <td class="label-cell">License number</td>
        <td colspan="2">${licenseNumber}</td>
      </tr>
      <tr>
        <td class="label-cell">School / issuer</td>
        <td colspan="5">${licenseSchool}</td>
      </tr>
    </table>

    <p class="intro">
      Hereinafter the Hirer. The Lessor rents the following jet ski to the Hirer:
    </p>

    <table>
      <tr>
        <th>Type</th>
        <th>Name</th>
        <th>Registration</th>
        <th>Authorized persons</th>
      </tr>
      <tr>
        <td>${assetLabelTitle}</td>
        <td>${esc(resourceName)}</td>
        <td>${esc(resourcePlate)}</td>
        <td>${esc(dispatchPersonsText)}</td>
      </tr>
    </table>

    <p class="intro"><b>Boarding and disembarkation port:</b> PORT ESPORTIU DE BADALONA</p>

    <p class="intro">The rental period is:</p>

    <table>
      <tr>
        <th colspan="2">From</th>
        <th colspan="2">Until</th>
      </tr>
      <tr>
        <td class="label-cell">Day:</td>
        <td>${esc(dateText)}</td>
        <td class="label-cell">Day:</td>
        <td>${esc(dateText)}</td>
      </tr>
      <tr>
        <td class="label-cell">Time:</td>
        <td>${esc(startTimeText)}</td>
        <td class="label-cell">Time:</td>
        <td>${esc(endTimeText)}</td>
      </tr>
    </table>

    <p class="intro">
      The rental price is set at <b>${esc(priceText)}</b>, VAT included, plus a deposit of <b>${esc(depositText)}</b>.
    </p>

    <div class="section-title">CLAUSES:</div>

    <div class="clause-title">1. DELIVERY OF THE JET SKI.</div>
    <p class="clause">
      a. At the time of delivery, the hirer shall check the general condition of the hull and the fuel level, undertaking to return the ${assetLabel} in the same condition in which it was delivered by the lessor.
    </p>

    <div class="clause-title">2. NAVIGATION AREA.</div>
    <p class="clause">
      The permitted navigation area is limited to the Catalan and Valencian coasts and the Balearic Islands. The hirer must request written permission from UTE JETSKI CENTER - NOMAD NAUTIC to navigate in areas other than those stated here or outside Spanish territorial waters.
    </p>
    <p class="clause">
      If renting a ${assetLabel}, it may not navigate within 200m of the area reserved for bathers marked with yellow buoys, nor inside the buoyed channels reserved for the entry and exit of ${assetLabelPlural}. It is FORBIDDEN to be within 200m of the coastline, beaches or coves unless prior permission has been granted by UTE JETSKI CENTER- NOMAD NAUTIC when the bathing area is not delimited.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">3. USE OF THE JET SKI.</div>
    <p class="clause">a. The hirer undertakes to use the rented jet ski correctly and to comply with the rules established by the maritime, customs, health and tax authorities, as well as with national or foreign police authorities where applicable. In the event of any breach of regulations by the hirer, the hirer shall bear all penalties, fines and related costs.</p>
    <p class="clause">b. The hirer undertakes not to carry more persons on board than permitted by the jet ski's safety certificate and to use the jet ski only for leisure cruising. The hirer also undertakes not to assign, subcontract or sublet the jet ski in whole or in part.</p>
    <p class="clause">c. Towing other craft is strictly prohibited except in cases of emergency. Likewise, the rented jet ski may only be towed in the same circumstances and always using its own lines in order to avoid high salvage costs. The hirer shall not accept agreements or assume liabilities without authorization from UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">d. If any salvage reward is obtained, it shall be divided 50% for UTE JETSKI CENTER- NOMAD NAUTIC and 50% for the hirer.</p>
    <p class="clause">e. In the event of dangerous weather or sea forecasts (above Beaufort force 6 or 27 knots of wind), the hirer undertakes not to leave the port where the jet ski is located or otherwise to proceed to the nearest safe port or anchorage.</p>
    <p class="clause">f. The hirer is responsible for any damage or loss affecting the rented jet ski, for the loss of its equipment and for any delay in returning the jet ski.</p>

    <div class="clause-title">4. INSURANCE.</div>
    <p class="clause">a. The jet ski insurance is included in the rental price.</p>
    <p class="clause">b. UTE JETSKI CENTER- NOMAD NAUTIC shall not in any case be liable for personal injuries or for any loss of or damage to the personal belongings of the hirer, crew or guests on board the jet ski.</p>

    <div class="clause-title">5. RETURN OF THE JET SKI.</div>
    <p class="clause">a. The hirer declares that they know the condition of the jet ski and therefore expressly agrees to return it in the same condition in which it was received, with the fuel tanks filled. If it is not returned in these conditions, the cost of refilling the tanks shall be deducted from the deposit. The fuel cost is set at 25€ for each line indicated on the gauge.</p>
    <p class="clause">b. Upon return of the jet ski, UTE JETSKI CENTER- NOMAD NAUTIC shall inspect it, after which the deposit shall be returned to the hirer. If any damage to the jet ski or any loss or breakage of equipment is found, UTE JETSKI CENTER- NOMAD NAUTIC shall deduct from the deposit the amount necessary to repair such damage. UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to claim an amount exceeding the deposit if repair costs are higher than the deposit paid.</p>
    <p class="clause">c. The jet ski must be returned to the same port where delivery took place. The hirer shall bear all expenses arising from any change to the return location. These costs shall be 10 euros per mile travelled plus the crew transfer costs, and this amount shall be deducted from the deposit paid.</p>
    <p class="clause">d. The hirer undertakes to inform UTE JETSKI CENTER- NOMAD NAUTIC of any anomaly, incident or problem that may have arisen during navigation.</p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">6. LATE RETURN.</div>
    <p class="clause">If there is any delay in returning the jet ski, the hirer shall be obliged as follows:</p>
    <p class="clause">a. The hirer shall pay UTE JETSKI CENTER- NOMAD NAUTIC the proportional amount for the extra time used, and UTE JETSKI CENTER- NOMAD NAUTIC may deduct it from the deposit. If, after 24 hours from the end of the contract, the jet ski has not been returned and there is no news of it, a search shall be initiated and its disappearance shall be reported to the maritime authorities. Any resulting costs shall be borne by the hirer.</p>
    <p class="clause">The time required to repair any damage to the jet ski shall also be considered a delay in return.</p>

    <div class="clause-title">7. DAMAGE, ACCIDENTS AND BREAKDOWNS.</div>
    <p class="clause">a) If, during the rental period, the rented jet ski suffers breakdowns, damage, defects or loss of equipment, the hirer is obliged to inform Barcodealquiler.com immediately, which shall provide the appropriate instructions to follow.</p>
    <p class="clause">b) If accidents involving third parties occur, they must be reported by the hirer to the competent authorities, recording the details of the craft involved in the accident. The hirer must also draw up a report on what happened and deliver it to UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">c) The hirer is obliged to inform UTE JETSKI CENTER- NOMAD NAUTIC of any contact between the jet ski and the seabed so that the consequences of such contacts can be assessed and later crews are not put at risk.</p>

    <div class="clause-title">8. CANCELLATIONS AND TERMINATION</div>
    <p class="clause">Any negligence in the use of the jet ski in breach of current legislation shall be grounds for automatic termination of the contract, and any amounts paid shall remain with UTE JETSKI CENTER- NOMAD NAUTIC.</p>

    <div class="clause-title">9. CUSTOMER DECLARATION.</div>
    <p class="clause">The customer declares that they have not consumed alcohol, narcotics or psychoactive substances and that they do not suffer from any illness or physical impairment preventing the safe handling of the jet ski.</p>

    <div class="clause-title">10. LIABILITY TOWARDS THIRD PARTIES</div>
    <p class="clause">If any claims are brought by third parties against the hirer due to the use of the rented jet ski, UTE JETSKI CENTER- NOMAD NAUTIC shall be exempt from any liability. The hirer shall also be jointly liable for any offences committed by the skipper of the jet ski.</p>

    <div class="clause-title">11. SKIPPER EXPERIENCE.</div>
    <p class="clause">
      The hirer states that they have the knowledge and experience necessary for the voyage and that they hold the following nautical license:
      <b>${licenseType}</b> issued by <b>${licenseSchool}</b>, designating Mr./Ms.
      <b>${driverName}</b>, holder of the nautical license mentioned above, identified as:
      <b>${driverDoc}</b>, as skipper of the jet ski. Under no circumstances may command of the jet ski be handed over to a person other than the one recorded as skipper.
    </p>
    <p class="clause">
      UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to cancel this contract if the skipper does not have sufficient training and competence to operate the jet ski safely. In that case, the hirer shall not be entitled to any rental refund; however, UTE JETSKI CENTER- NOMAD NAUTIC may provide another skipper to the hirer, if available. Any fees charged by that skipper shall be borne by the hirer.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">12. VALIDITY</div>
    <p class="clause">If any clause of the contract loses its validity, this shall in no way affect the others, which shall remain fully effective between the parties.</p>

    <div class="clause-title">13. DATA PROTECTION</div>
    <p class="clause">In compliance with Organic Law 15/1999, of 13 December, on the Protection of Personal Data, by accepting this contract you are informed that your personal data shall be processed and incorporated into files for which UTE JETSKI CENTER- NOMAD NAUTIC is responsible, registered with the Spanish Data Protection Agency, for the purpose of customer and contract management.</p>
    <p class="clause">The requested data are necessary, and if they are not provided it will not be possible to deliver the requested service. In this regard, you expressly consent to their collection and processing for the stated purpose. Likewise, you authorize the communication of your personal data to other entities when necessary to provide the requested service.</p>
    <p class="clause">You also authorize the use of your data for periodic communications, including those sent by email, which our company may carry out to inform you of activities it performs directly or through partner companies. In all cases, you may exercise your rights of access, rectification, cancellation and objection by contacting the following email address: <b>SEARIDERSJETSKI@GMAIL.COM</b> or by calling <b>608-10-12-72</b>.</p>

    <div class="clause-title">14. GOVERNING LAW AND JURISDICTION</div>
    <p class="clause">This contract is governed by Spanish law. Any disputes or differences that may arise in connection with the performance, amendment, termination or effects of this contract shall be resolved by the courts of the city of BARCELONA, to whose jurisdiction the parties expressly submit.</p>

    <div class="signature-zone">
      <p><b>In witness whereof</b>, the parties sign this jet ski rental contract in duplicate at the place and date set out below:</p>
      <p><b>BADALONA on:</b> ${esc(dateText)}</p>

      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line">LESSOR</div>
        </div>
        <div class="signature-box">
          ${signatureBlockHtml({
            signatureImageUrl: contract.signatureImageUrl,
            signatureSignedBy: contract.signatureSignedBy,
            signedAt: contract.signedAt,
            label: "HIRER",
          })}
        </div>
      </div>
    </div>

    <div class="final-box">
      <p>
        <b>AS A GUARANTEE FOR THE CORRECT USE OF THE ${assetLabelTitle} AND COMPLIANCE WITH THE RENTAL TERMS, A 500 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS.</b>
      </p>
      <p><b>• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:</b></p>
      <p class="bullet">o THE ${assetLabelTitle} IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED.</p>
      <p class="bullet">o NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED.</p>
      <p class="bullet">o THE SAFETY AND BEHAVIOUR RULES GIVEN BY STAFF HAVE BEEN FOLLOWED.</p>
      <p>THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY.</p>
      <p>
        The customer authorizes UTE JERSKI CENTER- NOMAD NAUTIC to use the photographs and videos taken during the activity for publication on social media, the website and the company's advertising material. This authorization is free of charge and may be revoked at any time by written notice.
      </p>
    </div>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

</body>
</html>
`.trim();
}

function buildJetskiLicensedFrenchHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Adresse: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";

  const priceText = eurosFromCents(reservation.totalPriceCents);
  const depositText = "500 €";

  const driverName = esc(contract.driverName || "");
  const driverDocType = esc(contract.driverDocType || "");
  const driverDoc = esc(contract.driverDocNumber || "");
  const driverAddress = esc(contract.driverAddress || "");
  const driverPostalCode = esc(contract.driverPostalCode || "");
  const driverCountry = esc(contract.driverCountry || "");
  const driverBirthDate = esc(formatDate(contract.driverBirthDate));
  const driverPhone = esc(contract.driverPhone || "");
  const driverEmail = esc(contract.driverEmail || "");
  const licenseSchool = esc(contract.licenseSchool || "");
  const licenseType = esc(contract.licenseType || "");
  const licenseNumber = esc(contract.licenseNumber || "");

  const resourceName = contract.preparedJetski
    ? `${contract.preparedJetski.model ?? "JET-SKI"}${contract.preparedJetski.number ? ` ${contract.preparedJetski.number}` : ""}`.trim()
    : "ATTRIBUTION EN ATTENTE";

  const resourcePlate = contract.preparedJetski?.plate ?? "";
  const assetLabel = "jet-ski";
  const assetLabelPlural = "jet-skis";
  const assetLabelTitle = "JET-SKI";
  const dispatchPersonsText =
    reservation.pax ? `MAXIMUM ${reservation.pax} PERSONNES SUR LE ${assetLabelTitle}` : "";

  return `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Contrat ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111;
    }

    .page {
      padding: 16mm 14mm 14mm 14mm;
      min-height: calc(297mm - 30mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 10px;
      text-align: center;
      margin-bottom: 8px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin-bottom: 6px;
    }

    .logo {
      height: 62px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0 16px 0;
      text-transform: uppercase;
    }

    .intro {
      margin-bottom: 14px;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #222;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 12px;
    }

    th {
      background: #f5f5f5;
      text-align: center;
      font-weight: 700;
    }

    .label-cell {
      width: 110px;
      font-weight: 700;
      background: #fafafa;
      text-align: left;
    }

    .section-title {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      margin: 10px 0 12px 0;
      text-transform: uppercase;
    }

    .clause-title {
      font-weight: 700;
      font-size: 12px;
      margin: 10px 0 6px 0;
      text-transform: uppercase;
    }

    .clause {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .signature-zone {
      margin-top: 18px;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 12px;
    }

    .signature-box {
      min-height: 80px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .signature-line {
      width: 220px;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 6px;
      font-size: 11px;
    }

    .final-box {
      margin-top: 18px;
      page-break-inside: avoid;
    }

    .final-box p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .bullet {
      margin-left: 18px;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      text-align: center;
      border-top: 1px solid #999;
      padding-top: 5px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">CONTRAT DE LOCATION DE JET-SKI AVEC PERMIS</div>

    <p class="intro">
      D'une part, l'entité UTE JETSKI CENTER- NOMAD NAUTIC, domiciliée à C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA), munie du CIF B- U16457343 (ci-après le Loueur), et d'autre part,
    </p>

    <table>
      <tr>
        <td class="label-cell">Nom</td>
        <td colspan="5">${driverName}</td>
      </tr>
      <tr>
        <td class="label-cell">Type de document</td>
        <td colspan="2">${driverDocType}</td>
        <td class="label-cell">Numéro de document</td>
        <td colspan="2">${driverDoc}</td>
      </tr>
      <tr>
        <td class="label-cell">Date de naissance</td>
        <td colspan="2">${driverBirthDate}</td>
        <td class="label-cell">Téléphone</td>
        <td colspan="2">${driverPhone}</td>
      </tr>
      <tr>
        <td class="label-cell">Adresse</td>
        <td colspan="2">${driverAddress}</td>
        <td class="label-cell">Code postal</td>
        <td>${driverPostalCode}</td>
        <td>${driverCountry}</td>
      </tr>
      <tr>
        <td class="label-cell">Email</td>
        <td colspan="5">${driverEmail}</td>
      </tr>
      <tr>
        <td class="label-cell">Permis</td>
        <td colspan="2">${licenseType}</td>
        <td class="label-cell">Numéro de permis</td>
        <td colspan="2">${licenseNumber}</td>
      </tr>
      <tr>
        <td class="label-cell">École / émetteur</td>
        <td colspan="5">${licenseSchool}</td>
      </tr>
    </table>

    <p class="intro">
      Ci-après le Locataire. Le Loueur loue au Locataire le jet-ski suivant:
    </p>

    <table>
      <tr>
        <th>Type</th>
        <th>Nom</th>
        <th>Immatriculation</th>
        <th>Personnes autorisées</th>
      </tr>
      <tr>
        <td>${assetLabelTitle}</td>
        <td>${esc(resourceName)}</td>
        <td>${esc(resourcePlate)}</td>
        <td>${esc(dispatchPersonsText)}</td>
      </tr>
    </table>

    <p class="intro"><b>Port d'embarquement et de débarquement:</b> PORT ESPORTIU DE BADALONA</p>

    <p class="intro">La période de location comprend:</p>

    <table>
      <tr>
        <th colspan="2">Du</th>
        <th colspan="2">Au</th>
      </tr>
      <tr>
        <td class="label-cell">Jour:</td>
        <td>${esc(dateText)}</td>
        <td class="label-cell">Jour:</td>
        <td>${esc(dateText)}</td>
      </tr>
      <tr>
        <td class="label-cell">Heure:</td>
        <td>${esc(startTimeText)}</td>
        <td class="label-cell">Heure:</td>
        <td>${esc(endTimeText)}</td>
      </tr>
    </table>

    <p class="intro">
      Le prix de la location est fixé à <b>${esc(priceText)}</b>, TVA comprise, plus un dépôt de garantie de <b>${esc(depositText)}</b>.
    </p>

    <div class="section-title">CLAUSES:</div>

    <div class="clause-title">1. REMISE DU JET-SKI.</div>
    <p class="clause">
      a. Au moment de la remise, le locataire vérifiera l'état général de la coque et le niveau de carburant, et s'engage à restituer le ${assetLabel} dans le même état que celui dans lequel il lui a été remis par le loueur.
    </p>

    <div class="clause-title">2. ZONE DE NAVIGATION.</div>
    <p class="clause">
      La zone de navigation autorisée est établie sur le littoral catalan, valencien et aux îles Baléares. Le locataire devra demander une autorisation écrite à UTE JETSKI CENTER - NOMAD NAUTIC pour naviguer dans des zones différentes de celles indiquées ici ou en dehors des eaux territoriales espagnoles.
    </p>
    <p class="clause">
      En cas de location d'un ${assetLabel}, celui-ci ne pourra pas naviguer à moins de 200 m de la zone réservée aux baigneurs délimitée par des bouées jaunes, ni à l'intérieur des chenaux balisés réservés aux entrées et sorties de ${assetLabelPlural}. Il est INTERDIT de se trouver à moins de 200 m du littoral, des plages ou des criques, sauf autorisation préalable de UTE JETSKI CENTER- NOMAD NAUTIC lorsque la zone de baignade n'est pas délimitée.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">3. UTILISATION DU JET-SKI.</div>
    <p class="clause">a. Le locataire s'engage à utiliser correctement le jet-ski loué et à respecter les règles établies par les autorités maritimes, douanières, sanitaires et fiscales, ainsi que par les polices nationales ou étrangères le cas échéant. En cas d'infraction aux règlements par le locataire, celui-ci prendra à sa charge toutes les sanctions, amendes et frais correspondants.</p>
    <p class="clause">b. Le locataire s'engage à ne pas transporter à bord un nombre de personnes supérieur à celui autorisé selon le certificat de sécurité du jet-ski, et à utiliser le jet-ski uniquement pour des sorties de plaisance. Il s'engage également à ne pas céder, sous-traiter ni sous-louer totalement ou partiellement le jet-ski.</p>
    <p class="clause">c. Le remorquage d'autres embarcations est strictement interdit, sauf en cas d'urgence. De même, le jet-ski loué ne pourra être remorqué que dans les mêmes cas et toujours avec ses propres aussières afin d'éviter des coûts élevés de sauvetage. Le locataire n'acceptera aucun accord et n'assumera aucune responsabilité sans l'autorisation de UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">d. Dans l'hypothèse où une récompense de sauvetage serait obtenue, elle sera répartie à 50 % pour UTE JETSKI CENTER- NOMAD NAUTIC et à 50 % pour le locataire.</p>
    <p class="clause">e. En cas de bulletins météorologiques dangereux concernant le temps ou la mer (supérieurs à force 6 Beaufort ou 27 noeuds de vent), le locataire s'engage à ne pas quitter le port où se trouve le jet-ski ou, le cas échéant, à rejoindre le port ou mouillage sûr le plus proche de sa position.</p>
    <p class="clause">f. Le locataire est responsable de tout dommage ou préjudice causé au jet-ski loué, de la perte de ses éléments et des retards dans la restitution du jet-ski.</p>

    <div class="clause-title">4. ASSURANCES.</div>
    <p class="clause">a. L'assurance du jet-ski est incluse dans le prix de la location.</p>
    <p class="clause">b. UTE JETSKI CENTER- NOMAD NAUTIC ne sera en aucun cas responsable des dommages corporels, pertes ou dommages que pourraient subir les effets personnels du locataire, des équipiers ou des invités à bord du jet-ski.</p>

    <div class="clause-title">5. RESTITUTION DU JET-SKI.</div>
    <p class="clause">a. Le locataire déclare connaître l'état de conservation du jet-ski et accepte donc expressément de le restituer dans les mêmes conditions que celles dans lesquelles il l'a reçu, avec les réservoirs de carburant. À défaut de restitution dans ces conditions, le coût du remplissage desdits réservoirs sera déduit du dépôt de garantie. Le coût du carburant est fixé à 25 € pour chaque ligne indiquée par la jauge.</p>
    <p class="clause">b. Lors de la restitution du jet-ski, UTE JETSKI CENTER- NOMAD NAUTIC procédera à son inspection, après quoi le dépôt de garantie sera restitué au locataire. Si des dommages au jet-ski ou une perte ou casse de son équipement sont constatés, UTE JETSKI CENTER- NOMAD NAUTIC déduira du dépôt le montant nécessaire à la réparation de ces dommages. UTE JETSKI CENTER- NOMAD NAUTIC se réserve le droit d'exiger un montant supérieur au dépôt si les frais de réparation dépassent le montant du dépôt versé.</p>
    <p class="clause">c. Le jet-ski devra être restitué dans le même port que celui où la remise a été effectuée. Le locataire supportera tous les frais découlant de tout changement de lieu de restitution. Ces frais seront de 10 euros par mille parcouru, plus le déplacement de l'équipage, et ce montant sera déduit du dépôt versé.</p>
    <p class="clause">d. Le locataire s'engage à informer UTE JETSKI CENTER- NOMAD NAUTIC de toute anomalie, incidence ou tout problème survenu pendant la navigation.</p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">6. RETARDS DANS LA RESTITUTION.</div>
    <p class="clause">En cas de retard dans la restitution du jet-ski, le locataire sera tenu aux obligations suivantes:</p>
    <p class="clause">a. Le locataire paiera à UTE JETSKI CENTER- NOMAD NAUTIC la part proportionnelle du temps supplémentaire utilisé, UTE JETSKI CENTER- NOMAD NAUTIC pouvant la déduire du montant du dépôt de garantie. Si, 24 heures après la fin du contrat, le jet-ski n'a pas été restitué et qu'aucune nouvelle n'a été reçue, les recherches seront engagées et sa disparition sera signalée aux autorités maritimes. Les frais qui en découleraient seront à la charge du locataire.</p>
    <p class="clause">Le temps consacré à la réparation des dommages présents sur le jet-ski sera également considéré comme un retard de restitution.</p>

    <div class="clause-title">7. DOMMAGES, ACCIDENTS ET PANNES.</div>
    <p class="clause">a) Si, pendant la période de location, des pannes, dommages, détériorations ou pertes de matériel surviennent sur le jet-ski loué, le locataire a l'obligation d'en informer immédiatement Barcodealquiler.com, qui lui indiquera les instructions à suivre.</p>
    <p class="clause">b) En cas d'accidents impliquant des tiers, ceux-ci doivent être déclarés par le locataire aux autorités compétentes, en notant les données des embarcations intervenues dans l'accident. Le locataire rédigera également un rapport sur les faits et le remettra à UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">c) Le locataire est tenu de communiquer à UTE JETSKI CENTER- NOMAD NAUTIC tout contact du jet-ski avec le fond marin afin de pouvoir en déterminer les conséquences et d'éviter de mettre en danger les équipages ultérieurs.</p>

    <div class="clause-title">8. ANNULATIONS ET RÉSILIATIONS</div>
    <p class="clause">En cas de négligence dans l'utilisation du jet-ski en infraction avec la législation en vigueur, cela constituera un motif de résiliation automatique du contrat, les sommes versées restant acquises à UTE JETSKI CENTER- NOMAD NAUTIC.</p>

    <div class="clause-title">9. DÉCLARATION DU CLIENT.</div>
    <p class="clause">Le client déclare ne pas avoir consommé d'alcool, de stupéfiants ni aucune substance psychoactive, et ne souffrir d'aucune maladie ou incapacité physique empêchant la conduite correcte du jet-ski.</p>

    <div class="clause-title">10. RESPONSABILITÉ ENVERS LES TIERS</div>
    <p class="clause">En cas de réclamations de tiers contre le locataire du fait de l'utilisation du jet-ski loué, UTE JETSKI CENTER- NOMAD NAUTIC sera exonérée de toute responsabilité. Le locataire répondra également conjointement des fautes pouvant être commises par le pilote du jet-ski.</p>

    <div class="clause-title">11. EXPÉRIENCE DU PILOTE.</div>
    <p class="clause">
      Le locataire assure posséder les connaissances et l'expérience nécessaires à la sortie et être titulaire du titre nautique suivant:
      <b>${licenseType}</b>, délivré par <b>${licenseSchool}</b>, qui désigne M./Mme
      <b>${driverName}</b>, titulaire du titre nautique mentionné ci-dessus, identifié par:
      <b>${driverDoc}</b>, comme pilote du jet-ski. En aucun cas la conduite du jet-ski ne pourra être confiée à une personne différente de celle indiquée comme pilote.
    </p>
    <p class="clause">
      UTE JETSKI CENTER- NOMAD NAUTIC se réserve le droit d'annuler le présent contrat si le pilote ne dispose pas de la formation et de la compétence suffisantes pour conduire le jet-ski en toute sécurité. Dans cette hypothèse, le locataire n'aura droit à aucun remboursement de la location; toutefois, UTE JETSKI CENTER- NOMAD NAUTIC pourra mettre un autre pilote à la disposition du locataire, s'il y en a un. Les honoraires que celui-ci pourrait facturer seront assumés par le locataire.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">12. EFFICACITÉ</div>
    <p class="clause">Dans l'hypothèse où l'une des clauses du contrat perdrait sa validité, cela n'affectera en aucune manière les autres clauses, qui resteront pleinement applicables entre les parties.</p>

    <div class="clause-title">13. PROTECTION DES DONNÉES</div>
    <p class="clause">Conformément aux dispositions de la Loi organique 15/1999 du 13 décembre relative à la protection des données à caractère personnel, par l'acceptation du présent contrat, nous vous informons que vos données personnelles seront traitées et intégrées dans des fichiers sous la responsabilité de UTE JETSKI CENTER- NOMAD NAUTIC, enregistrés auprès de l'Agence espagnole de protection des données, aux fins de gestion des clients et des contrats.</p>
    <p class="clause">Les données demandées sont nécessaires; à défaut de les fournir, il ne sera pas possible de fournir le service demandé. À cet égard, vous consentez expressément à leur collecte et à leur traitement pour la finalité indiquée. De même, vous autorisez la communication de vos données à caractère personnel à d'autres entités lorsque cela est nécessaire pour réaliser le service demandé.</p>
    <p class="clause">Vous autorisez également l'utilisation de vos données pour réaliser des communications périodiques, y compris celles effectuées par courrier électronique, que notre entreprise pourra envoyer pour informer des activités qu'elle développe elle-même ou par l'intermédiaire de ses entreprises collaboratrices. Dans tous les cas, vous pouvez exercer vos droits d'accès, de rectification, d'annulation et d'opposition en vous adressant à l'adresse électronique suivante: <b>SEARIDERSJETSKI@GMAIL.COM</b> ou en appelant le <b>608-10-12-72</b>.</p>

    <div class="clause-title">14. DROIT APPLICABLE ET JURIDICTION</div>
    <p class="clause">Le présent contrat est soumis à la législation espagnole. Toutes les questions litigieuses ou différends qui pourraient survenir dans l'exécution, la modification, la résiliation et les effets du présent contrat seront résolus par les tribunaux de la ville de BARCELONE, à la juridiction desquels les parties se soumettent expressément.</p>

    <div class="signature-zone">
      <p><b>En preuve de conformité</b>, les parties signent en double exemplaire le présent contrat de location de jet-ski au lieu et à la date indiqués ci-dessous:</p>
      <p><b>BADALONA le:</b> ${esc(dateText)}</p>

      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line">LE LOUEUR</div>
        </div>
        <div class="signature-box">
          ${signatureBlockHtml({
            signatureImageUrl: contract.signatureImageUrl,
            signatureSignedBy: contract.signatureSignedBy,
            signedAt: contract.signedAt,
            label: "LE LOCATAIRE",
          })}
        </div>
      </div>
    </div>

    <div class="final-box">
      <p>
        <b>À TITRE DE GARANTIE POUR LA BONNE UTILISATION DU ${assetLabelTitle} ET LE RESPECT DES CONDITIONS DE LOCATION, UN DÉPÔT DE GARANTIE DE 500 EUROS SERA DEMANDÉ AU MOMENT DE LA SIGNATURE DU CONTRAT OU AVANT LE DÉBUT DE L'ACTIVITÉ.</b>
      </p>
      <p><b>• CE DÉPÔT SERA INTÉGRALEMENT REMBOURSÉ À LA FIN DU SERVICE, À CONDITION QUE:</b></p>
      <p class="bullet">o LE ${assetLabelTitle} SOIT RESTITUÉ DANS LE MÊME ÉTAT QUE CELUI DANS LEQUEL IL A ÉTÉ REMIS.</p>
      <p class="bullet">o AUCUN DOMMAGE NI MAUVAIS USAGE DE L'ÉQUIPEMENT N'AIT ÉTÉ CONSTATÉ.</p>
      <p class="bullet">o LES RÈGLES DE SÉCURITÉ ET DE COMPORTEMENT INDIQUÉES PAR LE PERSONNEL AIENT ÉTÉ RESPECTÉES.</p>
      <p>LE PAIEMENT DU DÉPÔT DE GARANTIE POURRA ÊTRE EFFECTUÉ EN ESPÈCES OU PAR CARTE BANCAIRE, SELON DISPONIBILITÉ.</p>
      <p>
        Le client autorise UTE JERSKI CENTER- NOMAD NAUTIC à utiliser les photographies et vidéos prises pendant l'activité pour leur publication sur les réseaux sociaux, le site web et les supports publicitaires de l'entreprise. Cette autorisation est gratuite et pourra être révoquée à tout moment par notification écrite.
      </p>
    </div>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

</body>
</html>
`.trim();
}

function buildBoatLicensedEnglishHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Address: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";

  const priceText = eurosFromCents(reservation.totalPriceCents);
  const depositText = "500 €";

  const driverName = esc(contract.driverName || "");
  const driverDocType = esc(contract.driverDocType || "");
  const driverDoc = esc(contract.driverDocNumber || "");
  const driverAddress = esc(contract.driverAddress || "");
  const driverPostalCode = esc(contract.driverPostalCode || "");
  const driverCountry = esc(contract.driverCountry || "");
  const driverBirthDate = esc(formatDate(contract.driverBirthDate));
  const driverPhone = esc(contract.driverPhone || "");
  const driverEmail = esc(contract.driverEmail || "");
  const licenseSchool = esc(contract.licenseSchool || "");
  const licenseType = esc(contract.licenseType || "");
  const licenseNumber = esc(contract.licenseNumber || "");

  const resourceName = contract.preparedAsset
    ? `${contract.preparedAsset.name ?? "BOAT"}${contract.preparedAsset.type ? ` ${contract.preparedAsset.type}` : ""}`.trim()
    : "PENDING ASSIGNMENT";
  const resourceType = contract.preparedAsset?.type || "BOAT";
  const resourcePlate = contract.preparedAsset?.plate ?? "";
  const assetLabel = "boat";
  const assetLabelPlural = "boats";
  const assetLabelTitle = "BOAT";
  const dispatchPersonsText =
    reservation.pax ? `MAXIMUM ${reservation.pax} PERSONS ON BOARD` : "";

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Contract ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111;
    }

    .page {
      padding: 16mm 14mm 14mm 14mm;
      min-height: calc(297mm - 30mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 10px;
      text-align: center;
      margin-bottom: 8px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin-bottom: 6px;
    }

    .logo {
      height: 62px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0 16px 0;
      text-transform: uppercase;
    }

    .intro {
      margin-bottom: 14px;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #222;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 12px;
    }

    th {
      background: #f5f5f5;
      text-align: center;
      font-weight: 700;
    }

    .label-cell {
      width: 110px;
      font-weight: 700;
      background: #fafafa;
      text-align: left;
    }

    .section-title {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      margin: 10px 0 12px 0;
      text-transform: uppercase;
    }

    .clause-title {
      font-weight: 700;
      font-size: 12px;
      margin: 10px 0 6px 0;
      text-transform: uppercase;
    }

    .clause {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .signature-zone {
      margin-top: 18px;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 12px;
    }

    .signature-box {
      min-height: 80px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .signature-line {
      width: 220px;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 6px;
      font-size: 11px;
    }

    .final-box {
      margin-top: 18px;
      page-break-inside: avoid;
    }

    .final-box p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .bullet {
      margin-left: 18px;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      text-align: center;
      border-top: 1px solid #999;
      padding-top: 5px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">LICENSED BOAT RENTAL CONTRACT</div>

    <p class="intro">
      On the one hand, UTE JETSKI CENTER- NOMAD NAUTIC, registered at C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA) with tax ID B- U16457343 (hereinafter the Lessor), and on the other hand,
    </p>

    <table>
      <tr>
        <td class="label-cell">Name</td>
        <td colspan="5">${driverName}</td>
      </tr>
      <tr>
        <td class="label-cell">Document type</td>
        <td colspan="2">${driverDocType}</td>
        <td class="label-cell">Document number</td>
        <td colspan="2">${driverDoc}</td>
      </tr>
      <tr>
        <td class="label-cell">Date of birth</td>
        <td colspan="2">${driverBirthDate}</td>
        <td class="label-cell">Phone</td>
        <td colspan="2">${driverPhone}</td>
      </tr>
      <tr>
        <td class="label-cell">Address</td>
        <td colspan="2">${driverAddress}</td>
        <td class="label-cell">Post code</td>
        <td>${driverPostalCode}</td>
        <td>${driverCountry}</td>
      </tr>
      <tr>
        <td class="label-cell">Email</td>
        <td colspan="5">${driverEmail}</td>
      </tr>
      <tr>
        <td class="label-cell">License</td>
        <td colspan="2">${licenseType}</td>
        <td class="label-cell">License number</td>
        <td colspan="2">${licenseNumber}</td>
      </tr>
      <tr>
        <td class="label-cell">School / issuer</td>
        <td colspan="5">${licenseSchool}</td>
      </tr>
    </table>

    <p class="intro">
      Hereinafter the Hirer. The Lessor rents the following boat to the Hirer:
    </p>

    <table>
      <tr>
        <th>Type</th>
        <th>Name</th>
        <th>Registration</th>
        <th>Authorized persons</th>
      </tr>
      <tr>
        <td>${esc(resourceType)}</td>
        <td>${esc(resourceName)}</td>
        <td>${esc(resourcePlate)}</td>
        <td>${esc(dispatchPersonsText)}</td>
      </tr>
    </table>

    <p class="intro"><b>Boarding and disembarkation port:</b> PORT ESPORTIU DE BADALONA</p>

    <p class="intro">The rental period is:</p>

    <table>
      <tr>
        <th colspan="2">From</th>
        <th colspan="2">Until</th>
      </tr>
      <tr>
        <td class="label-cell">Day:</td>
        <td>${esc(dateText)}</td>
        <td class="label-cell">Day:</td>
        <td>${esc(dateText)}</td>
      </tr>
      <tr>
        <td class="label-cell">Time:</td>
        <td>${esc(startTimeText)}</td>
        <td class="label-cell">Time:</td>
        <td>${esc(endTimeText)}</td>
      </tr>
    </table>

    <p class="intro">
      The rental price is set at <b>${esc(priceText)}</b>, VAT included, plus a deposit of <b>${esc(depositText)}</b>.
    </p>

    <div class="section-title">CLAUSES:</div>

    <div class="clause-title">1. DELIVERY OF THE BOAT.</div>
    <p class="clause">
      a. At the time of delivery, the hirer shall check the general condition of the hull and the fuel level, undertaking to return the ${assetLabel} in the same condition in which it was delivered by the lessor.
    </p>

    <div class="clause-title">2. NAVIGATION AREA.</div>
    <p class="clause">
      The permitted navigation area is limited to the Catalan and Valencian coasts and the Balearic Islands. The hirer must request written permission from UTE JETSKI CENTER - NOMAD NAUTIC to navigate in areas other than those stated here or outside Spanish territorial waters.
    </p>
    <p class="clause">
      If renting a ${assetLabel}, it may not navigate within 200m of the area reserved for bathers marked with yellow buoys, nor inside the buoyed channels reserved for the entry and exit of ${assetLabelPlural}. It is FORBIDDEN to be within 200m of the coastline, beaches or coves unless prior permission has been granted by UTE JETSKI CENTER- NOMAD NAUTIC when the bathing area is not delimited.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">3. USE OF THE BOAT.</div>
    <p class="clause">a. The hirer undertakes to use the rented boat correctly and to comply with the rules established by the maritime, customs, health and tax authorities, as well as with national or foreign police authorities where applicable. In the event of any breach of regulations by the hirer, the hirer shall bear all penalties, fines and related costs.</p>
    <p class="clause">b. The hirer undertakes not to carry more persons on board than permitted by the boat's safety certificate and to use the boat only for leisure cruising. The hirer also undertakes not to assign, subcontract or sublet the boat in whole or in part.</p>
    <p class="clause">c. Towing other boats is strictly prohibited except in cases of emergency. Likewise, the rented boat may only be towed in the same circumstances and always using its own lines in order to avoid high salvage costs. The hirer shall not accept agreements or assume liabilities without authorization from UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">d. If any salvage reward is obtained, it shall be divided 50% for UTE JETSKI CENTER- NOMAD NAUTIC and 50% for the hirer.</p>
    <p class="clause">e. In the event of dangerous weather or sea forecasts (above Beaufort force 6 or 27 knots of wind), the hirer undertakes not to leave the port where the boat is located or otherwise to proceed to the nearest safe port or anchorage.</p>
    <p class="clause">f. The hirer is responsible for any damage or loss affecting the rented boat, for the loss of its equipment and for any delay in returning the boat.</p>

    <div class="clause-title">4. INSURANCE.</div>
    <p class="clause">a. The boat insurance is included in the rental price.</p>
    <p class="clause">b. UTE JETSKI CENTER- NOMAD NAUTIC shall not in any case be liable for personal injuries or for any loss of or damage to the personal belongings of the hirer, crew or guests on board the boat.</p>

    <div class="clause-title">5. RETURN OF THE BOAT.</div>
    <p class="clause">a. The hirer declares that they know the condition of the boat and therefore expressly agrees to return it in the same condition in which it was received, with the fuel tanks filled. If it is not returned in these conditions, the cost of refilling the tanks shall be deducted from the deposit. The fuel cost is set at 25€ for each line indicated on the gauge.</p>
    <p class="clause">b. Upon return of the boat, UTE JETSKI CENTER- NOMAD NAUTIC shall inspect it, after which the deposit shall be returned to the hirer. If any damage to the boat or any loss or breakage of equipment is found, UTE JETSKI CENTER- NOMAD NAUTIC shall deduct from the deposit the amount necessary to repair such damage. UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to claim an amount exceeding the deposit if repair costs are higher than the deposit paid.</p>
    <p class="clause">c. The boat must be returned to the same port where delivery took place. The hirer shall bear all expenses arising from any change to the return location. These costs shall be 10 euros per mile travelled plus the crew transfer costs, and this amount shall be deducted from the deposit paid.</p>
    <p class="clause">d. The hirer undertakes to inform UTE JETSKI CENTER- NOMAD NAUTIC of any anomaly, incident or problem that may have arisen during navigation.</p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">6. LATE RETURN.</div>
    <p class="clause">If there is any delay in returning the boat, the hirer shall be obliged as follows:</p>
    <p class="clause">a. The hirer shall pay UTE JETSKI CENTER- NOMAD NAUTIC the proportional amount for the extra time used, and UTE JETSKI CENTER- NOMAD NAUTIC may deduct it from the deposit. If, after 24 hours from the end of the contract, the boat has not been returned and there is no news of it, a search shall be initiated and its disappearance shall be reported to the maritime authorities. Any resulting costs shall be borne by the hirer.</p>
    <p class="clause">The time required to repair any damage to the boat shall also be considered a delay in return.</p>

    <div class="clause-title">7. DAMAGE, ACCIDENTS AND BREAKDOWNS.</div>
    <p class="clause">a) If, during the rental period, the rented boat suffers breakdowns, damage, defects or loss of equipment, the hirer is obliged to inform Barcodealquiler.com immediately, which shall provide the appropriate instructions to follow.</p>
    <p class="clause">b) If accidents involving third parties occur, they must be reported by the hirer to the competent authorities, recording the details of the boats involved in the accident. The hirer must also draw up a report on what happened and deliver it to UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">c) The hirer is obliged to inform UTE JETSKI CENTER- NOMAD NAUTIC of any contact between the boat and the seabed so that the consequences of such contacts can be assessed and later crews are not put at risk.</p>

    <div class="clause-title">8. CANCELLATIONS AND TERMINATION</div>
    <p class="clause">Any negligence in the use of the boat in breach of current legislation shall be grounds for automatic termination of the contract, and any amounts paid shall remain with UTE JETSKI CENTER- NOMAD NAUTIC.</p>

    <div class="clause-title">9. CUSTOMER DECLARATION.</div>
    <p class="clause">The customer declares that they have not consumed alcohol, narcotics or psychoactive substances and that they do not suffer from any illness or physical impairment preventing the safe handling of the boat.</p>

    <div class="clause-title">10. LIABILITY TOWARDS THIRD PARTIES</div>
    <p class="clause">If any claims are brought by third parties against the hirer due to the use of the rented boat, UTE JETSKI CENTER- NOMAD NAUTIC shall be exempt from any liability. The hirer shall also be jointly liable for any offences committed by the skipper of the boat.</p>

    <div class="clause-title">11. SKIPPER EXPERIENCE.</div>
    <p class="clause">
      The hirer states that they have the knowledge and experience necessary for the voyage and that they hold the following nautical license:
      <b>${licenseType}</b> issued by <b>${licenseSchool}</b>, designating Mr./Ms.
      <b>${driverName}</b>, holder of the nautical license mentioned above, identified as:
      <b>${driverDoc}</b>, as skipper of the boat. Under no circumstances may command of the boat be handed over to a person other than the one recorded as skipper.
    </p>
    <p class="clause">
      UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to cancel this contract if the skipper does not have sufficient training and competence to operate the boat safely. In that case, the hirer shall not be entitled to any rental refund; however, UTE JETSKI CENTER- NOMAD NAUTIC may provide another skipper to the hirer, if available. Any fees charged by that skipper shall be borne by the hirer.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">12. VALIDITY</div>
    <p class="clause">If any clause of the contract loses its validity, this shall in no way affect the others, which shall remain fully effective between the parties.</p>

    <div class="clause-title">13. DATA PROTECTION</div>
    <p class="clause">In compliance with Organic Law 15/1999, of 13 December, on the Protection of Personal Data, by accepting this contract you are informed that your personal data shall be processed and incorporated into files for which UTE JETSKI CENTER- NOMAD NAUTIC is responsible, registered with the Spanish Data Protection Agency, for the purpose of customer and contract management.</p>
    <p class="clause">The requested data are necessary, and if they are not provided it will not be possible to deliver the requested service. In this regard, you expressly consent to their collection and processing for the stated purpose. Likewise, you authorize the communication of your personal data to other entities when necessary to provide the requested service.</p>
    <p class="clause">You also authorize the use of your data for periodic communications, including those sent by email, which our company may carry out to inform you of activities it performs directly or through partner companies. In all cases, you may exercise your rights of access, rectification, cancellation and objection by contacting the following email address: <b>SEARIDERSJETSKI@GMAIL.COM</b> or by calling <b>608-10-12-72</b>.</p>

    <div class="clause-title">14. GOVERNING LAW AND JURISDICTION</div>
    <p class="clause">This contract is governed by Spanish law. Any disputes or differences that may arise in connection with the performance, amendment, termination or effects of this contract shall be resolved by the courts of the city of BARCELONA, to whose jurisdiction the parties expressly submit.</p>

    <div class="signature-zone">
      <p><b>In witness whereof</b>, the parties sign this boat rental contract in duplicate at the place and date set out below:</p>
      <p><b>BADALONA on:</b> ${esc(dateText)}</p>

      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line">LESSOR</div>
        </div>
        <div class="signature-box">
          ${signatureBlockHtml({
            signatureImageUrl: contract.signatureImageUrl,
            signatureSignedBy: contract.signatureSignedBy,
            signedAt: contract.signedAt,
            label: "HIRER",
          })}
        </div>
      </div>
    </div>

    <div class="final-box">
      <p>
        <b>AS A GUARANTEE FOR THE CORRECT USE OF THE ${assetLabelTitle} AND COMPLIANCE WITH THE RENTAL TERMS, A 500 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS.</b>
      </p>
      <p><b>• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:</b></p>
      <p class="bullet">o THE ${assetLabelTitle} IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED.</p>
      <p class="bullet">o NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED.</p>
      <p class="bullet">o THE SAFETY AND BEHAVIOUR RULES GIVEN BY STAFF HAVE BEEN FOLLOWED.</p>
      <p>THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY.</p>
      <p>
        The customer authorizes UTE JERSKI CENTER- NOMAD NAUTIC to use the photographs and videos taken during the activity for publication on social media, the website and the company's advertising material. This authorization is free of charge and may be revoked at any time by written notice.
      </p>
    </div>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

</body>
</html>
`.trim();
}

function buildLicensedHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC · CIF: U16457343 · Tel: 608101272 · Email: seariderjetski@gmail.com · Dirección: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA)";

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "—";

  const priceText = eurosFromCents(reservation.totalPriceCents);
  const depositText = "500 €";

  const driverName = esc(contract.driverName || "");
  const driverDocType = esc(contract.driverDocType || "");
  const driverDoc = esc(contract.driverDocNumber || "");
  const driverAddress = esc(contract.driverAddress || "");
  const driverPostalCode = esc(contract.driverPostalCode || "");
  const driverCountry = esc(contract.driverCountry || "");
  const driverBirthDate = esc(formatDate(contract.driverBirthDate));
  const driverPhone = esc(contract.driverPhone || "");
  const driverEmail = esc(contract.driverEmail || "");
  const licenseSchool = esc(contract.licenseSchool || "");
  const licenseType = esc(contract.licenseType || "");
  const licenseNumber = esc(contract.licenseNumber || "");

  const resourceName = contract.preparedJetski
    ? `${contract.preparedJetski.model ?? "MOTO"}${contract.preparedJetski.number ? ` ${contract.preparedJetski.number}` : ""}`.trim()
    : contract.preparedAsset
      ? `${contract.preparedAsset.name ?? "EMBARCACIÓN"}${contract.preparedAsset.type ? ` ${contract.preparedAsset.type}` : ""}`.trim()
      : "PENDIENTE DE ASIGNACIÓN";

  const resourcePlate =
    contract.preparedJetski?.plate ??
    contract.preparedAsset?.plate ??
    "";

  const isJetskiContract =
    reservation.serviceCategory === "JETSKI" ||
    Boolean(contract.preparedJetski);
  const assetLabel = isJetskiContract ? "moto de agua" : "embarcación";
  const assetLabelPlural = isJetskiContract ? "motos de agua" : "embarcaciones";
  const assetLabelTitle = isJetskiContract ? "MOTO DE AGUA" : "EMBARCACIÓN";

  const dispatchPersonsText =
    reservation.pax ? `MÁXIMO ${reservation.pax} PERSONAS EN LA ${assetLabelTitle}` : "";

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Contrato ${esc(contract.id)}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      color: #111;
    }

    .page {
      padding: 16mm 14mm 14mm 14mm;
      min-height: calc(297mm - 30mm);
      box-sizing: border-box;
      position: relative;
    }

    .page-break {
      page-break-before: always;
    }

    .top-legal {
      font-size: 10px;
      text-align: center;
      margin-bottom: 8px;
      color: #111;
    }

    .logo-wrap {
      text-align: center;
      margin-bottom: 6px;
    }

    .logo {
      height: 62px;
      object-fit: contain;
    }

    .title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin: 8px 0 16px 0;
      text-transform: uppercase;
    }

    .intro {
      margin-bottom: 14px;
      text-align: justify;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 14px 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #222;
      padding: 5px 7px;
      vertical-align: top;
      font-size: 12px;
    }

    th {
      background: #f5f5f5;
      text-align: center;
      font-weight: 700;
    }

    .label-cell {
      width: 110px;
      font-weight: 700;
      background: #fafafa;
      text-align: left;
    }

    .section-title {
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      margin: 10px 0 12px 0;
      text-transform: uppercase;
    }

    .clause-title {
      font-weight: 700;
      font-size: 12px;
      margin: 10px 0 6px 0;
      text-transform: uppercase;
    }

    .clause {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .signature-zone {
      margin-top: 18px;
    }

    .signature-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 12px;
    }

    .signature-box {
      min-height: 80px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .signature-line {
      width: 220px;
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 6px;
      font-size: 11px;
    }

    .final-box {
      margin-top: 18px;
      page-break-inside: avoid;
    }

    .final-box p {
      margin: 0 0 8px 0;
      text-align: justify;
    }

    .bullet {
      margin-left: 18px;
    }

    .footer {
      position: absolute;
      left: 14mm;
      right: 14mm;
      bottom: 6mm;
      font-size: 10px;
      color: #444;
      text-align: center;
      border-top: 1px solid #999;
      padding-top: 5px;
    }
  </style>
</head>
<body>

  <div class="page">

    <div class="logo-wrap">
      <img src="${esc(input.logoSrc)}" class="logo" />
    </div>

    <div class="title">CONTRATO DE ${assetLabelTitle} CON LICENCIA</div>

    <p class="intro">
      De una parte, la entidad UTE JETSKI CENTER- NOMAD NAUTIC · domiciliada en C/ MARINA L-401 402, NUM 401 402 08330 PREMIÀ DE MAR - (BARCELONA) provista de CIF B- U16457343 (en adelante Arrendador), y de otra parte,
    </p>

    <table>
      <tr>
        <td class="label-cell">Nombre</td>
        <td colspan="5">${driverName}</td>
      </tr>
      <tr>
        <td class="label-cell">Tipo documento</td>
        <td colspan="2">${driverDocType}</td>
        <td class="label-cell">Número documento</td>
        <td colspan="2">${driverDoc}</td>
      </tr>
      <tr>
        <td class="label-cell">Fecha nacimiento</td>
        <td colspan="2">${driverBirthDate}</td>
        <td class="label-cell">Teléfono</td>
        <td colspan="2">${driverPhone}</td>
      </tr>
      <tr>
        <td class="label-cell">Dirección</td>
        <td colspan="2">${driverAddress}</td>
        <td class="label-cell">C.P.</td>
        <td>${driverPostalCode}</td>
        <td>${driverCountry}</td>
      </tr>
      <tr>
        <td class="label-cell">Email</td>
        <td colspan="5">${driverEmail}</td>
      </tr>
      <tr>
        <td class="label-cell">Licencia</td>
        <td colspan="2">${licenseType}</td>
        <td class="label-cell">Número licencia</td>
        <td colspan="2">${licenseNumber}</td>
      </tr>
      <tr>
        <td class="label-cell">Escuela / emisor</td>
        <td colspan="5">${licenseSchool}</td>
      </tr>
    </table>

    <p class="intro">
      En adelante Arrendatario. El Arrendador arrienda al Arrendatario, la embarcación:
    </p>

    <table>
      <tr>
        <th>Tipo</th>
        <th>Nombre</th>
        <th>Matrícula</th>
        <th>Despacho Personas</th>
      </tr>
      <tr>
        <td>${esc(preparedResourceSummary(contract).kind)}</td>
        <td>${esc(resourceName)}</td>
        <td>${esc(resourcePlate)}</td>
        <td>${esc(dispatchPersonsText)}</td>
      </tr>
    </table>

    <p class="intro"><b>Puerto de embarque y desembarque:</b> PORT ESPORTIU DE BADALONA</p>

    <p class="intro">El periodo de arrendamiento comprende:</p>

    <table>
      <tr>
        <th colspan="2">Desde</th>
        <th colspan="2">Hasta</th>
      </tr>
      <tr>
        <td class="label-cell">Día:</td>
        <td>${esc(dateText)}</td>
        <td class="label-cell">Día:</td>
        <td>${esc(dateText)}</td>
      </tr>
      <tr>
        <td class="label-cell">Hora:</td>
        <td>${esc(startTimeText)}</td>
        <td class="label-cell">Hora:</td>
        <td>${esc(endTimeText)}</td>
      </tr>
    </table>

    <p class="intro">
      El precio del arrendamiento se fija en la cantidad de <b>${esc(priceText)}</b> IVA incluido y una Fianza de <b>${esc(depositText)}</b> IVA incluido
    </p>

    <div class="section-title">CLÁUSULAS:</div>

    <div class="clause-title">1. ENTREGA DE LA EMBARCACIÓN.</div>
    <p class="clause">
      a. En el momento de la entrega, el arrendatario revisará el estado general del casco y el nivel de combustible, comprometiéndose a entregar la ${assetLabel} en el mismo estado en el que le fue entregada por el arrendador.
    </p>

    <div class="clause-title">2. ZONA DE NAVEGACIÓN.</div>
    <p class="clause">
      La zona de navegación permitida se establece dentro del litoral catalán, valenciano e Islas Baleares. El arrendatario solicitará un permiso escrito de UTE JETSKI CENTER - NOMAD NAUTIC para navegar por zonas diferentes a las aquí referidas o fuera de las Aguas Territoriales Españolas.
    </p>
    <p class="clause">
      En el caso de alquilar una ${assetLabel}, esta no podrá navegar a menos de 200m de la zona reservada para los bañistas delimitada con boyas amarillas, ni por dentro de los canales balizados reservados para las entradas y salidas de ${assetLabelPlural}. Está PROHIBIDO estar a menos de 200m de la costa, playas o calas salvo permiso previo UTE JETSKI CENTER- NOMAD NAUTIC cuando la zona de bañistas no esté delimitada.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">3. USO DE LA EMBARCACIÓN.</div>
    <p class="clause">a. El arrendatario se obliga a utilizar la embarcación alquilada correctamente y respetar las normas establecidas por las autoridades marítimas, aduaneras, sanitarias y de hacienda, así como a las policías nacionales o extranjeras en su caso. En caso de infracción a las ordenanzas por parte del arrendatario, este se hará cargo de todas las sanciones, multas, etc.</p>
    <p class="clause">b. El arrendatario se obliga a no transportar a bordo un número mayor de personas que el permitido según el certificado de seguridad de la embarcación; a utilizar la embarcación solo para cruceros de recreo. Así mismo se obliga a no ceder, subcontratar o subarrendar total o parcialmente la embarcación.</p>
    <p class="clause">c. Queda totalmente prohibido el remolque de otras embarcaciones salvo en los casos de urgencia, así mismo solo se dejará remolcar la embarcación alquilada en los mismos casos y siempre con cabos propios para evitar los altos costes de salvamento. El arrendatario no aceptará acuerdos ni asumirá responsabilidades sin autorización de UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">d. En el supuesto de obtener un premio por salvamento, este se repartirá al 50% para UTE JETSKI CENTER- NOMAD NAUTIC y 50% para el arrendatario.</p>
    <p class="clause">e. En el caso de informes meteorológicos peligrosos sobre el tiempo o la mar (superior a fuerza 6 Beaufort o 27 nudos de viento) el arrendatario se obliga a no salir del puerto en el que se encuentre o bien a ir al puerto o fondeadero seguro más próximo de su posición.</p>
    <p class="clause">f. El arrendatario es responsable de cualquier daño o perjuicio que se produzca en la embarcación arrendada, de la pérdida de sus elementos y de los retrasos en la devolución de la embarcación.</p>

    <div class="clause-title">4. SEGUROS.</div>
    <p class="clause">a. En el precio del arrendamiento, está incluido el seguro de la embarcación.</p>
    <p class="clause">b. UTE JETSKI CENTER- NOMAD NAUTIC no será responsable en ningún caso de los daños a personas, las pérdidas o daños que pudieran sufrir los efectos personales del arrendatario, tripulantes o invitados a bordo de la embarcación.</p>

    <div class="clause-title">5. DEVOLUCIÓN DE LA EMBARCACIÓN.</div>
    <p class="clause">a. El arrendatario declara conocer el estado de conservación de la embarcación, por tanto, acepta expresamente entregar la embarcación en las mismas condiciones en que la recibió, con los depósitos de combustible. De no entregarse en estas condiciones, se deducirá de la fianza el coste de llenado de dichos depósitos. El coste del combustible se fija en 25€ por cada línea que marca el aforador.</p>
    <p class="clause">b. Al devolver la embarcación, se llevará a cabo una revisión de la misma, por parte de UTE JETSKI CENTER- NOMAD NAUTIC, tras lo cual la fianza será restituida al arrendatario. Si se encuentran daños en la embarcación o pérdida o rotura de su equipamiento, UTE JETSKI CENTER- NOMAD NAUTIC reducirá de la fianza el importe necesario para arreglar dichos daños. UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho a exigir un importe que supere el de la fianza, si los gastos por las reparaciones superan el importe de la fianza depositada.</p>
    <p class="clause">c. La embarcación deberá devolverse en el mismo puerto en el que se realizó la entrega. El arrendatario soportará todos los gastos derivados de este cambio en el lugar de devolución. Dichos gastos serán de 10 euros por milla recorrida más el desplazamiento de la tripulación reduciéndose este importe de la fianza depositada.</p>
    <p class="clause">d. El arrendatario se compromete a informar a UTE JETSKI CENTER- NOMAD NAUTIC de cualquier anomalía o incidencia o problemas que hayan surgido durante la navegación.</p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">6. RETRASOS EN LA DEVOLUCIÓN.</div>
    <p class="clause">En el caso de que se produzca un retraso en la devolución de la embarcación el arrendatario estará obligado:</p>
    <p class="clause">a. El arrendatario pagará a UTE JETSKI CENTER- NOMAD NAUTIC la parte proporcional del tiempo extra utilizado pudiendo UTE JETSKI CENTER- NOMAD NAUTIC restarlo del importe de la fianza. Si transcurridas 24 horas del término del contrato, no se ha devuelto la embarcación ni se tienen noticias de la misma, se iniciará la búsqueda comunicándose su desaparición a las autoridades de marina. Los gastos que de ello se deriven correrán a cargo del arrendatario.</p>
    <p class="clause">También será considerado como retraso en la devolución, el tiempo empleado para la reparación de los daños que presente la embarcación.</p>

    <div class="clause-title">7. DAÑOS, ACCIDENTES Y AVERÍAS.</div>
    <p class="clause">a) Si durante el periodo de alquiler, se producen en la embarcación arrendada averías, daños, desperfectos o pérdidas de material, el arrendatario está en la obligación de comunicarlo inmediatamente a Barcodealquiler.com el cual le dará las oportunas instrucciones a seguir.</p>
    <p class="clause">b) Si se producen accidentes con participación de terceros, estos deben ser declarados por el arrendatario ante las autoridades competentes, siendo anotados los datos de las embarcaciones que hayan intervenido en el accidente. El arrendatario, además, redactará un informe sobre lo ocurrido que entregará a UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">c) El arrendatario está obligado a comunicar a UTE JETSKI CENTER- NOMAD NAUTIC cualquier contacto de la embarcación con el fondo marino con el objeto de poder determinar las consecuencias de dichos contactos y evitar poner en peligro a posteriores tripulaciones.</p>

    <div class="clause-title">8. ANULACIONES Y RESOLUCIONES</div>
    <p class="clause">En el supuesto de negligencia en el uso de la embarcación infringiendo la legislación vigente, será motivo para la resolución automática del contrato, quedando las cantidades pagadas a favor de UTE JETSKI CENTER- NOMAD NAUTIC.</p>

    <div class="clause-title">9.</div>
    <p class="clause">El cliente declara no haber tomado alcohol ni haber consumido ninguna clase de estupefacientes así como sustancias psicoactivas y que no padece ninguna enfermedad o impedimento físico para el correcto manejo de la embarcación.</p>

    <div class="clause-title">10. RESPONSABILIDAD FRENTE A TERCEROS</div>
    <p class="clause">En el supuesto de reclamaciones por parte de terceros contra el arrendatario, por el uso de la embarcación alquilada, UTE JETSKI CENTER- NOMAD NAUTIC queda exonerada de cualquier tipo de responsabilidad. De las faltas que pueda cometer el patrón de la embarcación, responde también conjuntamente el arrendatario.</p>

    <div class="clause-title">11. EXPERIENCIA DEL PATRÓN.</div>
    <p class="clause">
      El arrendatario asegura que posee los conocimientos y la experiencia necesarios para la realización del crucero y que posee el siguiente título náutico:
      <b>${esc(contract.licenseType || "")}</b> expedido por <b>${esc(contract.licenseSchool || "")}</b> que designa al Sr./Sra
      <b>${esc(contract.driverName || "")}</b> que es poseedor del título náutico mencionado anteriormente con identificación:
      <b>${esc(contract.driverDocNumber || "")}</b> como patrón de la embarcación. En ningún caso podrá cederse el gobierno de la embarcación a persona distinta a la que consta como patrón.
    </p>
    <p class="clause">
      UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho de cancelar el presente contrato si el patrón no dispusiera de la capacitación y competencia suficientes para el gobierno con seguridad de la embarcación. En este supuesto, el arrendador no tendrá derecho a devolución alguna del alquiler, no obstante, UTE JETSKI CENTER- NOMAD NAUTIC pondrá a disposición del arrendatario otro patrón (si lo hubiere). Los emolumentos que pudiera cobrar este, serán asumidos por el arrendatario.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">12. EFICACIA</div>
    <p class="clause">En el supuesto de que alguna de las cláusulas del contrato pierda su validez, esto no afectará de ningún modo a las demás que seguirán siendo, a todos los efectos, eficaces entre las partes.</p>

    <div class="clause-title">13. PROTECCIÓN DE DATOS</div>
    <p class="clause">En cumplimiento con lo establecido en la Ley Orgánica 15/1999, de 13 de diciembre, de Protección de Datos de Carácter Personal, con la aceptación del presente contrato, le informamos que sus datos personales serán tratados y quedarán incorporados en ficheros responsabilidad de UTE JETSKI CENTER- NOMAD NAUTIC registrados en la Agencia Española de Protección de Datos, con la finalidad de la gestión de los clientes y contratos.</p>
    <p class="clause">Se le solicitan resultan necesarios, de manera que de no facilitarse no será posible la prestación del servicio requerido, en este sentido, usted consiente expresamente la recogida y el tratamiento de los mismos para la citada finalidad. De igual forma, autoriza la comunicación de sus datos de carácter personal a otras entidades que sea necesario para realizar el servicio solicitado.</p>
    <p class="clause">También autoriza la utilización de sus datos para realizar comunicaciones periódicas, incluyendo las que se realizan vía correo electrónico, que nuestra empresa llevará a cabo para informar de las actividades que desarrolla por sí o a través de sus empresas colaboradoras. En todo caso, puede ejercitar los derechos de acceso, rectificación, cancelación y oposición dirigiéndose a la siguiente dirección de correo electrónico: <b>SEARIDERSJETSKI@GMAIL.COM</b> o llamando al <b>608-10-12-72</b>.</p>

    <div class="clause-title">14. DERECHO Y JURISDICCIÓN</div>
    <p class="clause">El presente contrato, está sometido a la legislación española. Todas las cuestiones litigiosas o diferencias que puedan surgir en la ejecución, modificación, resolución y efectos del presente contrato se resolverán en los tribunales de la ciudad de BARCELONA, a cuya jurisdicción se someten expresamente las partes.</p>

    <div class="signature-zone">
      <p><b>En prueba de conformidad</b>, las partes firman por duplicado el presente contrato de arrendamiento de embarcación en el lugar y fecha que figuran a continuación:</p>
      <p><b>BADALONA a :</b> ${esc(dateText)}</p>

      <div class="signature-row">
        <div class="signature-box">
          <div class="signature-line">EL ARRENDADOR</div>
        </div>
        <div class="signature-box">
          ${signatureBlockHtml({
            signatureImageUrl: contract.signatureImageUrl,
            signatureSignedBy: contract.signatureSignedBy,
            signedAt: contract.signedAt,
            label: "EL ARRENDATARIO",
          })}
        </div>
      </div>
    </div>

    <div class="final-box">
      <p>
        <b>COMO GARANTÍA POR EL CORRECTO USO DE LA ${assetLabelTitle} Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÁ UNA FIANZA DE 500 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.</b>
      </p>
      <p><b>• ESTA FIANZA SERÁ REEMBOLSADA ÍNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:</b></p>
      <p class="bullet">o LA ${assetLabelTitle} SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÓ.</p>
      <p class="bullet">o NO SE HAYA PRODUCIDO NINGÚN DAÑO O MAL USO DEL EQUIPO.</p>
      <p class="bullet">o SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.</p>
      <p>EL PAGO DE LA FIANZA PODRÁ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÚN DISPONIBILIDAD.</p>
      <p>
        El cliente autoriza a UTE JERSKI CENTER- NOMAD NAUTIC a utilizar las fotografías y vídeos tomados durante la actividad para su publicación en redes sociales, página web y material publicitario de la empresa. Esta autorización es gratuita y podrá ser revocada en cualquier momento mediante notificación por escrito.
      </p>
    </div>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

</body>
</html>
`.trim();
}
