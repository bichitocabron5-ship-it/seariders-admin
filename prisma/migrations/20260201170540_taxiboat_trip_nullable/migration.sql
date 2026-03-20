/*
  Warnings:

  - A unique constraint covering the columns `[activityDate,boat,tripNo]` on the table `TaxiboatTrip` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TaxiboatTrip" ADD COLUMN     "activityDate" TIMESTAMP(3),
ADD COLUMN     "tripNo" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "TaxiboatTrip_activityDate_boat_tripNo_key" ON "TaxiboatTrip"("activityDate", "boat", "tripNo");
