import type { PublicLanguage } from "@/lib/public-links/i18n";

type Replacement = [string, string];

function applyReplacements(html: string, replacements: Replacement[]) {
  return replacements.reduce((current, [from, to]) => current.split(from).join(to), html);
}

const commonEnglishReplacements: Replacement[] = [
  ['<html lang="es">', '<html lang="en">'],
  ["Plantilla", "Template"],
  ["VersiÃ³n", "Version"],
  ["Reserva", "Booking"],
  ["Contrato #", "Contract #"],
  ["Firma cliente", "Customer signature"],
  ["El cliente autoriza", "The customer authorizes"],
];

const jetskiNoLicenseEnglishReplacements: Replacement[] = [
  ["ALQUILER DE MOTOS ACUÃTICAS SIN LICENCIA", "JET SKI RENTAL WITHOUT LICENSE"],
  ["1. NORMAS DE NAVEGACIÃ“N", "1. NAVIGATION RULES"],
  ["2. CONDICIONES DEL CONTRATO", "2. CONTRACT TERMS"],
  ["3. ACCIDENTES Y REPARACIONES", "3. ACCIDENTS AND REPAIRS"],
  ["FIANZA Y AUTORIZACIÃ“N DE IMAGEN", "DEPOSIT AND IMAGE AUTHORIZATION"],
  ["NOMBRE Y APELLIDOS", "FULL NAME"],
  ["NOMBRE DEL MENOR O DEL ACOMPAÃ‘ANTE", "NAME OF MINOR OR COMPANION"],
  ["DIRECCIÃ“N", "ADDRESS"],
  ["TELÃ‰FONO", "PHONE"],
  ["EMAIL", "EMAIL"],
  ["CÃ“DIGO POSTAL / PAÃS", "POSTAL CODE / COUNTRY"],
  ["FECHA DE NACIMIENTO", "DATE OF BIRTH"],
  ["FECHA", "DATE"],
  ["RECURSO ASIGNADO", "ASSIGNED RESOURCE"],
  ["Se asigna en plataforma", "Assigned on site"],
  ["TIEMPO DE USO", "USAGE TIME"],
  ["Declara haber comprendido las normas y acepta las condiciones del contrato.", "The customer declares that they have understood the rules and accept the contract terms."],
  ["COMO GARANTÃA POR EL CORRECTO USO DE LA MOTO DE AGUA Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÃ UNA FIANZA DE 100 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.", "AS A GUARANTEE FOR THE CORRECT USE OF THE JET SKI AND COMPLIANCE WITH THE RENTAL TERMS, A 100 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS."],
  ["â€¢ ESTA FIANZA SERÃ REEMBOLSADA ÃNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:", "• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:"],
  ["LA MOTO DE AGUA SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÃ“.", "THE JET SKI IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED."],
  ["NO SE HAYA PRODUCIDO NINGÃšN DAÃ‘O O MAL USO DEL EQUIPO.", "NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED."],
  ["SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.", "THE SAFETY AND BEHAVIOUR RULES GIVEN by staff HAVE BEEN FOLLOWED."],
  ["EL PAGO DE LA FIANZA PODRÃ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÃšN DISPONIBILIDAD.", "THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY."],
];

const licensedEnglishReplacements: Replacement[] = [
  ["CONTRATO DE MOTO DE AGUA CON LICENCIA", "LICENSED JET SKI RENTAL CONTRACT"],
  ["CONTRATO DE EMBARCACIÃ“N CON LICENCIA", "LICENSED BOAT RENTAL CONTRACT"],
  ["Nombre", "Name"],
  ["Tipo documento", "Document type"],
  ["NÃºmero documento", "Document number"],
  ["Fecha nacimiento", "Date of birth"],
  ["TelÃ©fono", "Phone"],
  ["DirecciÃ³n", "Address"],
  ["C.P.", "Post code"],
  ["Licencia", "License"],
  ["NÃºmero licencia", "License number"],
  ["Escuela / emisor", "School / issuer"],
  ["En adelante Arrendatario. El Arrendador arrienda al Arrendatario, la embarcaciÃ³n:", "Hereinafter the Hirer. The Lessor rents the following craft to the Hirer:"],
  ["Puerto de embarque y desembarque:", "Boarding and disembarkation port:"],
  ["El periodo de arrendamiento comprende:", "The rental period is:"],
  ["Desde", "From"],
  ["Hasta", "Until"],
  ["DÃ­a:", "Day:"],
  ["Hora:", "Time:"],
  ["El precio del arrendamiento se fija en la cantidad de", "The rental price is set at"],
  ["IVA incluido y una Fianza de", "VAT included and a deposit of"],
  ["IVA incluido", "VAT included"],
  ["CLÃUSULAS:", "CLAUSES:"],
  ["EL ARRENDADOR", "LESSOR"],
  ["EL ARRENDATARIO", "HIRER"],
  ["En prueba de conformidad", "In witness whereof"],
  ["BADALONA a :", "BADALONA on:"],
  ["COMO GARANTÃA POR EL CORRECTO USO DE LA", "AS A GUARANTEE FOR THE CORRECT USE OF THE"],
  ["Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÃ UNA FIANZA DE 500 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.", "AND COMPLIANCE WITH THE RENTAL TERMS, A 500 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS."],
  ["ESTA FIANZA SERÃ REEMBOLSADA ÃNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:", "THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:"],
];

export function translateContractHtml(args: {
  html: string;
  language: PublicLanguage;
  templateCode: string;
}) {
  if (args.language === "es") return args.html;

  const replacements = [...commonEnglishReplacements];
  if (args.templateCode === "JETSKI_NO_LICENSE") {
    replacements.push(...jetskiNoLicenseEnglishReplacements);
  } else {
    replacements.push(...licensedEnglishReplacements);
  }

  return applyReplacements(args.html, replacements);
}
