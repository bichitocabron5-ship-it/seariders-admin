-- CreateEnum
CREATE TYPE "MaintenanceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'EXTERNAL', 'CANCELED');

-- CreateEnum
CREATE TYPE "SparePartMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "MaintenanceEvent" ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "externalWorkshop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "faultCode" TEXT,
ADD COLUMN     "laborCostCents" INTEGER,
ADD COLUMN     "partsCostCents" INTEGER,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "severity" "MaintenanceSeverity" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "status" "MaintenanceStatus" NOT NULL DEFAULT 'RESOLVED',
ADD COLUMN     "supplierName" TEXT;

-- CreateTable
CREATE TABLE "SparePart" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "unit" TEXT,
    "stockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStockQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnitCents" INTEGER,
    "supplierName" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparePartMovement" (
    "id" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "type" "SparePartMovementType" NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitCostCents" INTEGER,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparePartMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePartUsage" (
    "id" TEXT NOT NULL,
    "maintenanceEventId" TEXT NOT NULL,
    "sparePartId" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitCostCents" INTEGER,
    "totalCostCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePartUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparePart_sku_key" ON "SparePart"("sku");

-- CreateIndex
CREATE INDEX "SparePart_name_idx" ON "SparePart"("name");

-- CreateIndex
CREATE INDEX "SparePart_category_idx" ON "SparePart"("category");

-- CreateIndex
CREATE INDEX "SparePart_isActive_idx" ON "SparePart"("isActive");

-- CreateIndex
CREATE INDEX "SparePart_stockQty_idx" ON "SparePart"("stockQty");

-- CreateIndex
CREATE INDEX "SparePartMovement_sparePartId_createdAt_idx" ON "SparePartMovement"("sparePartId", "createdAt");

-- CreateIndex
CREATE INDEX "SparePartMovement_type_createdAt_idx" ON "SparePartMovement"("type", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenancePartUsage_maintenanceEventId_idx" ON "MaintenancePartUsage"("maintenanceEventId");

-- CreateIndex
CREATE INDEX "MaintenancePartUsage_sparePartId_idx" ON "MaintenancePartUsage"("sparePartId");

-- AddForeignKey
ALTER TABLE "SparePartMovement" ADD CONSTRAINT "SparePartMovement_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartMovement" ADD CONSTRAINT "SparePartMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePartUsage" ADD CONSTRAINT "MaintenancePartUsage_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePartUsage" ADD CONSTRAINT "MaintenancePartUsage_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
