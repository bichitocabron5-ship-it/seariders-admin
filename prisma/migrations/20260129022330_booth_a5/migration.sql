/*
  Warnings:

  - A unique constraint covering the columns `[boothCode]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "boothCode" TEXT,
ADD COLUMN     "boothCreatedAt" TIMESTAMP(3),
ADD COLUMN     "boothCreatedByUserId" TEXT,
ALTER COLUMN "customerAddress" DROP NOT NULL,
ALTER COLUMN "customerDocType" DROP NOT NULL,
ALTER COLUMN "customerDocNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_boothCode_key" ON "Reservation"("boothCode");
