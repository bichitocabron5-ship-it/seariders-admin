-- AlterTable
ALTER TABLE "BarProduct" ADD COLUMN     "costPriceCents" INTEGER;

-- CreateTable
CREATE TABLE "BarSale" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "shiftSessionId" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldByUserId" TEXT,
    "staffMode" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "totalRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "totalMarginCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "revenueCents" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "costCents" INTEGER,
    "marginCents" INTEGER,
    "promotionLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarSale_paymentId_key" ON "BarSale"("paymentId");

-- CreateIndex
CREATE INDEX "BarSale_soldAt_idx" ON "BarSale"("soldAt");

-- CreateIndex
CREATE INDEX "BarSale_staffMode_soldAt_idx" ON "BarSale"("staffMode", "soldAt");

-- CreateIndex
CREATE INDEX "BarSale_soldByUserId_idx" ON "BarSale"("soldByUserId");

-- CreateIndex
CREATE INDEX "BarSaleItem_saleId_idx" ON "BarSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "BarSaleItem_productId_idx" ON "BarSaleItem"("productId");

-- AddForeignKey
ALTER TABLE "BarSale" ADD CONSTRAINT "BarSale_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarSale" ADD CONSTRAINT "BarSale_shiftSessionId_fkey" FOREIGN KEY ("shiftSessionId") REFERENCES "ShiftSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarSale" ADD CONSTRAINT "BarSale_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarSaleItem" ADD CONSTRAINT "BarSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "BarSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarSaleItem" ADD CONSTRAINT "BarSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
