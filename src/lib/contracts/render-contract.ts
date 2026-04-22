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
  if (!v) return "â€”";
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
  if (!v) return "â€”";
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
      name: contract.preparedAsset.name ?? "EMBARCACIÃ“N",
      plate: contract.preparedAsset.plate ?? "",
    };
  }

  return {
    kind: "RECURSO",
    name: "PENDIENTE DE ASIGNACIÃ“N",
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
        return buildJetskiNoLicenseHtml(input);
      case "JETSKI_LICENSED":
      case "BOAT_LICENSED":
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
          ${esc(args.label)}${args.signatureSignedBy ? ` Â· ${esc(args.signatureSignedBy)}` : ""}${signedDate ? ` Â· ${esc(signedDate)}` : ""}
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
    `${esc(contract.driverPostalCode || "")}${contract.driverCountry ? ` Â· ${esc(contract.driverCountry)}` : ""}`.trim();

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC Â· CIF: U16457343 Â· Tel: 608101272 Â· Email: seariderjetski@gmail.com Â· DirecciÃ³n: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÃ€ DE MAR - (BARCELONA)";

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

    <div class="title">ALQUILER DE MOTOS ACUÃTICAS SIN LICENCIA</div>
    <div class="subtitle">Plantilla ${esc(templateCode)} Â· VersiÃ³n ${esc(templateVersion)}</div>

    <div class="section-title">1. NORMAS DE NAVEGACIÃ“N</div>

    <p class="clause-item"><b>a.</b> Se saldrÃ¡ del puerto a una velocidad mÃ¡xima de 3 nudos.</p>
    <p class="clause-item"><b>b.</b> Se mantendrÃ¡ siempre una distancia mÃ­nima de seguridad de 50 metros entre las motos o respeto a otras embarcaciones.</p>
    <p class="clause-item"><b>c.</b> Las motos navegarÃ¡n en fila, siempre detrÃ¡s del monitor.</p>
    <p class="clause-item"><b>d.</b> Un monitor observarÃ¡ a las motos y a su tripulaciÃ³n durante la navegaciÃ³n y aclararÃ¡ cualquier duda que puedan tener al respecto.</p>
    <p class="clause-item"><b>e.</b> En caso de confusiÃ³n o no poder controlar la moto, debemos estirar de la llave que desconectarÃ¡ el motor y deberÃ¡ esperar sobre la moto a que venga el monitor, sin abandonar en ningÃºn caso la embarcaciÃ³n y efectuando seÃ±ales con los brazos hacia la direcciÃ³n del monitor.</p>
    <p class="clause-item"><b>f.</b> En ningÃºn caso, se permite conducir motos de agua a los menores de 18 aÃ±os. Los menores entre 16 y 18 aÃ±os deberÃ¡n presentar una autorizaciÃ³n firmada del padre/madre/ tutor legal.</p>
    <p class="clause-item"><b>g.</b> Es obligatorio el chaleco salvavidas.</p>
    <p class="clause-item"><b>h.</b> Antes de iniciar la navegaciÃ³n, asegÃºrese de haber comprendido las normas de seguridad y funcionamiento de la moto, no dude en consultar cualquier duda respecto a estas.</p>
    <p class="clause-item"><b>i.</b> EstÃ¡ totalmente prohibido entrar a la zona de baÃ±istas y se mantendrÃ¡ siempre una distancia mÃ­nima de 300 metros respecto a la playa y de 50 metros entre las motos y las demÃ¡s embarcaciones.</p>

    <div class="section-title">2. CONDICIONES DEL CONTRATO</div>

    <p class="clause-item"><b>a.</b> El usuario se compromete a leer y respetar las normas de seguridad detalladas en el contrato.</p>
    <p class="clause-item"><b>b.</b> El usuario que infrinja cualquiera de las normas de seguridad y navegaciÃ³n detalladas en el contrato responderÃ¡ ante las autoridades espaÃ±olas, en caso de responsabilidad civil, dando lugar a la cancelaciÃ³n instantÃ¡nea del contrato de alquiler sin derecho a la reclamaciÃ³n o indemnizaciÃ³n y se somete expresamente al fuero de los tribunales de Barcelona.</p>
    <p class="clause-item"><b>c.</b> Esta actividad estÃ¡ cubierta con una pÃ³liza de responsabilidad civil.</p>
    <p class="clause-item"><b>d.</b> El usuario reconoce que recibe el vehÃ­culo en perfectas condiciones y se compromete a conservar en buen estado, a conducir respetando las normas de navegaciÃ³n vigentes en este paÃ­s, asÃ­ como seguir con las normas indicadas anteriormente.</p>
    <p class="clause-item"><b>e.</b> El usuario libera de toda responsabilidad civil a la empresa o persona fÃ­sica de todos los daÃ±os fÃ­sicos que se puedan causar por el mal uso y el errÃ³neo disfrute de los servicios que se le proporcionarÃ¡n por esta empresa.</p>
    <p class="clause-item"><b>f.</b> Queda totalmente prohibido el uso del telÃ©fono mÃ³vil, a menos que el instructor dÃ© permiso para utilizarlo. Solo se podrÃ¡ utilizar el telÃ©fono mÃ³vil cuando el instructor nos lo indique. El uso de este en cualquier otro momento puede comportar la retirada de fianza o cancelaciÃ³n de la actividad sin derecho a reclamaciÃ³n.</p>
    <p class="clause-item"><b>g.</b> El cliente declara no haber consumido ningÃºn tipo de drogas, alcohol o estupefacientes, asÃ­ como que no padece ninguna enfermedad, en la que la actividad pueda peligrar su salud.</p>
    <p class="clause-item"><b>h.</b> Si el usuario hace caso omiso al instructor, este suspenderÃ¡ la actividad sin que se pueda reclamar la devoluciÃ³n del dinero de la actividad, o la fianza de la misma.</p>
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
      En caso de accidente o rotura por negligencia del cliente, este se compromete a abonar los desperfectos causados en las motos de acuerdo con las tarifas de precios vigentes, y a rellenar la declaraciÃ³n del accidente con sus datos.
    </p>

    <div class="box">
      <div class="grid-2">
        <div class="field">
          <div class="field-label">NOMBRE Y APELLIDOS</div>
          <div class="field-line ${!name ? "empty" : ""}">${name || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">NOMBRE DEL MENOR O DEL ACOMPAÃ‘ANTE</div>
          <div class="field-line empty"> </div>
        </div>

        <div class="field">
          <div class="field-label">DIRECCIÃ“N</div>
          <div class="field-line ${!address ? "empty" : ""}">${address || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">${esc(driverDocLabel)}</div>
          <div class="field-line ${!docNumber ? "empty" : ""}">${docNumber || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">TELÃ‰FONO</div>
          <div class="field-line ${!phone ? "empty" : ""}">${phone || " "}</div>
        </div>
        <div class="field">
          <div class="field-label">EMAIL</div>
          <div class="field-line ${!email ? "empty" : ""}">${email || " "}</div>
        </div>

        <div class="field">
          <div class="field-label">CÃ“DIGO POSTAL / PAÃS</div>
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
        <div class="field-line">${esc(durationText)} Â· ${esc(startTimeText)} - ${esc(endTimeText)}</div>
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
      <div class="section-title" style="margin-top:0;">FIANZA Y AUTORIZACIÃ“N DE IMAGEN</div>

      <p class="clause-item">
        COMO GARANTÃA POR EL CORRECTO USO DE LA MOTO DE AGUA Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÃ UNA FIANZA DE 100 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.
      </p>

      <div class="bullet-block">
        <p><b>â€¢ ESTA FIANZA SERÃ REEMBOLSADA ÃNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:</b></p>
        <p><b>o</b> LA MOTO DE AGUA SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÃ“.</p>
        <p><b>o</b> NO SE HAYA PRODUCIDO NINGÃšN DAÃ‘O O MAL USO DEL EQUIPO.</p>
        <p><b>o</b> SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.</p>
      </div>

      <p class="clause-item" style="margin-top:10px;">
        EL PAGO DE LA FIANZA PODRÃ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÃšN DISPONIBILIDAD.
      </p>

      <p class="clause-item">
        El cliente autoriza a UTE JERSKI CENTER- NOMAD NAUTIC a utilizar las fotografÃ­as y vÃ­deos tomados durante la actividad para su publicaciÃ³n en redes sociales, pÃ¡gina web y material publicitario de la empresa. Esta autorizaciÃ³n es gratuita y podrÃ¡ ser revocada en cualquier momento mediante notificaciÃ³n por escrito.
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

function buildLicensedHtml(input: ContractRenderInput) {
  const { reservation, contract } = input;

  const legalHeader =
    "UTE JETSKI CENTER- NOMAD NAUTIC Â· CIF: U16457343 Â· Tel: 608101272 Â· Email: seariderjetski@gmail.com Â· DirecciÃ³n: C/ MARINA L-401 402, NUM 401 402 08330 PREMIÃ€ DE MAR - (BARCELONA)";

  const baseDate = reservation.scheduledTime ?? reservation.activityDate;
  const dateText = formatDate(baseDate);
  const startTimeText = formatTime(reservation.scheduledTime);
  const endTime = addMinutes(baseDate, reservation.durationMinutes);
  const endTimeText = endTime ? formatTime(endTime) : "â€”";

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
      ? `${contract.preparedAsset.name ?? "EMBARCACIÃ“N"}${contract.preparedAsset.type ? ` ${contract.preparedAsset.type}` : ""}`.trim()
      : "PENDIENTE DE ASIGNACIÃ“N";

  const resourcePlate =
    contract.preparedJetski?.plate ??
    contract.preparedAsset?.plate ??
    "";

  const isJetskiContract =
    reservation.serviceCategory === "JETSKI" ||
    Boolean(contract.preparedJetski);
  const assetLabel = isJetskiContract ? "moto de agua" : "embarcaciÃ³n";
  const assetLabelPlural = isJetskiContract ? "motos de agua" : "embarcaciones";
  const assetLabelTitle = isJetskiContract ? "MOTO DE AGUA" : "EMBARCACIÃ“N";

  const dispatchPersonsText =
    reservation.pax ? `MÃXIMO ${reservation.pax} PERSONAS EN LA ${assetLabelTitle}` : "";

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
      De una parte, la entidad UTE JETSKI CENTER- NOMAD NAUTIC Â· domiciliada en C/ MARINA L-401 402, NUM 401 402 08330 PREMIÃ€ DE MAR - (BARCELONA) provista de CIF B- U16457343 (en adelante Arrendador), y de otra parte,
    </p>

    <table>
      <tr>
        <td class="label-cell">Nombre</td>
        <td colspan="5">${driverName}</td>
      </tr>
      <tr>
        <td class="label-cell">Tipo documento</td>
        <td colspan="2">${driverDocType}</td>
        <td class="label-cell">NÃºmero documento</td>
        <td colspan="2">${driverDoc}</td>
      </tr>
      <tr>
        <td class="label-cell">Fecha nacimiento</td>
        <td colspan="2">${driverBirthDate}</td>
        <td class="label-cell">TelÃ©fono</td>
        <td colspan="2">${driverPhone}</td>
      </tr>
      <tr>
        <td class="label-cell">DirecciÃ³n</td>
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
        <td class="label-cell">NÃºmero licencia</td>
        <td colspan="2">${licenseNumber}</td>
      </tr>
      <tr>
        <td class="label-cell">Escuela / emisor</td>
        <td colspan="5">${licenseSchool}</td>
      </tr>
    </table>

    <p class="intro">
      En adelante Arrendatario. El Arrendador arrienda al Arrendatario, la embarcaciÃ³n:
    </p>

    <table>
      <tr>
        <th>Tipo</th>
        <th>Nombre</th>
        <th>MatrÃ­cula</th>
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
        <td class="label-cell">DÃ­a:</td>
        <td>${esc(dateText)}</td>
        <td class="label-cell">DÃ­a:</td>
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

    <div class="section-title">CLÃUSULAS:</div>

    <div class="clause-title">1. ENTREGA DE LA EMBARCACIÃ“N.</div>
    <p class="clause">
      a. En el momento de la entrega, el arrendatario revisarÃ¡ el estado general del casco y el nivel de combustible, comprometiÃ©ndose a entregar la ${assetLabel} en el mismo estado en el que le fue entregada por el arrendador.
    </p>

    <div class="clause-title">2. ZONA DE NAVEGACIÃ“N.</div>
    <p class="clause">
      La zona de navegaciÃ³n permitida se establece dentro del litoral catalÃ¡n, valenciano e Islas Baleares. El arrendatario solicitarÃ¡ un permiso escrito de UTE JETSKI CENTER â€“ NOMAD NAUTIC para navegar por zonas diferentes a las aquÃ­ referidas o fuera de las Aguas Territoriales EspaÃ±olas.
    </p>
    <p class="clause">
      En el caso de alquilar una ${assetLabel}, esta no podrÃ¡ navegar a menos de 200m de la zona reservada para los baÃ±istas delimitada con boyas amarillas, ni por dentro de los canales balizados reservados para las entradas y salidas de ${assetLabelPlural}. EstÃ¡ PROHIBIDO estar a menos de 200m de la costa, playas o calas salvo permiso previo UTE JETSKI CENTER- NOMAD NAUTIC cuando la zona de baÃ±istas no estÃ© delimitada.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">3. USO DE LA EMBARCACIÃ“N.</div>
    <p class="clause">a. El arrendatario se obliga a utilizar la embarcaciÃ³n alquilada correctamente y respetar las normas establecidas por las autoridades marÃ­timas, aduaneras, sanitarias y de hacienda, asÃ­ como a las policÃ­as nacionales o extranjeras en su caso. En caso de infracciÃ³n a las ordenanzas por parte del arrendatario, este se harÃ¡ cargo de todas las sanciones, multas, etc.</p>
    <p class="clause">b. El arrendatario se obliga a no transportar a bordo un nÃºmero mayor de personas que el permitido segÃºn el certificado de seguridad de la embarcaciÃ³n; a utilizar la embarcaciÃ³n solo para cruceros de recreo. AsÃ­ mismo se obliga a no ceder, subcontratar o subarrendar total o parcialmente la embarcaciÃ³n.</p>
    <p class="clause">c. Queda totalmente prohibido el remolque de otras embarcaciones salvo en los casos de urgencia, asÃ­ mismo solo se dejarÃ¡ remolcar la embarcaciÃ³n alquilada en los mismos casos y siempre con cabos propios para evitar los altos costes de salvamento. El arrendatario no aceptarÃ¡ acuerdos ni asumirÃ¡ responsabilidades sin autorizaciÃ³n de UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">d. En el supuesto de obtener un premio por salvamento, este se repartirÃ¡ al 50% para UTE JETSKI CENTER- NOMAD NAUTIC y 50% para el arrendatario.</p>
    <p class="clause">e. En el caso de informes meteorolÃ³gicos peligrosos sobre el tiempo o la mar (superior a fuerza 6 Beaufort o 27 nudos de viento) el arrendatario se obliga a no salir del puerto en el que se encuentre o bien a ir al puerto o fondeadero seguro mÃ¡s prÃ³ximo de su posiciÃ³n.</p>
    <p class="clause">f. El arrendatario es responsable de cualquier daÃ±o o perjuicio que se produzca en la embarcaciÃ³n arrendada, de la pÃ©rdida de sus elementos y de los retrasos en la devoluciÃ³n de la embarcaciÃ³n.</p>

    <div class="clause-title">4. SEGUROS.</div>
    <p class="clause">a. En el precio del arrendamiento, estÃ¡ incluido el seguro de la embarcaciÃ³n.</p>
    <p class="clause">b. UTE JETSKI CENTER- NOMAD NAUTIC no serÃ¡ responsable en ningÃºn caso de los daÃ±os a personas, las pÃ©rdidas o daÃ±os que pudieran sufrir los efectos personales del arrendatario, tripulantes o invitados a bordo de la embarcaciÃ³n.</p>

    <div class="clause-title">5. DEVOLUCIÃ“N DE LA EMBARCACIÃ“N.</div>
    <p class="clause">a. El arrendatario declara conocer el estado de conservaciÃ³n de la embarcaciÃ³n, por tanto, acepta expresamente entregar la embarcaciÃ³n en las mismas condiciones en que la recibiÃ³, con los depÃ³sitos de combustible. De no entregarse en estas condiciones, se deducirÃ¡ de la fianza el coste de llenado de dichos depÃ³sitos. El coste del combustible se fija en 25â‚¬ por cada lÃ­nea que marca el aforador.</p>
    <p class="clause">b. Al devolver la embarcaciÃ³n, se llevarÃ¡ a cabo una revisiÃ³n de la misma, por parte de UTE JETSKI CENTER- NOMAD NAUTIC, tras lo cual la fianza serÃ¡ restituida al arrendatario. Si se encuentran daÃ±os en la embarcaciÃ³n o pÃ©rdida o rotura de su equipamiento, UTE JETSKI CENTER- NOMAD NAUTIC reducirÃ¡ de la fianza el importe necesario para arreglar dichos daÃ±os. UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho a exigir un importe que supere el de la fianza, si los gastos por las reparaciones superan el importe de la fianza depositada.</p>
    <p class="clause">c. La embarcaciÃ³n deberÃ¡ devolverse en el mismo puerto en el que se realizÃ³ la entrega. El arrendatario soportarÃ¡ todos los gastos derivados de este cambio en el lugar de devoluciÃ³n. Dichos gastos serÃ¡n de 10 euros por milla recorrida mÃ¡s el desplazamiento de la tripulaciÃ³n reduciÃ©ndose este importe de la fianza depositada.</p>
    <p class="clause">d. El arrendatario se compromete a informar a UTE JETSKI CENTER- NOMAD NAUTIC de cualquier anomalÃ­a o incidencia o problemas que hayan surgido durante la navegaciÃ³n.</p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">6. RETRASOS EN LA DEVOLUCIÃ“N.</div>
    <p class="clause">En el caso de que se produzca un retraso en la devoluciÃ³n de la embarcaciÃ³n el arrendatario estarÃ¡ obligado:</p>
    <p class="clause">a. El arrendatario pagarÃ¡ a UTE JETSKI CENTER- NOMAD NAUTIC la parte proporcional del tiempo extra utilizado pudiendo UTE JETSKI CENTER- NOMAD NAUTIC restarlo del importe de la fianza. Si transcurridas 24 horas del tÃ©rmino del contrato, no se ha devuelto la embarcaciÃ³n ni se tienen noticias de la misma, se iniciarÃ¡ la bÃºsqueda comunicÃ¡ndose su desapariciÃ³n a las autoridades de marina. Los gastos que de ello se deriven correrÃ¡n a cargo del arrendatario.</p>
    <p class="clause">TambiÃ©n serÃ¡ considerado como retraso en la devoluciÃ³n, el tiempo empleado para la reparaciÃ³n de los daÃ±os que presente la embarcaciÃ³n.</p>

    <div class="clause-title">7. DAÃ‘OS, ACCIDENTES Y AVERÃAS.</div>
    <p class="clause">a) Si durante el periodo de alquiler, se producen en la embarcaciÃ³n arrendada averÃ­as, daÃ±os, desperfectos o pÃ©rdidas de material, el arrendatario estÃ¡ en la obligaciÃ³n de comunicarlo inmediatamente a Barcodealquiler.com el cual le darÃ¡ las oportunas instrucciones a seguir.</p>
    <p class="clause">b) Si se producen accidentes con participaciÃ³n de terceros, estos deben ser declarados por el arrendatario ante las autoridades competentes, siendo anotados los datos de las embarcaciones que hayan intervenido en el accidente. El arrendatario, ademÃ¡s, redactarÃ¡ un informe sobre lo ocurrido que entregarÃ¡ a UTE JETSKI CENTER- NOMAD NAUTIC.</p>
    <p class="clause">c) El arrendatario estÃ¡ obligado a comunicar a UTE JETSKI CENTER- NOMAD NAUTIC cualquier contacto de la embarcaciÃ³n con el fondo marino con el objeto de poder determinar las consecuencias de dichos contactos y evitar poner en peligro a posteriores tripulaciones.</p>

    <div class="clause-title">8. ANULACIONES Y RESOLUCIONES</div>
    <p class="clause">En el supuesto de negligencia en el uso de la embarcaciÃ³n infringiendo la legislaciÃ³n vigente, serÃ¡ motivo para la resoluciÃ³n automÃ¡tica del contrato, quedando las cantidades pagadas a favor de UTE JETSKI CENTER- NOMAD NAUTIC.</p>

    <div class="clause-title">9.</div>
    <p class="clause">El cliente declara no haber tomado alcohol ni haber consumido ninguna clase de estupefacientes asÃ­ como sustancias psicoactivas y que no padece ninguna enfermedad o impedimento fÃ­sico para el correcto manejo de la embarcaciÃ³n.</p>

    <div class="clause-title">10. RESPONSABILIDAD FRENTE A TERCEROS</div>
    <p class="clause">En el supuesto de reclamaciones por parte de terceros contra el arrendatario, por el uso de la embarcaciÃ³n alquilada, UTE JETSKI CENTER- NOMAD NAUTIC queda exonerada de cualquier tipo de responsabilidad. De las faltas que pueda cometer el patrÃ³n de la embarcaciÃ³n, responde tambiÃ©n conjuntamente el arrendatario.</p>

    <div class="clause-title">11. EXPERIENCIA DEL PATRÃ“N.</div>
    <p class="clause">
      El arrendatario asegura que posee los conocimientos y la experiencia necesarios para la realizaciÃ³n del crucero y que posee el siguiente tÃ­tulo nÃ¡utico:
      <b>${esc(contract.licenseType || "")}</b> expedido por <b>${esc(contract.licenseSchool || "")}</b> que designa al Sr./Sra
      <b>${esc(contract.driverName || "")}</b> que es poseedor del tÃ­tulo nÃ¡utico mencionado anteriormente con identificaciÃ³n:
      <b>${esc(contract.driverDocNumber || "")}</b> como patrÃ³n de la embarcaciÃ³n. En ningÃºn caso podrÃ¡ cederse el gobierno de la embarcaciÃ³n a persona distinta a la que consta como patrÃ³n.
    </p>
    <p class="clause">
      UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho de cancelar el presente contrato si el patrÃ³n no dispusiera de la capacitaciÃ³n y competencia suficientes para el gobierno con seguridad de la embarcaciÃ³n. En este supuesto, el arrendador no tendrÃ¡ derecho a devoluciÃ³n alguna del alquiler, no obstante, UTE JETSKI CENTER- NOMAD NAUTIC pondrÃ¡ a disposiciÃ³n del arrendatario otro patrÃ³n (si lo hubiere). Los emolumentos que pudiera cobrar este, serÃ¡n asumidos por el arrendatario.
    </p>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

  <div class="page page-break">

    <div class="clause-title">12. EFICACIA</div>
    <p class="clause">En el supuesto de que alguna de las clÃ¡usulas del contrato pierda su validez, esto no afectarÃ¡ de ningÃºn modo a las demÃ¡s que seguirÃ¡n siendo, a todos los efectos, eficaces entre las partes.</p>

    <div class="clause-title">13. PROTECCIÃ“N DE DATOS</div>
    <p class="clause">En cumplimiento con lo establecido en la Ley OrgÃ¡nica 15/1999, de 13 de diciembre, de ProtecciÃ³n de Datos de CarÃ¡cter Personal, con la aceptaciÃ³n del presente contrato, le informamos que sus datos personales serÃ¡n tratados y quedarÃ¡n incorporados en ficheros responsabilidad de UTE JETSKI CENTER- NOMAD NAUTIC registrados en la Agencia EspaÃ±ola de ProtecciÃ³n de Datos, con la finalidad de la gestiÃ³n de los clientes y contratos.</p>
    <p class="clause">Se le solicitan resultan necesarios, de manera que de no facilitarse no serÃ¡ posible la prestaciÃ³n del servicio requerido, en este sentido, usted consiente expresamente la recogida y el tratamiento de los mismos para la citada finalidad. De igual forma, autoriza la comunicaciÃ³n de sus datos de carÃ¡cter personal a otras entidades que sea necesario para realizar el servicio solicitado.</p>
    <p class="clause">TambiÃ©n autoriza la utilizaciÃ³n de sus datos para realizar comunicaciones periÃ³dicas, incluyendo las que se realizan vÃ­a correo electrÃ³nico, que nuestra empresa llevarÃ¡ a cabo para informar de las actividades que desarrolla por sÃ­ o a travÃ©s de sus empresas colaboradoras. En todo caso, puede ejercitar los derechos de acceso, rectificaciÃ³n, cancelaciÃ³n y oposiciÃ³n dirigiÃ©ndose a la siguiente direcciÃ³n de correo electrÃ³nico: <b>SEARIDERSJETSKI@GMAIL.COM</b> o llamando al <b>608-10-12-72</b>.</p>

    <div class="clause-title">14. DERECHO Y JURISDICCIÃ“N</div>
    <p class="clause">El presente contrato, estÃ¡ sometido a la legislaciÃ³n espaÃ±ola. Todas las cuestiones litigiosas o diferencias que puedan surgir en la ejecuciÃ³n, modificaciÃ³n, resoluciÃ³n y efectos del presente contrato se resolverÃ¡n en los tribunales de la ciudad de BARCELONA, a cuya jurisdicciÃ³n se someten expresamente las partes.</p>

    <div class="signature-zone">
      <p><b>En prueba de conformidad</b>, las partes firman por duplicado el presente contrato de arrendamiento de embarcaciÃ³n en el lugar y fecha que figuran a continuaciÃ³n:</p>
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
        <b>COMO GARANTÃA POR EL CORRECTO USO DE LA ${assetLabelTitle} Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÃ UNA FIANZA DE 500 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.</b>
      </p>
      <p><b>â€¢ ESTA FIANZA SERÃ REEMBOLSADA ÃNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:</b></p>
      <p class="bullet">o LA ${assetLabelTitle} SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÃ“.</p>
      <p class="bullet">o NO SE HAYA PRODUCIDO NINGÃšN DAÃ‘O O MAL USO DEL EQUIPO.</p>
      <p class="bullet">o SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.</p>
      <p>EL PAGO DE LA FIANZA PODRÃ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÃšN DISPONIBILIDAD.</p>
      <p>
        El cliente autoriza a UTE JERSKI CENTER- NOMAD NAUTIC a utilizar las fotografÃ­as y vÃ­deos tomados durante la actividad para su publicaciÃ³n en redes sociales, pÃ¡gina web y material publicitario de la empresa. Esta autorizaciÃ³n es gratuita y podrÃ¡ ser revocada en cualquier momento mediante notificaciÃ³n por escrito.
      </p>
    </div>

    <div class="footer">${esc(legalHeader)}</div>
  </div>

</body>
</html>
`.trim();
}
