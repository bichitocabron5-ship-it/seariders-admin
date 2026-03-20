-- CreateEnum
CREATE TYPE "TaxiboatBoat" AS ENUM ('TAXIBOAT_1', 'TAXIBOAT_2');

-- CreateEnum
CREATE TYPE "TaxiboatTripStatus" AS ENUM ('OPEN', 'DEPARTED', 'CANCELED');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "taxiboatAssignedAt" TIMESTAMP(3),
ADD COLUMN     "taxiboatAssignedByUserId" TEXT,
ADD COLUMN     "taxiboatTripId" TEXT;

-- CreateTable
CREATE TABLE "TaxiboatTrip" (
    "id" TEXT NOT NULL,
    "boat" "TaxiboatBoat" NOT NULL DEFAULT 'TAXIBOAT_1',
    "status" "TaxiboatTripStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "departedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "TaxiboatTrip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxiboatTrip_createdAt_idx" ON "TaxiboatTrip"("createdAt");

-- CreateIndex
CREATE INDEX "TaxiboatTrip_boat_status_idx" ON "TaxiboatTrip"("boat", "status");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_taxiboatTripId_fkey" FOREIGN KEY ("taxiboatTripId") REFERENCES "TaxiboatTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
