/*
  Warnings:

  - You are about to drop the column `SystemJson` on the `CashClosure` table. All the data in the column will be lost.
  - Added the required column `systemJson` to the `CashClosure` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CashClosure" DROP COLUMN "SystemJson",
ADD COLUMN     "systemJson" JSONB NOT NULL;
