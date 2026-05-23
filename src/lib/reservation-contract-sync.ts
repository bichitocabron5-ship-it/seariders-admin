import { ContractStatus, type Prisma } from "@prisma/client";

import { listMissingLogicalUnits } from "@/lib/contracts/active-contracts";

type ContractRow = {
  id: string;
  unitIndex: number | null;
  logicalUnitIndex: number | null;
  status: string | null;
  supersededAt: Date | null;
  createdAt: Date;
};

function resolveContractSlot(contract: ContractRow) {
  return Number(contract.logicalUnitIndex ?? contract.unitIndex ?? 0);
}

function pickActiveContractBySlot(contracts: ContractRow[]) {
  const buckets = new Map<number, ContractRow[]>();

  for (const contract of contracts) {
    const slot = resolveContractSlot(contract);
    if (slot < 1) continue;
    const bucket = buckets.get(slot) ?? [];
    bucket.push(contract);
    buckets.set(slot, bucket);
  }

  const activeBySlot = new Map<number, ContractRow>();
  for (const [slot, bucket] of buckets.entries()) {
    const active = bucket.filter((contract) => !contract.supersededAt);
    if (!active.length) continue;

    active.sort((left, right) => {
      const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;
      return Number(right.unitIndex ?? 0) - Number(left.unitIndex ?? 0);
    });

    activeBySlot.set(slot, active[0]);
  }

  return activeBySlot;
}

export async function syncReservationContractsTx(
  tx: Prisma.TransactionClient,
  args: {
    reservationId: string;
    requiredUnits: number;
    confirmSignedReduction?: boolean;
  }
) {
  const requiredUnits = Math.max(0, Number(args.requiredUnits ?? 0));
  const contracts = await tx.reservationContract.findMany({
    where: { reservationId: args.reservationId },
    select: {
      id: true,
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
    },
    orderBy: [{ logicalUnitIndex: "asc" }, { unitIndex: "desc" }],
  });

  const activeBySlot = pickActiveContractBySlot(contracts);
  const activeContractsToRetire = Array.from(activeBySlot.entries())
    .filter(([slot]) => slot > requiredUnits)
    .sort((left, right) => right[0] - left[0])
    .map(([, contract]) => contract);

  const signedContractsToRetire = activeContractsToRetire.filter((contract) => contract.status === "SIGNED");
  if (signedContractsToRetire.length > 0 && !args.confirmSignedReduction) {
    throw new Error(
      "CONFIRM_SIGNED_CONTRACT_REDUCTION: Esta reducción retira unidades con contrato firmado. Confirma explícitamente para conservar la trazabilidad legal sin borrar firmas."
    );
  }

  const now = new Date();
  const removableDraftIds = activeContractsToRetire
    .filter((contract) => contract.status !== "SIGNED")
    .map((contract) => contract.id);
  const supersededSignedIds = signedContractsToRetire.map((contract) => contract.id);

  if (removableDraftIds.length > 0) {
    await tx.reservationContract.updateMany({
      where: { id: { in: removableDraftIds } },
      data: {
        status: ContractStatus.VOID,
        supersededAt: now,
        preparedJetskiId: null,
        preparedAssetId: null,
      },
    });
  }

  if (supersededSignedIds.length > 0) {
    await tx.reservationContract.updateMany({
      where: { id: { in: supersededSignedIds } },
      data: { supersededAt: now },
    });
  }

  const refreshedContracts = await tx.reservationContract.findMany({
    where: { reservationId: args.reservationId },
    select: {
      unitIndex: true,
      logicalUnitIndex: true,
      status: true,
      supersededAt: true,
      createdAt: true,
    },
  });
  const missingSlots = listMissingLogicalUnits(refreshedContracts, requiredUnits);
  const maxUnitIndex = Math.max(0, ...contracts.map((contract) => Number(contract.unitIndex ?? 0)));

  if (missingSlots.length > 0) {
    await tx.reservationContract.createMany({
      data: missingSlots.map((slot, index) => ({
        reservationId: args.reservationId,
        unitIndex: maxUnitIndex + index + 1,
        logicalUnitIndex: slot,
      })),
      skipDuplicates: true,
    });
  }

  return {
    retiredUnsignedContracts: removableDraftIds.length,
    retiredSignedContracts: supersededSignedIds.length,
  };
}
