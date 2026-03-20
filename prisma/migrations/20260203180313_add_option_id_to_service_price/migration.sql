-- DropIndex
DROP INDEX "ServicePrice_serviceId_validFrom_idx";

-- AlterTable
ALTER TABLE "ServicePrice" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "optionId" TEXT;

-- CreateIndex
CREATE INDEX "ServicePrice_serviceId_optionId_isActive_validFrom_idx" ON "ServicePrice"("serviceId", "optionId", "isActive", "validFrom");

-- CreateIndex
CREATE INDEX "ServicePrice_serviceId_durationMin_isActive_validFrom_idx" ON "ServicePrice"("serviceId", "durationMin", "isActive", "validFrom");

-- AddForeignKey
ALTER TABLE "ServicePrice" ADD CONSTRAINT "ServicePrice_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
