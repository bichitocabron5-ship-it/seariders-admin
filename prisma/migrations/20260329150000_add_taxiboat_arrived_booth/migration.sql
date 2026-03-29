-- AlterEnum
ALTER TYPE "TaxiboatOperationStatus" ADD VALUE 'AT_BOOTH';

-- AlterTable
ALTER TABLE "TaxiboatOperation" ADD COLUMN "arrivedBoothAt" TIMESTAMP(3);
