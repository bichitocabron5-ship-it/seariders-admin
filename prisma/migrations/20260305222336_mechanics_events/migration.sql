-- CreateEnum
CREATE TYPE "MaintenanceEntityType" AS ENUM ('JETSKI', 'ASSET');

-- CreateTable
CREATE TABLE "MaintenanceEvent" (
    "id" TEXT NOT NULL,
    "entityType" "MaintenanceEntityType" NOT NULL,
    "jetskiId" TEXT,
    "assetId" TEXT,
    "hoursAtService" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceEvent_entityType_createdAt_idx" ON "MaintenanceEvent"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_jetskiId_createdAt_idx" ON "MaintenanceEvent"("jetskiId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceEvent_assetId_createdAt_idx" ON "MaintenanceEvent"("assetId", "createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
