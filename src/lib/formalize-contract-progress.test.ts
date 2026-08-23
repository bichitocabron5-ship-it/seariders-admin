import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { readReservationContractProgressTx } from "./formalize-contract-progress";

type ContractStatus = "DRAFT" | "READY" | "SIGNED" | "VOID";

type ContractRow = {
  id: string;
  reservationItemId: string | null;
  unitIndex: number;
  logicalUnitIndex: number;
  status: ContractStatus;
  supersededAt: Date | null;
  createdAt: Date;
};

function contract(unit: number, status: ContractStatus = "READY"): ContractRow {
  return {
    id: `contract-${unit}`,
    reservationItemId: "item-main",
    unitIndex: unit,
    logicalUnitIndex: unit,
    status,
    supersededAt: status === "VOID" ? new Date("2026-07-01T12:00:00.000Z") : null,
    createdAt: new Date(`2026-07-01T10:${String(unit).padStart(2, "0")}:00.000Z`),
  };
}

function contracts(count: number, statusForUnit: (unit: number) => ContractStatus = () => "READY") {
  return Array.from({ length: count }, (_, index) => {
    const unit = index + 1;
    return contract(unit, statusForUnit(unit));
  });
}

function reservation(requiredUnits: number, contractRows: ContractRow[]) {
  return {
    id: "reservation-1",
    quantity: requiredUnits,
    isLicense: false,
    serviceId: "service-jetski",
    optionId: "option-20",
    pax: 2,
    totalPriceCents: requiredUnits * 10_000,
    service: { name: "Jetski", category: "JETSKI" },
    option: { durationMinutes: 20 },
    items: [
      {
        id: "item-main",
        serviceId: "service-jetski",
        optionId: "option-20",
        quantity: requiredUnits,
        pax: 2,
        totalPriceCents: requiredUnits * 10_000,
        isExtra: false,
        service: { name: "Jetski", category: "JETSKI" },
        option: { durationMinutes: 20 },
      },
    ],
    contracts: contractRows,
  };
}

function makeReadOnlyTx(row: ReturnType<typeof reservation>) {
  let reservationFindUniqueCalls = 0;
  const forbiddenReservationContractDelegate = new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(`reservationContract.${String(prop)} should not be used by progress read`);
      },
    }
  );

  const tx = {
    reservation: {
      findUnique: async (args: {
        where: { id: string };
        select?: { contracts?: { orderBy?: { unitIndex?: string } } };
      }) => {
        reservationFindUniqueCalls += 1;
        assert.equal(args.where.id, "reservation-1");
        assert.equal(args.select?.contracts?.orderBy?.unitIndex, "asc");
        return row;
      },
    },
    reservationContract: forbiddenReservationContractDelegate,
  } as unknown as Prisma.TransactionClient;

  return {
    tx,
    get reservationFindUniqueCalls() {
      return reservationFindUniqueCalls;
    },
  };
}

test("formalize progress reads 1 ready contract", async () => {
  const db = makeReadOnlyTx(reservation(1, contracts(1)));

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 1, readyCount: 1 });
  assert.equal(db.reservationFindUniqueCalls, 1);
});

test("formalize progress reads 7 ready contracts", async () => {
  const db = makeReadOnlyTx(reservation(7, contracts(7)));

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 7, readyCount: 7 });
});

test("formalize progress reads 10 ready contracts", async () => {
  const db = makeReadOnlyTx(reservation(10, contracts(10)));

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 10, readyCount: 10 });
});

test("formalize progress returns complete when every contract is READY or SIGNED", async () => {
  const db = makeReadOnlyTx(
    reservation(7, contracts(7, (unit) => (unit === 4 ? "SIGNED" : "READY")))
  );

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 7, readyCount: 7 });
});

test("formalize progress reports missing contracts when one is incomplete", async () => {
  const db = makeReadOnlyTx(
    reservation(7, contracts(7, (unit) => (unit === 6 ? "DRAFT" : "READY")))
  );

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 7, readyCount: 6 });
});

test("formalize progress is read-only and keeps signed contracts protected", async () => {
  const signed = contract(1, "SIGNED");
  const rows = [
    signed,
    ...Array.from({ length: 6 }, (_, index) => {
      const unit = index + 2;
      return { ...contract(unit, "READY"), id: `ready-contract-${unit}` };
    }),
  ];
  const db = makeReadOnlyTx(reservation(7, rows));

  const progress = await readReservationContractProgressTx(db.tx, "reservation-1");

  assert.deepEqual(progress, { requiredUnits: 7, readyCount: 7 });
  assert.equal(signed.status, "SIGNED");
  assert.equal(signed.supersededAt, null);
});
