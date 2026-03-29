-- CreateEnum
CREATE TYPE "TaxiboatOperationStatus" AS ENUM ('AT_PLATFORM', 'TO_BOOTH');

-- CreateTable
CREATE TABLE "TaxiboatOperation" (
    "id" TEXT NOT NULL,
    "boat" "TaxiboatBoat" NOT NULL,
    "status" "TaxiboatOperationStatus" NOT NULL DEFAULT 'AT_PLATFORM',
    "arrivedPlatformAt" TIMESTAMP(3),
    "departedPlatformAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxiboatOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxiboatOperation_boat_key" ON "TaxiboatOperation"("boat");
