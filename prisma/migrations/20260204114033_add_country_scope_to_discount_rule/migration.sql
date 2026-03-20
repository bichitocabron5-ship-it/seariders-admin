-- CreateEnum
CREATE TYPE "CountryScope" AS ENUM ('ANY', 'ES_ONLY', 'NON_ES_ONLY');

-- AlterTable
ALTER TABLE "DiscountRule" ADD COLUMN     "countryScope" "CountryScope" NOT NULL DEFAULT 'ANY';

-- CreateIndex
CREATE INDEX "DiscountRule_countryScope_idx" ON "DiscountRule"("countryScope");
