-- CreateEnum
CREATE TYPE "RentalAssetType" AS ENUM ('GOPRO', 'WETSUIT', 'OTHER');

-- CreateEnum
CREATE TYPE "RentalAssetStatus" AS ENUM ('AVAILABLE', 'DELIVERED', 'MAINTENANCE', 'DAMAGED', 'LOST', 'INACTIVE');

-- CreateTable
CREATE TABLE "RentalAsset" (
    "id" TEXT NOT NULL,
    "type" "RentalAssetType" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(60),
    "size" VARCHAR(20),
    "status" "RentalAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentAssetAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskItemId" TEXT,
    "rentalAssetId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedByUserId" TEXT,
    "returnOk" BOOLEAN,
    "returnNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentAssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalAsset_type_status_idx" ON "RentalAsset"("type", "status");

-- CreateIndex
CREATE INDEX "RentalAsset_isActive_status_idx" ON "RentalAsset"("isActive", "status");

-- CreateIndex
CREATE INDEX "RentalAsset_type_size_status_idx" ON "RentalAsset"("type", "size", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalAsset_code_key" ON "RentalAsset"("code");

-- CreateIndex
CREATE INDEX "FulfillmentAssetAssignment_taskId_idx" ON "FulfillmentAssetAssignment"("taskId");

-- CreateIndex
CREATE INDEX "FulfillmentAssetAssignment_taskItemId_idx" ON "FulfillmentAssetAssignment"("taskItemId");

-- CreateIndex
CREATE INDEX "FulfillmentAssetAssignment_rentalAssetId_idx" ON "FulfillmentAssetAssignment"("rentalAssetId");

-- AddForeignKey
ALTER TABLE "FulfillmentAssetAssignment" ADD CONSTRAINT "FulfillmentAssetAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FulfillmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAssetAssignment" ADD CONSTRAINT "FulfillmentAssetAssignment_taskItemId_fkey" FOREIGN KEY ("taskItemId") REFERENCES "FulfillmentTaskItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAssetAssignment" ADD CONSTRAINT "FulfillmentAssetAssignment_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAssetAssignment" ADD CONSTRAINT "FulfillmentAssetAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentAssetAssignment" ADD CONSTRAINT "FulfillmentAssetAssignment_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
