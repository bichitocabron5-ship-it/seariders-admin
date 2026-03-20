-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('ALL', 'CATEGORY', 'SERVICE', 'OPTION');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "autoDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promoCode" TEXT;

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kind" "DiscountKind" NOT NULL,
    "value" INTEGER NOT NULL,
    "scope" "DiscountScope" NOT NULL DEFAULT 'ALL',
    "category" TEXT,
    "serviceId" TEXT,
    "optionId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "daysOfWeek" INTEGER[],
    "startTimeMin" INTEGER,
    "endTimeMin" INTEGER,
    "appliesToExtras" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountRule_code_key" ON "DiscountRule"("code");

-- CreateIndex
CREATE INDEX "DiscountRule_isActive_validFrom_validTo_idx" ON "DiscountRule"("isActive", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "DiscountRule_code_idx" ON "DiscountRule"("code");

-- CreateIndex
CREATE INDEX "DiscountRule_serviceId_idx" ON "DiscountRule"("serviceId");

-- CreateIndex
CREATE INDEX "DiscountRule_optionId_idx" ON "DiscountRule"("optionId");

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
