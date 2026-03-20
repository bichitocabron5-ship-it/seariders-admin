/*
  Warnings:

  - You are about to drop the column `terimnationDate` on the `Employee` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "terimnationDate",
ADD COLUMN     "terminationDate" TIMESTAMP(3);
