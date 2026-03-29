-- CreateTable
CREATE TABLE "ExpenseBarRestock" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseBarRestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseBarRestockItem" (
    "id" TEXT NOT NULL,
    "restockId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostCents" INTEGER,
    "totalCostCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseBarRestockItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseBarRestock_expenseId_key" ON "ExpenseBarRestock"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseBarRestock_appliedAt_idx" ON "ExpenseBarRestock"("appliedAt");

-- CreateIndex
CREATE INDEX "ExpenseBarRestock_appliedByUserId_idx" ON "ExpenseBarRestock"("appliedByUserId");

-- CreateIndex
CREATE INDEX "ExpenseBarRestockItem_restockId_idx" ON "ExpenseBarRestockItem"("restockId");

-- CreateIndex
CREATE INDEX "ExpenseBarRestockItem_productId_idx" ON "ExpenseBarRestockItem"("productId");

-- AddForeignKey
ALTER TABLE "ExpenseBarRestock" ADD CONSTRAINT "ExpenseBarRestock_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBarRestock" ADD CONSTRAINT "ExpenseBarRestock_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBarRestockItem" ADD CONSTRAINT "ExpenseBarRestockItem_restockId_fkey" FOREIGN KEY ("restockId") REFERENCES "ExpenseBarRestock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseBarRestockItem" ADD CONSTRAINT "ExpenseBarRestockItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BarProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
