/*
  Warnings:

  - Made the column `businessDate` on table `ShiftSession` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ShiftSession" ALTER COLUMN "businessDate" SET NOT NULL;
