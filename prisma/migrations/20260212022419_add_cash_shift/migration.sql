/*
  Warnings:

  - You are about to drop the column `closedAt` on the `CashClosure` table. All the data in the column will be lost.
  - You are about to drop the column `computed` on the `CashClosure` table. All the data in the column will be lost.
  - You are about to drop the column `declared` on the `CashClosure` table. All the data in the column will be lost.
  - You are about to drop the column `diff` on the `CashClosure` table. All the data in the column will be lost.
  - Added the required column `cashShiftId` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `computedJson` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `declaredJson` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diffJson` to the `CashClosure` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CashClosure" DROP COLUMN "closedAt",
DROP COLUMN "computed",
DROP COLUMN "declared",
DROP COLUMN "diff",
ADD COLUMN     "cashShiftId" TEXT NOT NULL,
ADD COLUMN     "computedJson" JSONB NOT NULL,
ADD COLUMN     "declaredJson" JSONB NOT NULL,
ADD COLUMN     "diffJson" JSONB NOT NULL,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT,
ALTER COLUMN "note" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ShiftSession" ADD COLUMN     "cashShiftId" TEXT;

-- CreateTable
CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "origin" "PaymentOrigin" NOT NULL,
    "shift" "ShiftName" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,

    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashShift_origin_date_idx" ON "CashShift"("origin", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CashShift_origin_shift_date_key" ON "CashShift"("origin", "shift", "date");

-- CreateIndex
CREATE INDEX "ShiftSession_cashShiftId_idx" ON "ShiftSession"("cashShiftId");

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
