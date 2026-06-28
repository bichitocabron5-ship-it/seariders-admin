import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildContractHtml,
  type ContractRenderDriver,
  type ContractRenderReservation,
} from "@/lib/contracts/render-contract";
import type { PublicLanguage } from "@/lib/public-links/i18n";

const snapshotDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__snapshots__");
const shouldUpdateSnapshots = process.env.UPDATE_CONTRACT_SNAPSHOTS === "1";
const snapshotTimeZone = "Europe/Madrid";

function withSnapshotTimeZoneOption(options?: Intl.DateTimeFormatOptions) {
  return {
    ...options,
    timeZone: options?.timeZone ?? snapshotTimeZone,
  };
}

function withContractSnapshotTimeZone<T>(callback: () => T): T {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;

  Date.prototype.toLocaleDateString = function (
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return originalToLocaleDateString.call(this, locales, withSnapshotTimeZoneOption(options));
  } as Date["toLocaleDateString"];

  Date.prototype.toLocaleTimeString = function (
    this: Date,
    locales?: Intl.LocalesArgument,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return originalToLocaleTimeString.call(this, locales, withSnapshotTimeZoneOption(options));
  } as Date["toLocaleTimeString"];

  try {
    return callback();
  } finally {
    Date.prototype.toLocaleDateString = originalToLocaleDateString;
    Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
  }
}

const baseReservation: ContractRenderReservation = {
  id: "reservation-snapshot",
  activityDate: "2026-06-16T12:00:00.000Z",
  scheduledTime: "2026-06-16T12:00:00.000Z",
  customerName: "Cliente Snapshot",
  customerEmail: "cliente@example.com",
  customerPhone: "+34600111222",
  customerCountry: "ES",
  serviceName: "Servicio Snapshot",
  serviceCategory: "JETSKI",
  quantity: 1,
  pax: 2,
  durationMinutes: 30,
  totalPriceCents: 12500,
};

const baseContract: ContractRenderDriver = {
  id: "contract-snapshot",
  unitIndex: 1,
  logicalUnitIndex: 1,
  driverName: "Conductor Snapshot",
  driverDocType: "DNI",
  driverDocNumber: "12345678Z",
  driverBirthDate: "1990-05-10T12:00:00.000Z",
  driverAddress: "Calle Snapshot 1",
  driverPostalCode: "08001",
  driverEmail: "driver@example.com",
  driverPhone: "+34666777888",
  driverCountry: "ES",
  licenseSchool: "Escuela Nautica Snapshot",
  licenseType: "PER",
  licenseNumber: "PER-12345",
  minorAuthorizationProvided: false,
  imageConsentAccepted: true,
  minorAuthorizationFileKey: null,
  minorAuthorizationFileName: null,
  signatureImageUrl: null,
  signatureSignedBy: null,
  signedAt: null,
  preparedJetski: {
    id: "jetski-snapshot",
    number: 7,
    model: "Yamaha VX",
    plate: "7A-BA-123",
  },
  preparedAsset: null,
};

type SnapshotCase = {
  name: string;
  templateCode: string;
  language: PublicLanguage;
  reservation: ContractRenderReservation;
  contract: ContractRenderDriver;
};

