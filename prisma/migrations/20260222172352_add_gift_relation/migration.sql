/*
  Warnings:

  - A unique constraint covering the columns `[giftVoucherId]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "giftVoucherId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_giftVoucherId_key" ON "Reservation"("giftVoucherId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_giftVoucherId_fkey" FOREIGN KEY ("giftVoucherId") REFERENCES "GiftVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
