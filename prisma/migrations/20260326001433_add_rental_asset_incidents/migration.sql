-- CreateEnum
CREATE TYPE "RentalAssetIncidentType" AS ENUM ('DAMAGED', 'MAINTENANCE', 'LOST', 'OTHER');

-- CreateTable
CREATE TABLE "RentalAssetIncident" (
    "id" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "type" "RentalAssetIncidentType" NOT NULL,
    "note" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAssetIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalAssetIncident_rentalAssetId_openedAt_idx" ON "RentalAssetIncident"("rentalAssetId", "openedAt");

-- CreateIndex
CREATE INDEX "RentalAssetIncident_type_openedAt_idx" ON "RentalAssetIncident"("type", "openedAt");

-- AddForeignKey
ALTER TABLE "RentalAssetIncident" ADD CONSTRAINT "RentalAssetIncident_rentalAssetId_fkey" FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalAssetIncident" ADD CONSTRAINT "RentalAssetIncident_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
