/*
  Warnings:

  - The values [IN,OUT,ADJUSTMENT] on the enum `SparePartMovementType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SparePartMovementType_new" AS ENUM ('INITIAL_STOCK', 'PURCHASE', 'CONSUMPTION', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN');
ALTER TABLE "SparePartMovement" ALTER COLUMN "type" TYPE "SparePartMovementType_new" USING ("type"::text::"SparePartMovementType_new");
ALTER TYPE "SparePartMovementType" RENAME TO "SparePartMovementType_old";
ALTER TYPE "SparePartMovementType_new" RENAME TO "SparePartMovementType";
DROP TYPE "public"."SparePartMovementType_old";
COMMIT;

-- AlterTable
ALTER TABLE "SparePartMovement" ADD COLUMN     "expenseId" TEXT,
ADD COLUMN     "maintenanceEventId" TEXT,
ADD COLUMN     "totalCostCents" INTEGER,
ADD COLUMN     "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "SparePartMovement_vendorId_idx" ON "SparePartMovement"("vendorId");

-- CreateIndex
CREATE INDEX "SparePartMovement_expenseId_idx" ON "SparePartMovement"("expenseId");

-- CreateIndex
CREATE INDEX "SparePartMovement_maintenanceEventId_idx" ON "SparePartMovement"("maintenanceEventId");

-- AddForeignKey
ALTER TABLE "SparePartMovement" ADD CONSTRAINT "SparePartMovement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ExpenseVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartMovement" ADD CONSTRAINT "SparePartMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparePartMovement" ADD CONSTRAINT "SparePartMovement_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
