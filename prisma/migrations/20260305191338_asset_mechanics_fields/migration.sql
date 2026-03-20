/*
  Warnings:

  - A unique constraint covering the columns `[runId,assetId]` on the table `MonitorRunAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "MonitorRunAssignment" DROP CONSTRAINT "MonitorRunAssignment_jetskiId_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "currentHours" DOUBLE PRECISION,
ADD COLUMN     "lastServiceHours" DOUBLE PRECISION,
ADD COLUMN     "serviceIntervalHours" DOUBLE PRECISION NOT NULL DEFAULT 85,
ADD COLUMN     "serviceWarnHours" DOUBLE PRECISION NOT NULL DEFAULT 70;

-- AlterTable
ALTER TABLE "MonitorRunAssignment" ALTER COLUMN "jetskiId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "MonitorRunAssignment_jetskiId_idx" ON "MonitorRunAssignment"("jetskiId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorRunAssignment_runId_assetId_key" ON "MonitorRunAssignment"("runId", "assetId");

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE SET NULL ON UPDATE CASCADE;
