/*
  Warnings:

  - A unique constraint covering the columns `[maintenanceEventId]` on the table `Incident` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entityType` to the `Incident` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'LINKED', 'RESOLVED', 'CANCELED');

-- AlterEnum
ALTER TYPE "IncidentLevel" ADD VALUE 'CRITICAL';

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_jetskiId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_runId_fkey";

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "affectsOperability" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "assetId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "entityType" "MaintenanceEntityType" NOT NULL,
ADD COLUMN     "maintenanceEventId" TEXT,
ADD COLUMN     "operabilityStatus" "PlatformOperabilityStatus",
ADD COLUMN     "retainDeposit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retainDepositCents" INTEGER,
ADD COLUMN     "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "reservationId" DROP NOT NULL,
ALTER COLUMN "runId" DROP NOT NULL,
ALTER COLUMN "jetskiId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Incident_maintenanceEventId_key" ON "Incident"("maintenanceEventId");

-- CreateIndex
CREATE INDEX "Incident_assetId_isOpen_idx" ON "Incident"("assetId", "isOpen");

-- CreateIndex
CREATE INDEX "Incident_entityType_createdAt_idx" ON "Incident"("entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MonitorRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
