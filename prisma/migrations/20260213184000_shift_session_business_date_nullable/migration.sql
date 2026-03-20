-- DropForeignKey
ALTER TABLE "ShiftSession" DROP CONSTRAINT "ShiftSession_userId_fkey";

-- AlterTable
ALTER TABLE "ShiftSession" ADD COLUMN     "businessDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Payment_origin_createdAt_idx" ON "Payment"("origin", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_shiftSessionId_idx" ON "Payment"("shiftSessionId");

-- CreateIndex
CREATE INDEX "ShiftSession_businessDate_shift_idx" ON "ShiftSession"("businessDate", "shift");

-- CreateIndex
CREATE INDEX "ShiftSession_userId_endedAt_idx" ON "ShiftSession"("userId", "endedAt");

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
