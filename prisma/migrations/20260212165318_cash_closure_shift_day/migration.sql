/*
  Warnings:

  - A unique constraint covering the columns `[businessDate,origin,shift]` on the table `CashClosure` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ShiftName" ADD VALUE 'DAY';

-- DropIndex
DROP INDEX "CashClosure_businessDate_origin_key";

-- CreateIndex
CREATE UNIQUE INDEX "CashClosure_businessDate_origin_shift_key" ON "CashClosure"("businessDate", "origin", "shift");
