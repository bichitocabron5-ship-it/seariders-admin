import type { PublicLanguage } from "@/lib/public-links/i18n";

type Replacement = readonly [string, string];

function applyReplacements(html: string, replacements: readonly Replacement[]) {
  return replacements.reduce((current, [from, to]) => current.split(from).join(to), html);
}

const mojibakeFixes: readonly Replacement[] = [
  ["Â·", "·"],
  ["â€”", "-"],
  ["â€“", "-"],
  ["â€¢", "•"],
  ["â‚¬", "€"],
  ["Ã€", "À"],
  ["Ã", "Á"],
  ["Ã‰", "É"],
  ["Ã", "Í"],
  ["Ã“", "Ó"],
  ["Ãš", "Ú"],
  ["Ã‘", "Ñ"],
  ["Ã¡", "á"],
  ["Ã©", "é"],
  ["Ã­", "í"],
  ["Ã³", "ó"],
  ["Ãº", "ú"],
  ["Ã±", "ñ"],
  ["Ã¼", "ü"],
  ["ÃƒÂ", "Á"],
  ["Ãƒâ€°", "É"],
  ["ÃƒÂ", "Í"],
  ["Ãƒâ€œ", "Ó"],
  ["ÃƒÅ¡", "Ú"],
  ["Ãƒâ€˜", "Ñ"],
  ["ÃƒÂ¡", "á"],
  ["ÃƒÂ©", "é"],
  ["ÃƒÂ­", "í"],
  ["ÃƒÂ³", "ó"],
  ["ÃƒÂº", "ú"],
  ["ÃƒÂ±", "ñ"],
  ["ÃƒÂ¼", "ü"],
  ["Ã¢â‚¬Â¢", "•"],
];

function normalizeLegacyContractHtml(html: string) {
  return applyReplacements(html, mojibakeFixes);
}

const commonEnglishReplacements: readonly Replacement[] = [
  ['<html lang="es">', '<html lang="en">'],
  ["Plantilla", "Template"],
  ["Versión", "Version"],
  ["Reserva", "Booking"],
  ["Contrato #", "Contract #"],
  ["Firma cliente", "Customer signature"],
  ["El cliente autoriza", "The customer authorizes"],
];

const noLicenseEnglishReplacements: readonly Replacement[] = [
  ["ALQUILER DE MOTOS ACUÁTICAS SIN LICENCIA", "JET SKI RENTAL WITHOUT LICENSE"],
  ["1. NORMAS DE NAVEGACIÓN", "1. NAVIGATION RULES"],
  ["2. CONDICIONES DEL CONTRATO", "2. CONTRACT TERMS"],
  ["3. ACCIDENTES Y REPARACIONES", "3. ACCIDENTS AND REPAIRS"],
  ["FIANZA Y AUTORIZACIÓN DE IMAGEN", "DEPOSIT AND IMAGE AUTHORIZATION"],
  ["NOMBRE Y APELLIDOS", "FULL NAME"],
  ["NOMBRE DEL MENOR O DEL ACOMPAÑANTE", "NAME OF MINOR OR COMPANION"],
  ["DIRECCIÓN", "ADDRESS"],
  ["TELÉFONO", "PHONE"],
  ["CÓDIGO POSTAL / PAÍS", "POSTAL CODE / COUNTRY"],
  ["FECHA DE NACIMIENTO", "DATE OF BIRTH"],
  ["FECHA", "DATE"],
  ["RECURSO ASIGNADO", "ASSIGNED RESOURCE"],
  ["Se asigna en plataforma", "Assigned on site"],
  ["TIEMPO DE USO", "USAGE TIME"],
  ["Declara haber comprendido las normas y acepta las condiciones del contrato.", "The customer declares that they have understood the rules and accept the contract terms."],
  ["COMO GARANTÍA POR EL CORRECTO USO DE LA MOTO DE AGUA Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÁ UNA FIANZA DE 100 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.", "AS A GUARANTEE FOR THE CORRECT USE OF THE JET SKI AND COMPLIANCE WITH THE RENTAL TERMS, A 100 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS."],
  ["• ESTA FIANZA SERÁ REEMBOLSADA ÍNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:", "• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:"],
  ["LA MOTO DE AGUA SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÓ.", "THE JET SKI IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED."],
  ["NO SE HAYA PRODUCIDO NINGÚN DAÑO O MAL USO DEL EQUIPO.", "NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED."],
  ["SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.", "THE SAFETY AND BEHAVIOUR RULES GIVEN BY STAFF HAVE BEEN FOLLOWED."],
  ["EL PAGO DE LA FIANZA PODRÁ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÚN DISPONIBILIDAD.", "THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY."],
];

