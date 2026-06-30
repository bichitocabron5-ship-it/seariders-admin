import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type {
  ContractSignatureErrorCode,
  ContractSignatureValidationContract,
  SaveContractSignatureDeps,
} from "./save-contract-signature";

process.env.S3_REGION = "eu-west-1";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_BUCKET = "test-bucket";
process.env.CONTRACT_SIGNATURE_LINK_SECRET = "test-contract-signature-secret";
process.env.RESERVATION_CHECKIN_LINK_SECRET = "test-reservation-checkin-secret";

const {
  ContractSignatureError,
  saveContractSignature,
} = await import("./save-contract-signature");
const { createContractSignatureToken } = await import("./signature-link");
const { createReservationCheckinToken } = await import("@/lib/reservations/public-checkin-link");

type SignatureAccess = Parameters<typeof saveContractSignature>[0]["access"];

const NOW = new Date("2026-06-30T10:00:00.000Z");
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from("signature").toString("base64")}`;

type ContractOptions = {
  id?: string;
  reservationId?: string;
  status?: string;
  supersededAt?: Date | null;
  signedAt?: Date | null;
  unitIndex?: number;
  logicalUnitIndex?: number | null;
  reservationStatus?: string;
  quantity?: number | null;
  reservationContracts?: ContractSignatureValidationContract["reservation"]["contracts"];
};

function makeContract(options: ContractOptions = {}): ContractSignatureValidationContract {
  const id = options.id ?? "contract_1";
  const reservationId = options.reservationId ?? "reservation_1";
  const status = options.status ?? "READY";
  const supersededAt = options.supersededAt ?? null;
  const unitIndex = options.unitIndex ?? 1;
  const logicalUnitIndex = options.logicalUnitIndex === undefined ? 1 : options.logicalUnitIndex;
  const createdAt = new Date("2026-06-30T09:00:00.000Z");
  const contractRow = {
    id,
    unitIndex,
    logicalUnitIndex,
    status,
    supersededAt,
    createdAt,
  };

  return {
    id,
    reservationId,
    unitIndex,
    logicalUnitIndex,
    status,
    supersededAt,
    signedAt: options.signedAt ?? null,
    reservation: {
      id: reservationId,
      status: options.reservationStatus ?? "WAITING",
      quantity: options.quantity ?? 1,
      isLicense: false,
      service: { category: "JETSKI" },
      items: [],
      contracts: options.reservationContracts ?? [contractRow],
    },
  };
}

function makeDeps(t: TestContext, contract: ContractSignatureValidationContract | null) {
  const loadContract = t.mock.fn(async (contractId: string) => {
    void contractId;
    return contract;
  });
  const putSignatureImage = t.mock.fn(async (args: { bucket: string; key: string; body: Buffer }) => {
    void args;
  });
  const updateContractSignature = t.mock.fn(
    async (args: Parameters<NonNullable<SaveContractSignatureDeps["updateContractSignature"]>>[0]) => {
      void args;
    }
  );
  const regenerateSignedContractPdf = t.mock.fn(
    async (contractId: string, language = "es") => ({
      id: contractId,
      status: "SIGNED",
      signedAt: NOW,
      signedLanguage: language,
      renderedPdfKey: "pdf-key",
      renderedPdfUrl: null,
    })
  );

  const deps: SaveContractSignatureDeps = {
    loadContract,
    putSignatureImage,
    updateContractSignature,
    regenerateSignedContractPdf,
    now: () => NOW,
  };

  return {
    deps,
    loadContract,
    putSignatureImage,
    updateContractSignature,
    regenerateSignedContractPdf,
  };
}

function baseArgs(access: SignatureAccess, contractId = "contract_1") {
  return {
    contractId,
    signerName: "Laura Perez",
    imageDataUrl: PNG_DATA_URL,
    access,
  };
}

async function assertRejectsWithCode(
  action: () => Promise<unknown>,
  code: ContractSignatureErrorCode
) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof ContractSignatureError);
    assert.equal(error.code, code);
    return true;
  });
}

function assertNoSignatureSideEffects(mocks: ReturnType<typeof makeDeps>) {
  assert.equal(mocks.putSignatureImage.mock.callCount(), 0);
  assert.equal(mocks.updateContractSignature.mock.callCount(), 0);
  assert.equal(mocks.regenerateSignedContractPdf.mock.callCount(), 0);
}

test("saveContractSignature rechaza contrato inexistente", async (t) => {
  const mocks = makeDeps(t, null);

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_NOT_FOUND"
  );

  assert.equal(mocks.loadContract.mock.callCount(), 1);
  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato VOID", async (t) => {
  const mocks = makeDeps(t, makeContract({ status: "VOID" }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_VOID"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato con supersededAt", async (t) => {
  const mocks = makeDeps(t, makeContract({ supersededAt: new Date("2026-06-30T09:30:00.000Z") }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_SUPERSEDED"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato con signedAt", async (t) => {
  const mocks = makeDeps(t, makeContract({ signedAt: new Date("2026-06-30T09:30:00.000Z") }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_ALREADY_SIGNED"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato con estado SIGNED aunque signedAt sea nulo", async (t) => {
  const mocks = makeDeps(t, makeContract({ status: "SIGNED", signedAt: null }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_ALREADY_SIGNED"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato que no esta READY", async (t) => {
  const mocks = makeDeps(t, makeContract({ status: "DRAFT" }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_NOT_READY"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza token de firma invalido antes de cargar contrato", async (t) => {
  const mocks = makeDeps(t, makeContract());

  await assertRejectsWithCode(
    () =>
      saveContractSignature(
        {
          signerName: "Laura Perez",
          imageDataUrl: PNG_DATA_URL,
          access: { type: "contract-signature-token", token: "not-a-token" },
        },
        mocks.deps
      ),
    "INVALID_SIGNATURE_TOKEN"
  );

  assert.equal(mocks.loadContract.mock.callCount(), 0);
  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza token de firma expirado", async (t) => {
  const mocks = makeDeps(t, makeContract());
  const token = createContractSignatureToken({ contractId: "contract_1", expiresInMinutes: -1 });

  await assertRejectsWithCode(
    () =>
      saveContractSignature(
        {
          signerName: "Laura Perez",
          imageDataUrl: PNG_DATA_URL,
          access: { type: "contract-signature-token", token },
        },
        mocks.deps
      ),
    "INVALID_SIGNATURE_TOKEN"
  );

  assert.equal(mocks.loadContract.mock.callCount(), 0);
  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza token de otro contrato esperado", async (t) => {
  const mocks = makeDeps(t, makeContract());
  const token = createContractSignatureToken({ contractId: "other_contract" });

  await assertRejectsWithCode(
    () =>
      saveContractSignature(
        {
          contractId: "contract_1",
          signerName: "Laura Perez",
          imageDataUrl: PNG_DATA_URL,
          access: { type: "contract-signature-token", token },
        },
        mocks.deps
      ),
    "INVALID_SIGNATURE_TOKEN"
  );

  assert.equal(mocks.loadContract.mock.callCount(), 0);
  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza token de pre-checkin de otra reserva", async (t) => {
  const mocks = makeDeps(t, makeContract({ reservationId: "reservation_1" }));
  const token = createReservationCheckinToken({ reservationId: "reservation_2" });

  await assertRejectsWithCode(
    () =>
      saveContractSignature(
        {
          contractId: "contract_1",
          signerName: "Laura Perez",
          imageDataUrl: PNG_DATA_URL,
          access: { type: "reservation-checkin-token", token },
        },
        mocks.deps
      ),
    "INVALID_SIGNATURE_TOKEN"
  );

  assert.equal(mocks.loadContract.mock.callCount(), 1);
  assertNoSignatureSideEffects(mocks);
});

for (const reservationStatus of ["CANCELED", "COMPLETED"]) {
  test(`saveContractSignature rechaza reserva ${reservationStatus}`, async (t) => {
    const mocks = makeDeps(t, makeContract({ reservationStatus }));

    await assertRejectsWithCode(
      () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
      "RESERVATION_NOT_ACTIVE"
    );

    assertNoSignatureSideEffects(mocks);
  });
}

test("saveContractSignature rechaza contrato READY que no es el visible vigente", async (t) => {
  const olderContract = {
    id: "contract_1",
    unitIndex: 1,
    logicalUnitIndex: 1,
    status: "READY",
    supersededAt: null,
    createdAt: new Date("2026-06-30T08:00:00.000Z"),
  };
  const newerContract = {
    id: "contract_2",
    unitIndex: 2,
    logicalUnitIndex: 1,
    status: "READY",
    supersededAt: null,
    createdAt: new Date("2026-06-30T09:00:00.000Z"),
  };
  const mocks = makeDeps(t, makeContract({ reservationContracts: [olderContract, newerContract] }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_NOT_VISIBLE"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature rechaza contrato READY fuera de las unidades requeridas", async (t) => {
  const mocks = makeDeps(t, makeContract({ logicalUnitIndex: 2, unitIndex: 2, quantity: 1 }));

  await assertRejectsWithCode(
    () => saveContractSignature(baseArgs({ type: "internal" }), mocks.deps),
    "CONTRACT_NOT_VISIBLE"
  );

  assertNoSignatureSideEffects(mocks);
});

test("saveContractSignature firma contrato READY activo con token valido", async (t) => {
  const mocks = makeDeps(t, makeContract());
  const token = createContractSignatureToken({ contractId: "contract_1" });

  const result = await saveContractSignature(
    {
      signerName: "Laura Perez",
      imageDataUrl: PNG_DATA_URL,
      imageConsentAccepted: true,
      language: "en",
      signedLanguage: "en",
      access: { type: "contract-signature-token", token },
    },
    mocks.deps
  );

  assert.equal(result.id, "contract_1");
  assert.equal(mocks.loadContract.mock.callCount(), 1);
  assert.equal(mocks.putSignatureImage.mock.callCount(), 1);
  assert.equal(mocks.updateContractSignature.mock.callCount(), 1);
  assert.equal(mocks.regenerateSignedContractPdf.mock.callCount(), 1);
});
