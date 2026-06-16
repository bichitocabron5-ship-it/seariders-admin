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
    name: "JETSKI_LICENSED.es",
    templateCode: "JETSKI_LICENSED",
    language: "es",
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

async function assertHtmlSnapshot(snapshotCase: SnapshotCase) {
  const actual = buildContractHtml({
    templateCode: snapshotCase.templateCode,
    templateVersion: "v1",
    language: snapshotCase.language,
    logoSrc: "/logo-seariders.png",
    reservation: snapshotCase.reservation,
    contract: snapshotCase.contract,
  });

  const snapshotPath = path.join(snapshotDir, `render-contract.${snapshotCase.name}.html`);

  if (shouldUpdateSnapshots) {
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(snapshotPath, actual, "utf8");
    return;
  }

  const expected = await readFile(snapshotPath, "utf8");
  assert.equal(actual, expected);
}

for (const snapshotCase of snapshotCases) {
  test(`contract html snapshot ${snapshotCase.name}`, async () => {
    await assertHtmlSnapshot(snapshotCase);
  });
}
