/*
  Warnings:

  - Added the required column `SystemJson` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shift` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `windowFrom` to the `CashClosure` table without a default value. This is not possible if the table is not empty.
  - Added the required column `windowTo` to the `CashClosure` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CashClosure_origin_businessDate_idx";

-- AlterTable
ALTER TABLE "CashClosure" ADD COLUMN     "SystemJson" JSONB NOT NULL,
ADD COLUMN     "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isVoided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift" "ShiftName" NOT NULL,
ADD COLUMN     "voidReason" VARCHAR(500),
ADD COLUMN     "windowFrom" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "windowTo" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "CashClosureUser" (
    "id" TEXT NOT NULL,
    "cashClosureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleNameAtClose" "RoleName",

    CONSTRAINT "CashClosureUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashClosureUser_userId_idx" ON "CashClosureUser"("userId");

-- CreateIndex
CREATE INDEX "CashClosureUser_cashClosureId_idx" ON "CashClosureUser"("cashClosureId");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosureUser_cashClosureId_userId_key" ON "CashClosureUser"("cashClosureId", "userId");

-- CreateIndex
CREATE INDEX "CashClosure_origin_shift_businessDate_idx" ON "CashClosure"("origin", "shift", "businessDate");

-- CreateIndex
CREATE INDEX "CashClosure_isVoided_idx" ON "CashClosure"("isVoided");

-- AddForeignKey
ALTER TABLE "CashClosureUser" ADD CONSTRAINT "CashClosureUser_cashClosureId_fkey" FOREIGN KEY ("cashClosureId") REFERENCES "CashClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashClosureUser" ADD CONSTRAINT "CashClosureUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
