-- CreateEnum
CREATE TYPE "BarStockPurchaseStatus" AS ENUM ('DRAFT', 'RECEIVED', 'CANCELED');

-- CreateTable
CREATE TABLE "BarStockPurchase" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT,
    "status" "BarStockPurchaseStatus" NOT NULL DEFAULT 'RECEIVED',
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarStockPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarStockPurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarStockPurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarStockPurchase_purchaseDate_status_idx" ON "BarStockPurchase"("purchaseDate", "status");

-- CreateIndex
CREATE INDEX "BarStockPurchase_expenseId_idx" ON "BarStockPurchase"("expenseId");

-- CreateIndex
CREATE INDEX "BarStockPurchaseItem_purchaseId_idx" ON "BarStockPurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "BarStockPurchaseItem_productId_idx" ON "BarStockPurchaseItem"("productId");

-- AddForeignKey
ALTER TABLE "BarStockPurchase" ADD CONSTRAINT "BarStockPurchase_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockPurchaseItem" ADD CONSTRAINT "BarStockPurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "BarStockPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarStockPurchaseItem" ADD CONSTRAINT "BarStockPurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
