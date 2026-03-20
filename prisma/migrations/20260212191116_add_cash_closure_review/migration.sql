-- AlterTable
ALTER TABLE "CashClosure" ADD COLUMN     "reviewNote" VARCHAR(500),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "CashClosure_reviewedByUserId_idx" ON "CashClosure"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "CashClosure_reviewedAt_idx" ON "CashClosure"("reviewedAt");

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