const snapshotCases: SnapshotCase[] = [
  {
    name: "JETSKI_NO_LICENSE.es",
    templateCode: "JETSKI_NO_LICENSE",
    language: "es",
    reservation: baseReservation,
    contract: {
      ...baseContract,
      licenseSchool: null,
      licenseType: null,
      licenseNumber: null,
    },
  },
  {
    name: "JETSKI_NO_LICENSE.en",
    templateCode: "JETSKI_NO_LICENSE",
    language: "en",
    reservation: baseReservation,
    contract: {
      ...baseContract,
      licenseSchool: null,
      licenseType: null,
      licenseNumber: null,
    },
  },
  {
    name: "JETSKI_NO_LICENSE.fr",
    templateCode: "JETSKI_NO_LICENSE",
    language: "fr",
    reservation: baseReservation,
    contract: {
      ...baseContract,
      licenseSchool: null,
      licenseType: null,
      licenseNumber: null,
    },
  },
  {
    name: "JETSKI_LICENSED.es",
    templateCode: "JETSKI_LICENSED",
    language: "es",
    reservation: baseReservation,
    contract: baseContract,
  },
  {
    name: "JETSKI_LICENSED.fr",
    templateCode: "JETSKI_LICENSED",
    language: "fr",
    reservation: baseReservation,
    contract: baseContract,
  },
  {
    name: "JETSKI_LICENSED.en",
    templateCode: "JETSKI_LICENSED",
    language: "en",
    reservation: baseReservation,
    contract: baseContract,
  },
  {
    name: "BOAT_LICENSED.es",
    templateCode: "BOAT_LICENSED",
    language: "es",
    reservation: {
      ...baseReservation,
      serviceName: "Boat Snapshot",
      serviceCategory: "BOAT",
      pax: 6,
      durationMinutes: 120,
      totalPriceCents: 49000,
    },
    contract: {
      ...baseContract,
      preparedJetski: null,
      preparedAsset: {
        id: "boat-snapshot",
        name: "Seariders One",
        type: "LANCHA",
        plate: "BA-BOAT-42",
      },
    },
  },
  {
    name: "BOAT_LICENSED.en",
    templateCode: "BOAT_LICENSED",
    language: "en",
    reservation: {
      ...baseReservation,
      serviceName: "Boat Snapshot",
      serviceCategory: "BOAT",
      pax: 6,
      durationMinutes: 120,
      totalPriceCents: 49000,
    },
    contract: {
      ...baseContract,
      preparedJetski: null,
      preparedAsset: {
        id: "boat-snapshot",
        name: "Seariders One",
        type: "LANCHA",
        plate: "BA-BOAT-42",
      },
    },
  },
];

function renderSnapshotHtml(snapshotCase: SnapshotCase) {
  return withContractSnapshotTimeZone(() =>
    buildContractHtml({
      templateCode: snapshotCase.templateCode,
      templateVersion: "v1",
      language: snapshotCase.language,
      logoSrc: "/logo-seariders.png",
      reservation: snapshotCase.reservation,
      contract: snapshotCase.contract,
    })
  );
}

function renderContractHtml(args: {
  templateCode: "JETSKI_LICENSED" | "BOAT_LICENSED";
  reservation?: Partial<ContractRenderReservation>;
  contract?: Partial<ContractRenderDriver>;
}) {
  return withContractSnapshotTimeZone(() =>
    buildContractHtml({
      templateCode: args.templateCode,
      templateVersion: "v1",
      language: "en",
      logoSrc: "/logo-seariders.png",
      reservation: {
        ...baseReservation,
        serviceCategory: args.templateCode === "BOAT_LICENSED" ? "BOAT" : "JETSKI",
        ...args.reservation,
      },
      contract: {
        ...baseContract,
        ...args.contract,
      },
    })
  );
}

async function assertHtmlSnapshot(snapshotCase: SnapshotCase) {
  const actual = renderSnapshotHtml(snapshotCase);

  const snapshotPath = path.join(snapshotDir, `render-contract.${snapshotCase.name}.html`);

  if (shouldUpdateSnapshots) {
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(snapshotPath, actual, "utf8");
    return;
  }

  const expected = await readFile(snapshotPath, "utf8");
  const normalizeSnapshotText = (text: string) => text.replace(/\r\n/g, "\n");
  assert.equal(normalizeSnapshotText(actual), normalizeSnapshotText(expected));
}

for (const snapshotCase of snapshotCases) {
  test(`contract html snapshot ${snapshotCase.name}`, async () => {
    await assertHtmlSnapshot(snapshotCase);
  });
}

test("JETSKI_LICENSED.en shows preparedJetski when it exists", () => {
  const actual = renderContractHtml({ templateCode: "JETSKI_LICENSED" });

  assert.equal(actual.includes("<td>JET SKI</td>"), true);
  assert.equal(actual.includes("<td>Yamaha VX 7</td>"), true);
  assert.equal(actual.includes("<td>7A-BA-123</td>"), true);
  assert.equal(actual.includes("PENDING ASSIGNMENT"), false);
});

