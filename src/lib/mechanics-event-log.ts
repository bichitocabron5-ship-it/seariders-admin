// src/lib/mechanics-event-log.ts
import { MaintenanceEventLogKind, Prisma } from "@prisma/client";

type TxLike = {
  maintenanceEventLog: {
    create: (args: Prisma.MaintenanceEventLogCreateArgs) => Promise<unknown>;
  };
};

export async function createMaintenanceEventLog(params: {
  tx: TxLike;
  maintenanceEventId: string;
  kind: MaintenanceEventLogKind;
  message: string;
  createdByUserId?: string | null;
  payloadJson?: Prisma.InputJsonValue | null;
}) {
  const {
    tx,
    maintenanceEventId,
    kind,
    message,
    createdByUserId,
    payloadJson,
  } = params;

  await tx.maintenanceEventLog.create({
    data: {
      maintenanceEventId,
      kind,
      message,
      createdByUserId: createdByUserId ?? null,
      payloadJson: payloadJson ?? undefined,
    },
  });
}
