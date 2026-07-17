import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditReservationLegalContent,
  countLockedVisibleContracts,
  countReadyVisibleContracts,
  countReadyVisibleContractsByTargets,
  listMissingLogicalUnits,
  pickVisibleContractsByLogicalUnit,
  pickVisibleContractsByTargets,
} from "./active-contracts";

function contract(
  status: "DRAFT" | "READY" | "SIGNED" | "VOID",
  logicalUnitIndex = 1,
  patch: { id?: string; reservationItemId?: string | null } = {}
) {
  return {
    id: patch.id ?? `contract-${logicalUnitIndex}-${status}`,
    unitIndex: logicalUnitIndex,
    logicalUnitIndex,
    reservationItemId: patch.reservationItemId ?? null,
    status,
    supersededAt: null,
    createdAt: new Date(`2026-06-30T10:0${logicalUnitIndex}:00.000Z`),
  };
}

test("reserva con contratos READY permite editar cantidad, duracion y servicio si no hay SIGNED", () => {
  const contracts = [contract("READY")];

  assert.equal(canEditReservationLegalContent(contracts, 1), true);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("reserva con contratos SIGNED sigue bloqueando cambios legales", () => {
  const contracts = [contract("SIGNED")];

  assert.equal(canEditReservationLegalContent(contracts, 1), false);
  assert.equal(countLockedVisibleContracts(contracts, 1), 1);
});

test("reserva con contrato DRAFT sigue editable", () => {
  const contracts = [contract("DRAFT")];

  assert.equal(canEditReservationLegalContent(contracts, 1), true);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("READY cuenta como preparado pero no como locked", () => {
  const contracts = [contract("READY")];

  assert.equal(countReadyVisibleContracts(contracts, 1), 1);
  assert.equal(countLockedVisibleContracts(contracts, 1), 0);
});

test("VOID y superseded no aparecen como contratos activos", () => {
  const contracts = [
    contract("VOID", 1),
    { ...contract("READY", 2), supersededAt: new Date("2026-06-30T11:00:00.000Z") },
  ];

  assert.deepEqual(pickVisibleContractsByLogicalUnit(contracts, 2), []);
  assert.deepEqual(listMissingLogicalUnits(contracts, 2), [1, 2]);
  assert.equal(countReadyVisibleContracts(contracts, 2), 0);
});

test("requiredUnits 0 no expone contratos activos aunque existan filas antiguas", () => {
  const contracts = [contract("DRAFT", 1), contract("READY", 2), contract("SIGNED", 3)];

  assert.deepEqual(pickVisibleContractsByLogicalUnit(contracts, 0), []);
  assert.deepEqual(listMissingLogicalUnits(contracts, 0), []);
  assert.equal(countReadyVisibleContracts(contracts, 0), 0);
  assert.equal(countLockedVisibleContracts(contracts, 0), 0);
});

test("visibilidad legacy por requiredUnits sigue basada en logicalUnitIndex", () => {
  const contracts = [
    contract("READY", 1, {
      id: "legacy-contract",
      reservationItemId: null,
    }),
  ];

  assert.deepEqual(
    pickVisibleContractsByLogicalUnit(contracts, 1).map((item) => item.id),
    ["legacy-contract"]
  );
  assert.equal(countReadyVisibleContracts(contracts, 1), 1);
});

test("visibilidad por targets no cuenta contrato de otra linea", () => {
  const visible = pickVisibleContractsByTargets(
    [
      contract("READY", 1, { id: "jetski-20-contract", reservationItemId: "jetski-20" }),
      contract("READY", 2, { id: "jetski-20-duplicate", reservationItemId: "jetski-20" }),
    ],
    [
      { logicalUnitIndex: 1, reservationItemId: "jetski-20" },
      { logicalUnitIndex: 2, reservationItemId: "jetski-40" },
    ]
  );

  assert.deepEqual(
    visible.map((item) => item.id),
    ["jetski-20-contract"]
  );
});

test("ready por targets exige todas las lineas requeridas", () => {
  assert.equal(
    countReadyVisibleContractsByTargets(
      [
        contract("READY", 1, {
          id: "jetski-20-contract",
          reservationItemId: "jetski-20",
        }),
      ],
      [
        { logicalUnitIndex: 1, reservationItemId: "jetski-20" },
        { logicalUnitIndex: 2, reservationItemId: "jetski-40" },
      ]
    ),
    1
  );
});

test("visibilidad por targets conserva contrato legacy sin reservationItemId por slot", () => {
  const visible = pickVisibleContractsByTargets(
    [
      contract("READY", 1, {
        id: "legacy-contract",
        reservationItemId: null,
      }),
    ],
    [{ logicalUnitIndex: 1, reservationItemId: "jetski-20" }]
  );

  assert.deepEqual(
    visible.map((item) => item.id),
    ["legacy-contract"]
  );
});

test("visibilidad por targets no adopta contrato legacy por slot en reserva multiitem", () => {
  const contracts = [
    contract("READY", 1, {
      id: "legacy-contract",
      reservationItemId: null,
    }),
  ];
  const targets = [
    { logicalUnitIndex: 1, reservationItemId: "jetski-20" },
    { logicalUnitIndex: 2, reservationItemId: "jetski-40" },
  ];
  const visible = pickVisibleContractsByTargets(contracts, targets);

  assert.deepEqual(
    visible.map((item) => item.id),
    []
  );
  assert.equal(countReadyVisibleContractsByTargets(contracts, targets), 0);
});

test("visibilidad por targets prefiere contrato vinculado sobre legacy del mismo slot", () => {
  const visible = pickVisibleContractsByTargets(
    [
      contract("SIGNED", 1, {
        id: "legacy-contract",
        reservationItemId: null,
      }),
      contract("READY", 1, {
        id: "linked-contract",
        reservationItemId: "jetski-20",
      }),
    ],
    [{ logicalUnitIndex: 1, reservationItemId: "jetski-20" }]
  );

  assert.deepEqual(
    visible.map((item) => item.id),
    ["linked-contract"]
  );
});