test("BOAT_LICENSED.en shows preparedAsset when it exists", () => {
  const actual = renderContractHtml({
    templateCode: "BOAT_LICENSED",
    reservation: {
      pax: 6,
      durationMinutes: 120,
    },
    contract: {
      preparedJetski: null,
      preparedAsset: {
        id: "boat-test",
        name: "Seariders One",
        type: "LANCHA",
        plate: "BA-BOAT-42",
      },
    },
  });

  assert.equal(actual.includes("<td>Seariders One LANCHA</td>"), true);
  assert.equal(actual.includes("<td>BA-BOAT-42</td>"), true);
  assert.equal(actual.includes("PENDING ASSIGNMENT"), false);
});

test("JETSKI_LICENSED.en falls back to preparedAsset when preparedJetski is missing", () => {
  const actual = renderContractHtml({
    templateCode: "JETSKI_LICENSED",
    contract: {
      preparedJetski: null,
      preparedAsset: {
        id: "legacy-asset",
        name: "Legacy Boat",
        type: "LANCHA",
        plate: "LEG-42",
      },
    },
  });

  assert.equal(actual.includes("<td>ASSET LANCHA</td>"), true);
  assert.equal(actual.includes("<td>Legacy Boat LANCHA</td>"), true);
  assert.equal(actual.includes("<td>LEG-42</td>"), true);
  assert.equal(actual.includes("<td>JET SKI</td>"), false);
  assert.equal(actual.includes("PENDING ASSIGNMENT"), false);
});

test("BOAT_LICENSED.en falls back to preparedJetski when preparedAsset is missing", () => {
  const actual = renderContractHtml({
    templateCode: "BOAT_LICENSED",
    contract: {
      preparedJetski: {
        id: "legacy-jetski",
        number: 12,
        model: "Legacy Yamaha",
        plate: "JS-12",
      },
      preparedAsset: null,
    },
  });

  assert.equal(actual.includes("<td>Legacy Yamaha 12</td>"), true);
  assert.equal(actual.includes("<td>JS-12</td>"), true);
  assert.equal(actual.includes("PENDING ASSIGNMENT"), false);
});

test("licensed English contracts show pending assignment when no prepared resource exists", () => {
  for (const templateCode of ["JETSKI_LICENSED", "BOAT_LICENSED"] as const) {
    const actual = renderContractHtml({
      templateCode,
      contract: {
        preparedJetski: null,
        preparedAsset: null,
      },
    });

    assert.equal(actual.includes("<td>PENDING ASSIGNMENT</td>"), true);
  }
});

test("contract snapshots outside JETSKI_LICENSED.fr remain locked for phase 6A", async () => {
  const lockedSnapshotNames = [
    "JETSKI_LICENSED.es",
    "JETSKI_LICENSED.en",
    "JETSKI_NO_LICENSE.es",
    "JETSKI_NO_LICENSE.en",
    "JETSKI_NO_LICENSE.fr",
    "BOAT_LICENSED.es",
    "BOAT_LICENSED.en",
  ];

  for (const snapshotName of lockedSnapshotNames) {
    const snapshotCase = snapshotCases.find((candidate) => candidate.name === snapshotName);
    if (!snapshotCase) throw new Error(`Missing ${snapshotName} snapshot case`);

    await assertHtmlSnapshot(snapshotCase);
  }
});

