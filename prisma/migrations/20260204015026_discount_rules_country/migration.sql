-- AlterTable
ALTER TABLE "DiscountRule" ADD COLUMN     "excludeCountry" TEXT,
ADD COLUMN     "requiresCountry" TEXT;

-- CreateIndex
CREATE INDEX "DiscountRule_requiresCountry_idx" ON "DiscountRule"("requiresCountry");

-- CreateIndex
CREATE INDEX "DiscountRule_excludeCountry_idx" ON "DiscountRule"("excludeCountry");
