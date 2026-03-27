-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('PURCHASE', 'BAR_SALE', 'CATERING_DELIVERY', 'EXTRA_DELIVERY', 'MANUAL_ADJUSTMENT', 'WASTE', 'RETURN', 'OTHER');

-- CreateTable
CREATE TABLE "BarStockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "stockBefore" DECIMAL(12,3),
    "stockAfter" DECIMAL(12,3),
    "unitCostCents" INTEGER,
    "notes" TEXT,
    "sourceType" VARCHAR(40),
    "sourceId" VARCHAR(120),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarStockMovement_productId_createdAt_idx" ON "BarStockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "BarStockMovement_reason_createdAt_idx" ON "BarStockMovement"("reason", "createdAt");

-- CreateIndex
CREATE INDEX "BarStockMovement_sourceType_sourceId_idx" ON "BarStockMovement"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "BarStockMovement" ADD CONSTRAINT "BarStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockMovement" ADD CONSTRAINT "BarStockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
