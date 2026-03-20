/*
  Warnings:

  - Made the column `activityDate` on table `TaxiboatTrip` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tripNo` on table `TaxiboatTrip` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TaxiboatTrip" ALTER COLUMN "activityDate" SET NOT NULL,
ALTER COLUMN "tripNo" SET NOT NULL;
