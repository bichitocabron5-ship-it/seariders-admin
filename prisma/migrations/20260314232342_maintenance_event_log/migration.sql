-- CreateEnum
CREATE TYPE "MaintenanceEventLogKind" AS ENUM ('CREATED', 'STATUS_CHANGED', 'REOPENED', 'RESOLVED', 'PARTS_UPDATED', 'COSTS_UPDATED', 'NOTE_UPDATED', 'FIELD_UPDATE');

-- CreateTable
CREATE TABLE "MaintenanceEventLog" (
    "id" TEXT NOT NULL,
    "maintenanceEventId" TEXT NOT NULL,
    "kind" "MaintenanceEventLogKind" NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceEventLog_maintenanceEventId_createdAt_idx" ON "MaintenanceEventLog"("maintenanceEventId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceEventLog_kind_createdAt_idx" ON "MaintenanceEventLog"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceEventLog" ADD CONSTRAINT "MaintenanceEventLog_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceEventLog" ADD CONSTRAINT "MaintenanceEventLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
