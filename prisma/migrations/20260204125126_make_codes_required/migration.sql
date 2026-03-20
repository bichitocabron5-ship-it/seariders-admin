/*
  Warnings:

  - Made the column `code` on table `Service` required. This step will fail if there are existing NULL values in that column.
  - Made the column `code` on table `ServiceOption` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Service" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "ServiceOption" ALTER COLUMN "code" SET NOT NULL;
