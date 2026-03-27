-- CreateEnum
CREATE TYPE "BarPromotionType" AS ENUM ('FIXED_TOTAL_FOR_QTY', 'BUY_X_PAY_Y');

-- CreateTable
CREATE TABLE "BarPromotion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "BarPromotionType" NOT NULL,
    "exactQty" INTEGER,
    "fixedTotalCents" INTEGER,
    "buyQty" INTEGER,
    "payQty" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarPromotion_productId_isActive_idx" ON "BarPromotion"("productId", "isActive");

-- AddForeignKey
ALTER TABLE "BarPromotion" ADD CONSTRAINT "BarPromotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
