-- DropIndex
DROP INDEX "TaxiboatTrip_activityDate_boat_tripNo_key";

-- AlterTable
ALTER TABLE "TaxiboatTrip" ALTER COLUMN "activityDate" DROP NOT NULL,
ALTER COLUMN "tripNo" DROP NOT NULL;
