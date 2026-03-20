-- CreateTable
CREATE TABLE "ExpenseVendorCategory" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseVendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseVendorCategory_vendorId_idx" ON "ExpenseVendorCategory"("vendorId");

-- CreateIndex
CREATE INDEX "ExpenseVendorCategory_categoryId_idx" ON "ExpenseVendorCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVendorCategory_vendorId_categoryId_key" ON "ExpenseVendorCategory"("vendorId", "categoryId");

-- AddForeignKey
ALTER TABLE "ExpenseVendorCategory" ADD CONSTRAINT "ExpenseVendorCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ExpenseVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVendorCategory" ADD CONSTRAINT "ExpenseVendorCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
