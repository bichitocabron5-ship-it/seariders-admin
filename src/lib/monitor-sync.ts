import { EmployeeKind, Prisma } from "@prisma/client";

type EmployeeMonitorSnapshot = {
  fullName: string;
  kind: EmployeeKind;
  isActive: boolean;
};

function buildMonitorState(snapshot: EmployeeMonitorSnapshot) {
  return {
    name: snapshot.fullName.trim(),
    shouldExist: snapshot.kind === EmployeeKind.MONITOR,
    isActive: snapshot.kind === EmployeeKind.MONITOR && snapshot.isActive,
  };
}

export async function syncMonitorFromEmployee(
  tx: Prisma.TransactionClient,
  previous: EmployeeMonitorSnapshot | null,
  next: EmployeeMonitorSnapshot
) {
  const prevState = previous ? buildMonitorState(previous) : null;
  const nextState = buildMonitorState(next);

  if (!prevState) {
    if (!nextState.shouldExist) return;

    await tx.monitor.upsert({
      where: { name: nextState.name },
      update: { isActive: nextState.isActive },
      create: { name: nextState.name, isActive: nextState.isActive, maxCapacity: 4 },
    });
    return;
  }

  if (prevState.shouldExist) {
    const existing = await tx.monitor.findUnique({
      where: { name: prevState.name },
      select: { id: true },
    });

    if (nextState.shouldExist) {
      if (existing) {
        await tx.monitor.update({
          where: { id: existing.id },
          data: { name: nextState.name, isActive: nextState.isActive },
        });
      } else {
        await tx.monitor.upsert({
          where: { name: nextState.name },
          update: { isActive: nextState.isActive },
          create: { name: nextState.name, isActive: nextState.isActive, maxCapacity: 4 },
        });
      }
      return;
    }

    if (existing) {
      await tx.monitor.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }
    return;
  }

  if (!nextState.shouldExist) return;

  await tx.monitor.upsert({
    where: { name: nextState.name },
    update: { isActive: nextState.isActive },
    create: { name: nextState.name, isActive: nextState.isActive, maxCapacity: 4 },
  });
}
