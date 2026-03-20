/*
  Warnings:

  - A unique constraint covering the columns `[passConsumeId]` on the table `Reservation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "passConsumeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_passConsumeId_key" ON "Reservation"("passConsumeId");