test("BOAT_LICENSED.en does not contain the main Spanish licensed boat contract phrases", () => {
  const snapshotCase = snapshotCases.find((candidate) => candidate.name === "BOAT_LICENSED.en");
  if (!snapshotCase) throw new Error("Missing BOAT_LICENSED.en snapshot case");

  const actual = renderSnapshotHtml(snapshotCase);
  const forbiddenSpanishPhrases = [
    "De una parte",
    "En adelante Arrendatario",
    "El Arrendador arrienda",
    "CLÁUSULAS",
    "CLÃUSULAS",
    "ENTREGA DE LA EMBARCACIÓN",
    "ENTREGA DE LA EMBARCACIÃ“N",
    "ZONA DE NAVEGACIÓN",
    "ZONA DE NAVEGACIÃ“N",
    "DERECHO Y JURISDICCIÓN",
    "DERECHO Y JURISDICCIÃ“N",
  ];

  for (const phrase of forbiddenSpanishPhrases) {
    assert.equal(actual.includes(phrase), false, `Unexpected Spanish phrase in English boat contract: ${phrase}`);
  }
});

test("JETSKI_LICENSED.en does not contain the main Spanish licensed contract phrases", () => {
  const snapshotCase = snapshotCases.find((candidate) => candidate.name === "JETSKI_LICENSED.en");
  if (!snapshotCase) throw new Error("Missing JETSKI_LICENSED.en snapshot case");

  const actual = renderSnapshotHtml(snapshotCase);
  const forbiddenSpanishPhrases = [
    "De una parte",
    "En adelante Arrendatario",
    "El Arrendador arrienda",
    "CLÁUSULAS",
    "ENTREGA DE LA EMBARCACIÓN",
    "ZONA DE NAVEGACIÓN",
    "DERECHO Y JURISDICCIÓN",
  ];

  for (const phrase of forbiddenSpanishPhrases) {
    assert.equal(actual.includes(phrase), false, `Unexpected Spanish phrase in English contract: ${phrase}`);
  }
});

test("JETSKI_LICENSED.fr does not contain the main Spanish licensed contract phrases", () => {
  const snapshotCase = snapshotCases.find((candidate) => candidate.name === "JETSKI_LICENSED.fr");
  if (!snapshotCase) throw new Error("Missing JETSKI_LICENSED.fr snapshot case");

  const actual = renderSnapshotHtml(snapshotCase);
  const forbiddenSpanishPhrases = [
    "De una parte",
    "En adelante Arrendatario",
    "El Arrendador arrienda",
    "CLÁUSULAS",
    "ENTREGA DE LA EMBARCACIÓN",
    "ZONA DE NAVEGACIÓN",
    "DERECHO Y JURISDICCIÓN",
  ];

  for (const phrase of forbiddenSpanishPhrases) {
    assert.equal(actual.includes(phrase), false, `Unexpected Spanish phrase in French licensed contract: ${phrase}`);
  }
});

test("JETSKI_NO_LICENSE.en does not contain the main Spanish legal clauses", () => {
  const snapshotCase = snapshotCases.find((candidate) => candidate.name === "JETSKI_NO_LICENSE.en");
  if (!snapshotCase) throw new Error("Missing JETSKI_NO_LICENSE.en snapshot case");

  const actual = renderSnapshotHtml(snapshotCase);
  const forbiddenSpanishPhrases = [
    "Se saldrá del puerto",
    "Se mantendrá siempre",
    "El usuario se compromete",
    "El cliente declara",
    "Declara haber comprendido",
  ];

  for (const phrase of forbiddenSpanishPhrases) {
    assert.equal(actual.includes(phrase), false, `Unexpected Spanish phrase in English contract: ${phrase}`);
  }
});

test("JETSKI_NO_LICENSE.fr does not contain the main Spanish legal clauses", () => {
  const snapshotCase = snapshotCases.find((candidate) => candidate.name === "JETSKI_NO_LICENSE.fr");
  if (!snapshotCase) throw new Error("Missing JETSKI_NO_LICENSE.fr snapshot case");

  const actual = renderSnapshotHtml(snapshotCase);
  const forbiddenSpanishPhrases = [
    "Se saldrá del puerto",
    "Se mantendrá siempre",
    "El usuario se compromete",
    "En caso de accidente",
    "a utilizar las fotografías",
  ];

  for (const phrase of forbiddenSpanishPhrases) {
    assert.equal(actual.includes(phrase), false, `Unexpected Spanish phrase in French contract: ${phrase}`);
  }
});
