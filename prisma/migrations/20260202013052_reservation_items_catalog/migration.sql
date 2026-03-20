/*
  Warnings:

  - A unique constraint covering the columns `[activityDate,boat,tripNo]` on the table `TaxiboatTrip` will be added. If there are existing duplicate values, this will fail.
  - Made the column `activityDate` on table `TaxiboatTrip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tripNo` on table `TaxiboatTrip` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('JETSKI', 'JETCAR', 'BOAT', 'TOWABLE', 'EXTRA', 'BAR');

-- AlterTable
ALTER TABLE "TaxiboatTrip" ALTER COLUMN "activityDate" SET NOT NULL,
ALTER COLUMN "tripNo" SET NOT NULL;

-- CreateTable
CREATE TABLE "ServicePrice" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMin" INTEGER,
    "basePriceCents" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "optionId" TEXT,
    "servicePriceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pax" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    "isExtra" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePrice_serviceId_validFrom_idx" ON "ServicePrice"("serviceId", "validFrom");

-- CreateIndex
CREATE INDEX "ReservationItem_reservationId_idx" ON "ReservationItem"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationItem_serviceId_idx" ON "ReservationItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxiboatTrip_activityDate_boat_tripNo_key" ON "TaxiboatTrip"("activityDate", "boat", "tripNo");

-- AddForeignKey
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_servicePriceId_fkey" FOREIGN KEY ("servicePriceId") REFERENCES "ServicePrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