const licensedEnglishReplacements: readonly Replacement[] = [
  ["CONTRATO DE MOTO DE AGUA CON LICENCIA", "LICENSED JET SKI RENTAL CONTRACT"],
  ["CONTRATO DE EMBARCACIÓN CON LICENCIA", "LICENSED BOAT RENTAL CONTRACT"],
  ["De una parte, la entidad UTE JETSKI CENTER- NOMAD NAUTIC · domiciliada en", "On the one hand, UTE JETSKI CENTER- NOMAD NAUTIC, registered at"],
  ["provista de CIF B- U16457343 (en adelante Arrendador), y de otra parte,", "with tax ID B- U16457343 (hereinafter the Lessor), and on the other hand,"],
  ["Nombre", "Name"],
  ["Tipo documento", "Document type"],
  ["Número documento", "Document number"],
  ["Fecha nacimiento", "Date of birth"],
  ["Teléfono", "Phone"],
  ["Dirección", "Address"],
  ["C.P.", "Post code"],
  ["Licencia", "License"],
  ["Número licencia", "License number"],
  ["Escuela / emisor", "School / issuer"],
  ["En adelante Arrendatario. El Arrendador arrienda al Arrendatario, la embarcación:", "Hereinafter the Hirer. The Lessor rents the following craft to the Hirer:"],
  ["Matrícula", "Registration"],
  ["Despacho Personas", "Authorised persons"],
  ["Puerto de embarque y desembarque:", "Boarding and disembarkation port:"],
  ["El periodo de arrendamiento comprende:", "The rental period is:"],
  ["Desde", "From"],
  ["Hasta", "Until"],
  ["Día:", "Day:"],
  ["Hora:", "Time:"],
  ["El precio del arrendamiento se fija en la cantidad de", "The rental price is set at"],
  ["IVA incluido y una Fianza de", "VAT included and a deposit of"],
  ["IVA incluido", "VAT included"],
  ["CLÁUSULAS:", "CLAUSES:"],
  ["1. ENTREGA DE LA EMBARCACIÓN.", "1. DELIVERY OF THE CRAFT."],
  ["2. ZONA DE NAVEGACIÓN.", "2. NAVIGATION AREA."],
  ["3. USO DE LA EMBARCACIÓN.", "3. USE OF THE CRAFT."],
  ["4. SEGUROS.", "4. INSURANCE."],
  ["5. DEVOLUCIÓN DE LA EMBARCACIÓN.", "5. RETURN OF THE CRAFT."],
  ["6. RETRASOS EN LA DEVOLUCIÓN.", "6. LATE RETURN."],
  ["7. DAÑOS, ACCIDENTES Y AVERÍAS.", "7. DAMAGE, ACCIDENTS AND BREAKDOWNS."],
  ["8. ANULACIONES Y RESOLUCIONES", "8. CANCELLATIONS AND TERMINATION"],
  ["10. RESPONSABILIDAD FRENTE A TERCEROS", "10. LIABILITY TOWARDS THIRD PARTIES"],
  ["11. EXPERIENCIA DEL PATRÓN.", "11. SKIPPER EXPERIENCE."],
  ["12. EFICACIA", "12. VALIDITY"],
  ["13. PROTECCIÓN DE DATOS", "13. DATA PROTECTION"],
  ["14. DERECHO Y JURISDICCIÓN", "14. GOVERNING LAW AND JURISDICTION"],
  ["a. En el momento de la entrega, el arrendatario revisará el estado general del casco y el nivel de combustible, comprometiéndose a entregar la ", "a. At the time of delivery, the hirer will check the general condition of the hull and the fuel level, undertaking to return the "],
  [" en el mismo estado en el que le fue entregada por el arrendador.", " in the same condition in which it was delivered by the lessor."],
  ["La zona de navegación permitida se establece dentro del litoral catalán, valenciano e Islas Baleares. El arrendatario solicitará un permiso escrito de UTE JETSKI CENTER - NOMAD NAUTIC para navegar por zonas diferentes a las aquí referidas o fuera de las Aguas Territoriales Españolas.", "The permitted navigation area is limited to the Catalan and Valencian coasts and the Balearic Islands. The hirer must request written permission from UTE JETSKI CENTER - NOMAD NAUTIC to navigate in areas other than those stated here or outside Spanish territorial waters."],
  ["En el caso de alquilar una ", "If renting a "],
  [" esta no podrá navegar a menos de 200m de la zona reservada para los bañistas delimitada con boyas amarillas, ni por dentro de los canales balizados reservados para las entradas y salidas de ", " it may not navigate within 200m of the area reserved for bathers marked with yellow buoys, nor inside the buoyed channels reserved for the entry and exit of "],
  [". Está PROHIBIDO estar a menos de 200m de la costa, playas o calas salvo permiso previo UTE JETSKI CENTER- NOMAD NAUTIC cuando la zona de bañistas no esté delimitada.", ". It is FORBIDDEN to be within 200m of the coastline, beaches or coves unless prior permission has been granted by UTE JETSKI CENTER- NOMAD NAUTIC when the bathing area is not delimited."],
  ["a. El arrendatario se obliga a utilizar la embarcación alquilada correctamente y respetar las normas establecidas por las autoridades marítimas, aduaneras, sanitarias y de hacienda, así como a las policías nacionales o extranjeras en su caso. En caso de infracción a las ordenanzas por parte del arrendatario, este se hará cargo de todas las sanciones, multas, etc.", "a. The hirer undertakes to use the rented craft correctly and to comply with the rules established by the maritime, customs, health and tax authorities, as well as with national or foreign police authorities where applicable. In the event of any breach of regulations by the hirer, the hirer will bear all penalties, fines and related costs."],
  ["b. El arrendatario se obliga a no transportar a bordo un número mayor de personas que el permitido según el certificado de seguridad de la embarcación; a utilizar la embarcación solo para cruceros de recreo. Así mismo se obliga a no ceder, subcontratar o subarrendar total o parcialmente la embarcación.", "b. The hirer undertakes not to carry more persons on board than permitted by the craft's safety certificate and to use the craft only for leisure cruising. The hirer also undertakes not to assign, subcontract or sublet the craft in whole or in part."],
  ["c. Queda totalmente prohibido el remolque de otras embarcaciones salvo en los casos de urgencia, así mismo solo se dejará remolcar la embarcación alquilada en los mismos casos y siempre con cabos propios para evitar los altos costes de salvamento. El arrendatario no aceptará acuerdos ni asumirá responsabilidades sin autorización de UTE JETSKI CENTER- NOMAD NAUTIC.", "c. Towing other craft is strictly prohibited except in cases of emergency. Likewise, the rented craft may only be towed in the same circumstances and always using its own lines in order to avoid high salvage costs. The hirer shall not accept agreements or assume liabilities without authorisation from UTE JETSKI CENTER- NOMAD NAUTIC."],
  ["d. En el supuesto de obtener un premio por salvamento, este se repartirá al 50% para UTE JETSKI CENTER- NOMAD NAUTIC y 50% para el arrendatario.", "d. If any salvage reward is obtained, it will be divided 50% for UTE JETSKI CENTER- NOMAD NAUTIC and 50% for the hirer."],
  ["e. En el caso de informes meteorológicos peligrosos sobre el tiempo o la mar (superior a fuerza 6 Beaufort o 27 nudos de viento) el arrendatario se obliga a no salir del puerto en el que se encuentre o bien a ir al puerto o fondeadero seguro más próximo de su posición.", "e. In the event of dangerous weather or sea forecasts (above Beaufort force 6 or 27 knots of wind), the hirer undertakes not to leave the port where the craft is located or otherwise to proceed to the nearest safe port or anchorage."],
  ["f. El arrendatario es responsable de cualquier daño o perjuicio que se produzca en la embarcación arrendada, de la pérdida de sus elementos y de los retrasos en la devolución de la embarcación.", "f. The hirer is responsible for any damage or loss affecting the rented craft, for the loss of its equipment and for any delay in returning the craft."],
  ["a. En el precio del arrendamiento, está incluido el seguro de la embarcación.", "a. The craft insurance is included in the rental price."],
  ["b. UTE JETSKI CENTER- NOMAD NAUTIC no será responsable en ningún caso de los daños a personas, las pérdidas o daños que pudieran sufrir los efectos personales del arrendatario, tripulantes o invitados a bordo de la embarcación.", "b. UTE JETSKI CENTER- NOMAD NAUTIC shall not in any case be liable for personal injuries or for any loss of or damage to the personal belongings of the hirer, crew or guests on board the craft."],
  ["a. El arrendatario declara conocer el estado de conservación de la embarcación, por tanto, acepta expresamente entregar la embarcación en las mismas condiciones en que la recibió, con los depósitos de combustible. De no entregarse en estas condiciones, se deducirá de la fianza el coste de llenado de dichos depósitos. El coste del combustible se fija en 25€ por cada línea que marca el aforador.", "a. The hirer declares that they know the condition of the craft and therefore expressly agrees to return it in the same condition in which it was received, with the fuel tanks filled. If it is not returned in these conditions, the cost of refilling the tanks will be deducted from the deposit. The fuel cost is set at €25 for each line indicated on the gauge."],
  ["b. Al devolver la embarcación, se llevará a cabo una revisión de la misma, por parte de UTE JETSKI CENTER- NOMAD NAUTIC, tras lo cual la fianza será restituida al arrendatario. Si se encuentran daños en la embarcación o pérdida o rotura de su equipamiento, UTE JETSKI CENTER- NOMAD NAUTIC reducirá de la fianza el importe necesario para arreglar dichos daños. UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho a exigir un importe que supere el de la fianza, si los gastos por las reparaciones superan el importe de la fianza depositada.", "b. Upon return of the craft, UTE JETSKI CENTER- NOMAD NAUTIC will inspect it, after which the deposit will be returned to the hirer. If any damage to the craft or any loss or breakage of equipment is found, UTE JETSKI CENTER- NOMAD NAUTIC will deduct from the deposit the amount necessary to repair such damage. UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to claim an amount exceeding the deposit if repair costs are higher than the deposit paid."],
  ["c. La embarcación deberá devolverse en el mismo puerto en el que se realizó la entrega. El arrendatario soportará todos los gastos derivados de este cambio en el lugar de devolución. Dichos gastos serán de 10 euros por milla recorrida más el desplazamiento de la tripulación reduciéndose este importe de la fianza depositada.", "c. The craft must be returned to the same port where delivery took place. The hirer will bear all expenses arising from any change to the return location. These costs will be 10 euros per mile travelled plus the crew transfer costs, and this amount will be deducted from the deposit paid."],
  ["d. El arrendatario se compromete a informar a UTE JETSKI CENTER- NOMAD NAUTIC de cualquier anomalía o incidencia o problemas que hayan surgido durante la navegación.", "d. The hirer undertakes to inform UTE JETSKI CENTER- NOMAD NAUTIC of any anomaly, incident or problem that may have arisen during navigation."],
  ["En el caso de que se produzca un retraso en la devolución de la embarcación el arrendatario estará obligado:", "If there is any delay in returning the craft, the hirer shall be obliged as follows:"],
  ["a. El arrendatario pagará a UTE JETSKI CENTER- NOMAD NAUTIC la parte proporcional del tiempo extra utilizado pudiendo UTE JETSKI CENTER- NOMAD NAUTIC restarlo del importe de la fianza. Si transcurridas 24 horas del término del contrato, no se ha devuelto la embarcación ni se tienen noticias de la misma, se iniciará la búsqueda comunicándose su desaparición a las autoridades de marina. Los gastos que de ello se deriven correrán a cargo del arrendatario.", "a. The hirer shall pay UTE JETSKI CENTER- NOMAD NAUTIC the proportional amount for the extra time used, and UTE JETSKI CENTER- NOMAD NAUTIC may deduct it from the deposit. If, after 24 hours from the end of the contract, the craft has not been returned and there is no news of it, a search will be initiated and its disappearance will be reported to the maritime authorities. Any resulting costs will be borne by the hirer."],
  ["También será considerado como retraso en la devolución, el tiempo empleado para la reparación de los daños que presente la embarcación.", "The time required to repair any damage to the craft will also be considered a delay in return."],
  ["a) Si durante el periodo de alquiler, se producen en la embarcación arrendada averías, daños, desperfectos o pérdidas de material, el arrendatario está en la obligación de comunicarlo inmediatamente a Barcodealquiler.com el cual le dará las oportunas instrucciones a seguir.", "a) If, during the rental period, the rented craft suffers breakdowns, damage, defects or loss of equipment, the hirer is obliged to inform Barcodealquiler.com immediately, which will provide the appropriate instructions to follow."],
  ["b) Si se producen accidentes con participación de terceros, estos deben ser declarados por el arrendatario ante las autoridades competentes, siendo anotados los datos de las embarcaciones que hayan intervenido en el accidente. El arrendatario, además, redactará un informe sobre lo ocurrido que entregará a UTE JETSKI CENTER- NOMAD NAUTIC.", "b) If accidents involving third parties occur, they must be reported by the hirer to the competent authorities, recording the details of the craft involved in the accident. The hirer must also draw up a report on what happened and deliver it to UTE JETSKI CENTER- NOMAD NAUTIC."],
  ["c) El arrendatario está obligado a comunicar a UTE JETSKI CENTER- NOMAD NAUTIC cualquier contacto de la embarcación con el fondo marino con el objeto de poder determinar las consecuencias de dichos contactos y evitar poner en peligro a posteriores tripulaciones.", "c) The hirer is obliged to inform UTE JETSKI CENTER- NOMAD NAUTIC of any contact between the craft and the seabed so that the consequences of such contacts can be assessed and later crews are not put at risk."],
  ["En el supuesto de negligencia en el uso de la embarcación infringiendo la legislación vigente, será motivo para la resolución automática del contrato, quedando las cantidades pagadas a favor de UTE JETSKI CENTER- NOMAD NAUTIC.", "Any negligence in the use of the craft in breach of current legislation shall be grounds for automatic termination of the contract, and any amounts paid shall remain with UTE JETSKI CENTER- NOMAD NAUTIC."],
  ["El cliente declara no haber tomado alcohol ni haber consumido ninguna clase de estupefacientes así como sustancias psicoactivas y que no padece ninguna enfermedad o impedimento físico para el correcto manejo de la embarcación.", "The customer declares that they have not consumed alcohol, narcotics or psychoactive substances and that they do not suffer from any illness or physical impairment preventing the safe handling of the craft."],
  ["En el supuesto de reclamaciones por parte de terceros contra el arrendatario, por el uso de la embarcación alquilada, UTE JETSKI CENTER- NOMAD NAUTIC queda exonerada de cualquier tipo de responsabilidad. De las faltas que pueda cometer el patrón de la embarcación, responde también conjuntamente el arrendatario.", "If any claims are brought by third parties against the hirer due to the use of the rented craft, UTE JETSKI CENTER- NOMAD NAUTIC shall be exempt from any liability. The hirer shall also be jointly liable for any offences committed by the craft's skipper."],
  ["El arrendatario asegura que posee los conocimientos y la experiencia necesarios para la realización del crucero y que posee el siguiente título náutico:", "The hirer states that they have the knowledge and experience necessary for the voyage and that they hold the following nautical licence:"],
  [" expedido por ", " issued by "],
  [" que designa al Sr./Sra", " designating Mr./Ms. "],
  [" que es poseedor del título náutico mencionado anteriormente con identificación:", " holder of the nautical licence mentioned above, identified as:"],
  [" como patrón de la embarcación. En ningún caso podrá cederse el gobierno de la embarcación a persona distinta a la que consta como patrón.", " as skipper of the craft. Under no circumstances may command of the craft be handed over to a person other than the one recorded as skipper."],
  ["UTE JETSKI CENTER- NOMAD NAUTIC se reserva el derecho de cancelar el presente contrato si el patrón no dispusiera de la capacitación y competencia suficientes para el gobierno con seguridad de la embarcación. En este supuesto, el arrendador no tendrá derecho a devolución alguna del alquiler, no obstante, UTE JETSKI CENTER- NOMAD NAUTIC pondrá a disposición del arrendatario otro patrón (si lo hubiere). Los emolumentos que pudiera cobrar este, serán asumidos por el arrendatario.", "UTE JETSKI CENTER- NOMAD NAUTIC reserves the right to cancel this contract if the skipper does not have sufficient training and competence to operate the craft safely. In that case, the lessor shall not be entitled to any refund of the rental, although UTE JETSKI CENTER- NOMAD NAUTIC may provide another skipper to the hirer, if available. Any fees charged by that skipper shall be borne by the hirer."],
  ["En el supuesto de que alguna de las cláusulas del contrato pierda su validez, esto no afectará de ningún modo a las demás que seguirán siendo, a todos los efectos, eficaces entre las partes.", "If any clause of the contract loses its validity, this shall in no way affect the others, which shall remain fully effective between the parties."],
  ["En cumplimiento con lo establecido en la Ley Orgánica 15/1999, de 13 de diciembre, de Protección de Datos de Carácter Personal, con la aceptación del presente contrato, le informamos que sus datos personales serán tratados y quedarán incorporados en ficheros responsabilidad de UTE JETSKI CENTER- NOMAD NAUTIC registrados en la Agencia Española de Protección de Datos, con la finalidad de la gestión de los clientes y contratos.", "In compliance with Organic Law 15/1999, of 13 December, on the Protection of Personal Data, by accepting this contract you are informed that your personal data will be processed and incorporated into files for which UTE JETSKI CENTER- NOMAD NAUTIC is responsible, registered with the Spanish Data Protection Agency, for the purpose of customer and contract management."],
  ["Se le solicitan resultan necesarios, de manera que de no facilitarse no será posible la prestación del servicio requerido, en este sentido, usted consiente expresamente la recogida y el tratamiento de los mismos para la citada finalidad. De igual forma, autoriza la comunicación de sus datos de carácter personal a otras entidades que sea necesario para realizar el servicio solicitado.", "The requested data are necessary, and if they are not provided it will not be possible to deliver the requested service. In this regard, you expressly consent to their collection and processing for the stated purpose. Likewise, you authorise the communication of your personal data to other entities when necessary to provide the requested service."],
  ["También autoriza la utilización de sus datos para realizar comunicaciones periódicas, incluyendo las que se realizan vía correo electrónico, que nuestra empresa llevará a cabo para informar de las actividades que desarrolla por sí o a través de sus empresas colaboradoras. En todo caso, puede ejercitar los derechos de acceso, rectificación, cancelación y oposición dirigiéndose a la siguiente dirección de correo electrónico:", "You also authorise the use of your data for periodic communications, including those sent by email, which our company may carry out to inform you of activities it performs directly or through partner companies. In all cases, you may exercise your rights of access, rectification, cancellation and objection by contacting the following email address:"],
  ["El presente contrato, está sometido a la legislación española. Todas las cuestiones litigiosas o diferencias que puedan surgir en la ejecución, modificación, resolución y efectos del presente contrato se resolverán en los tribunales de la ciudad de BARCELONA, a cuya jurisdicción se someten expresamente las partes.", "This contract is governed by Spanish law. Any disputes or differences that may arise in connection with the performance, amendment, termination or effects of this contract shall be resolved by the courts of the city of BARCELONA, to whose jurisdiction the parties expressly submit."],
  ["En prueba de conformidad", "In witness whereof"],
  ["las partes firman por duplicado el presente contrato de arrendamiento de embarcación en el lugar y fecha que figuran a continuación:", "the parties sign this craft rental contract in duplicate at the place and date set out below:"],
  ["BADALONA a :", "BADALONA on:"],
  ["EL ARRENDADOR", "LESSOR"],
  ["EL ARRENDATARIO", "HIRER"],
  ["COMO GARANTÍA POR EL CORRECTO USO DE LA ", "AS A GUARANTEE FOR THE CORRECT USE OF THE "],
  [" Y EL CUMPLIMIENTO DE LAS CONDICIONES DEL ALQUILER, SE COBRARÁ UNA FIANZA DE 500 EUROS AL MOMENTO DE LA FIRMA DEL CONTRATO O ANTES DEL INICIO DE LA ACTIVIDAD.", " AND COMPLIANCE WITH THE RENTAL TERMS, A 500 EURO DEPOSIT WILL BE CHARGED WHEN THE CONTRACT IS SIGNED OR BEFORE THE ACTIVITY STARTS."],
  ["• ESTA FIANZA SERÁ REEMBOLSADA ÍNTEGRAMENTE AL FINALIZAR EL SERVICIO, SIEMPRE QUE:", "• THIS DEPOSIT WILL BE FULLY REFUNDED AT THE END OF THE SERVICE, PROVIDED THAT:"],
  ["o LA ", "o THE "],
  [" SE DEVUELVA EN EL MISMO ESTADO EN EL QUE SE ENTREGÓ.", " IS RETURNED IN THE SAME CONDITION IN WHICH IT WAS DELIVERED."],
  ["o NO SE HAYA PRODUCIDO NINGÚN DAÑO O MAL USO DEL EQUIPO.", "o NO DAMAGE OR MISUSE OF THE EQUIPMENT HAS OCCURRED."],
  ["o SE HAYAN CUMPLIDO LAS NORMAS DE SEGURIDAD Y COMPORTAMIENTO INDICADAS POR EL PERSONAL.", "o THE SAFETY AND BEHAVIOUR RULES GIVEN BY STAFF HAVE BEEN FOLLOWED."],
  ["EL PAGO DE LA FIANZA PODRÁ REALIZARSE EN EFECTIVO O MEDIANTE TARJETA BANCARIA, SEGÚN DISPONIBILIDAD.", "THE DEPOSIT MAY BE PAID IN CASH OR BY BANK CARD, SUBJECT TO AVAILABILITY."],
  ["El cliente autoriza a UTE JERSKI CENTER- NOMAD NAUTIC a utilizar las fotografías y vídeos tomados durante la actividad para su publicación en redes sociales, página web y material publicitario de la empresa. Esta autorización es gratuita y podrá ser revocada en cualquier momento mediante notificación por escrito.", "The customer authorises UTE JERSKI CENTER- NOMAD NAUTIC to use the photographs and videos taken during the activity for publication on social media, the website and the company's advertising material. This authorisation is free of charge and may be revoked at any time by written notice."],
];

const commonTermEnglishReplacements: readonly Replacement[] = [
  ["motos de agua", "jet skis"],
  ["MOTOS DE AGUA", "JET SKIS"],
  ["moto de agua", "jet ski"],
  ["MOTO DE AGUA", "JET SKI"],
  ["embarcaciones", "craft"],
  ["EMBARCACIONES", "CRAFT"],
  ["embarcación", "craft"],
  ["EMBARCACIÓN", "CRAFT"],
  ["patrón", "skipper"],
  ["PATRÓN", "SKIPPER"],
];

export function translateContractHtml(args: {
  html: string;
  language: PublicLanguage;
  templateCode: string;
}) {
  const normalizedHtml = normalizeLegacyContractHtml(args.html);
  if (args.language !== "en") return normalizedHtml;

  const replacements =
    args.templateCode === "JETSKI_NO_LICENSE"
      ? [...commonEnglishReplacements, ...noLicenseEnglishReplacements]
      : [...commonEnglishReplacements, ...licensedEnglishReplacements, ...commonTermEnglishReplacements];

  return applyReplacements(normalizedHtml, replacements);
}
