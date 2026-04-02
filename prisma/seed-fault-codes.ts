import "dotenv/config";
import { FaultCodeVerificationStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const rows = [
  {
    brand: "SEA_DOO",
    code: "P0562",
    system: "ELECTRICO",
    titleEs: "Voltaje bajo del sistema",
    descriptionEs: "La tensión de batería o de carga está por debajo de lo esperado.",
    likelyCausesEs:
      "Batería descargada o dañada, regulador/rectificador defectuoso, estator con fallo, bornes sulfatados, masa deficiente o cableado dañado.",
    recommendedActionEs:
      "Comprobar tensión en reposo y en carga, revisar regulador/rectificador, estator, masas y estado real de batería.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    notesInternal:
      "Muy repetido en flota. Suele ir ligado a regulador, batería o estator.",
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P0563",
    system: "ELECTRICO",
    titleEs: "Voltaje alto del sistema",
    descriptionEs: "La tensión del sistema supera el rango esperado.",
    likelyCausesEs:
      "Regulador/rectificador defectuoso, problema en batería, conexión incorrecta al arrancar con pinzas o cableado defectuoso.",
    recommendedActionEs:
      "Medir tensión de carga, revisar regulador/rectificador, batería y bornes.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    notesInternal:
      "Muy repetido en flota. Revisar primero regulador, batería y estator.",
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P0261",
    system: "INYECCION",
    titleEs: "Inyector cilindro 1, circuito abierto o a masa",
    descriptionEs: "Fallo eléctrico en el inyector del cilindro 1.",
    likelyCausesEs:
      "Inyector dañado, cableado cortado o derivado, conector defectuoso, salida ECU dañada o fusible asociado.",
    recommendedActionEs:
      "Revisar continuidad, alimentación, resistencia del inyector y conectores.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    notesInternal:
      "En taller muchas veces también hay relación con alimentación eléctrica inestable.",
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P0264",
    system: "INYECCION",
    titleEs: "Inyector cilindro 2, circuito abierto o a masa",
    descriptionEs: "Fallo eléctrico en el inyector del cilindro 2.",
    likelyCausesEs:
      "Inyector dañado, cableado cortado o derivado, conector defectuoso, salida ECU dañada o fusible asociado.",
    recommendedActionEs:
      "Revisar continuidad, alimentación, resistencia del inyector y conectores.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P0267",
    system: "INYECCION",
    titleEs: "Inyector cilindro 3, circuito abierto o a masa",
    descriptionEs: "Fallo eléctrico en el inyector del cilindro 3.",
    likelyCausesEs:
      "Inyector dañado, cableado cortado o derivado, conector defectuoso, salida ECU dañada o fusible asociado.",
    recommendedActionEs:
      "Revisar continuidad, alimentación, resistencia del inyector y conectores.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P0461",
    system: "COMBUSTIBLE",
    titleEs: "Sensor de nivel de combustible, rango/rendimiento",
    descriptionEs: "La lectura del nivel de combustible es incoherente o está fuera de rango.",
    likelyCausesEs:
      "Aforador defectuoso, cableado, conector, suciedad en bomba/aforador o problema de cuadro.",
    recommendedActionEs:
      "Comprobar aforador, lectura del sensor, conectores y estado del conjunto de bomba.",
    severityHint: "BAJA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    notesInternal: "Pendiente de contrastar en catálogo oficial concreto.",
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P2306",
    system: "ENCENDIDO",
    titleEs: "Circuito bobina de encendido cilindro 1, señal baja",
    descriptionEs: "Problema eléctrico en la bobina de encendido del cilindro 1.",
    likelyCausesEs:
      "Bobina dañada, cableado, conector, alimentación defectuosa o salida ECU.",
    recommendedActionEs:
      "Revisar bobina, alimentación, masa, continuidad y posible humedad.",
    severityHint: "ALTA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "P16C9",
    system: "ECU",
    titleEs: "Error interno ECU / control del motor",
    descriptionEs: "Fallo interno o inconsistencia lógica en la unidad de control del motor.",
    likelyCausesEs:
      "ECU dañada, firmware corrupto, tensión inestable o masa deficiente.",
    recommendedActionEs:
      "Verificar alimentación y masas antes de sospechar ECU.",
    severityHint: "ALTA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "C2101",
    system: "IBR",
    titleEs: "Aviso de movimiento iBR",
    descriptionEs:
      "La compuerta de reversa/freno no alcanza la posición esperada dentro del tiempo previsto.",
    likelyCausesEs:
      "Atasco por suciedad o restos, boquilla o compuerta dañada, problema mecánico en iBR.",
    recommendedActionEs:
      "Inspeccionar compuerta y tobera, limpiar residuos y revisar movimiento libre.",
    severityHint: "MEDIA",
    source: "Sea-Doo PDF",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "B2A30",
    system: "BODY",
    titleEs: "Error de módulo electrónico",
    descriptionEs: "Fallo en electrónica auxiliar o módulo de carrocería/instrumentación.",
    likelyCausesEs:
      "Módulo defectuoso, alimentación inestable, conectores o humedad.",
    recommendedActionEs:
      "Revisar alimentación, masa, conectores y presencia de sulfatación/humedad.",
    severityHint: "MEDIA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "B2E01",
    system: "BODY",
    titleEs: "Error del sistema eléctrico secundario",
    descriptionEs: "Anomalía en circuito eléctrico auxiliar o secundario.",
    likelyCausesEs:
      "Alimentación inestable, conectores, relés, cableado o módulo auxiliar.",
    recommendedActionEs:
      "Revisar fusibles, relés, alimentación secundaria y masas.",
    severityHint: "MEDIA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "U0129",
    system: "CAN",
    titleEs: "Comunicación perdida con módulo",
    descriptionEs: "El ECM pierde comunicación por CAN con otro módulo del sistema.",
    likelyCausesEs:
      "Fallo en bus CAN, módulo defectuoso, conectores sueltos o bajo voltaje del sistema.",
    recommendedActionEs:
      "Revisar cableado CAN, conectores y tensión de batería antes de sustituir módulos.",
    severityHint: "ALTA",
    source: "Sea-Doo PDF + observación taller",
    verificationStatus: FaultCodeVerificationStatus.VERIFIED_OFFICIAL,
    notesInternal:
      "Los errores U** muchas veces están favorecidos por bajo voltaje.",
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "U01A4",
    system: "CAN",
    titleEs: "Error de comunicación CAN",
    descriptionEs: "Pérdida o degradación de comunicación entre módulos.",
    likelyCausesEs:
      "Bajo voltaje, conectores, cableado CAN, humedad o módulo defectuoso.",
    recommendedActionEs:
      "Revisar primero batería, regulador, masas y red CAN completa.",
    severityHint: "ALTA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "U16A4",
    system: "CAN",
    titleEs: "Error de red CAN / módulo",
    descriptionEs: "Fallo de comunicación con módulo en red CAN.",
    likelyCausesEs:
      "Bajo voltaje, cableado CAN, instrumentación o módulo implicado.",
    recommendedActionEs:
      "Revisar tensión, masa y conectores antes de cambiar módulos.",
    severityHint: "ALTA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
  {
    brand: "SEA_DOO",
    code: "U3FFF",
    system: "CAN",
    titleEs: "Error genérico ECU / comunicación",
    descriptionEs: "Error genérico de comunicación o estado anómalo de ECU.",
    likelyCausesEs:
      "Bajo voltaje, reinicios, fallos transitorios de red, ECU o cuadro.",
    recommendedActionEs:
      "Revisar primero alimentación y red CAN completa; comprobar si coincide con P0562/P0563.",
    severityHint: "MEDIA",
    source: "Taller interno",
    verificationStatus: FaultCodeVerificationStatus.INTERNAL_OBSERVED,
    isActive: true,
  },
];

export async function seedFaultCodes(prismaClient: PrismaClient = prisma) {
  for (const row of rows) {
    await prismaClient.faultCodeCatalog.upsert({
      where: {
        brand_code: {
          brand: row.brand,
          code: row.code,
        },
      },
      update: {
        system: row.system,
        titleEs: row.titleEs,
        descriptionEs: row.descriptionEs,
        likelyCausesEs: row.likelyCausesEs,
        recommendedActionEs: row.recommendedActionEs,
        severityHint: row.severityHint,
        source: row.source,
        verificationStatus: row.verificationStatus,
        notesInternal: row.notesInternal ?? null,
        isActive: row.isActive,
      },
      create: row,
    });
  }

  console.log(`Fault codes seeded: ${rows.length}`);
}

if (process.argv[1]?.endsWith("seed-fault-codes.ts")) {
  seedFaultCodes()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
