-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('BOAT', 'TOWBOAT', 'JETCAR', 'PARASAILING', 'FLYBOARD', 'TOWABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'DAMAGED', 'OUT');

-- AlterTable
ALTER TABLE "MonitorRunAssignment" ADD COLUMN     "assetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "name" TEXT NOT NULL,
    "code" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "plate" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_type_status_idx" ON "Asset"("type", "status");

-- CreateIndex
CREATE INDEX "Asset_status_idx" ON "Asset"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_code_key" ON "Asset"("code");

-- CreateIndex
CREATE INDEX "MonitorRunAssignment_assetId_idx" ON "MonitorRunAssignment"("assetId");

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
