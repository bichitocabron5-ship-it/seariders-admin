-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExpensePaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'BIZUM', 'DIRECT_DEBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCostCenter" AS ENUM ('GENERAL', 'STORE', 'PLATFORM', 'BOOTH', 'HR', 'MECHANICS', 'OPERATIONS', 'MARKETING', 'PORT');

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactPerson" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "invoiceNumber" TEXT,
    "categoryId" TEXT NOT NULL,
    "vendorId" TEXT,
    "costCenter" "ExpenseCostCenter" NOT NULL DEFAULT 'GENERAL',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentMethod" "ExpensePaymentMethod",
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER,
    "totalCents" INTEGER,
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "maintenanceEventId" TEXT,
    "sparePartId" TEXT,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVendor_code_key" ON "ExpenseVendor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVendor_name_taxId_key" ON "ExpenseVendor"("name", "taxId");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_costCenter_idx" ON "Expense"("costCenter");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_vendorId_idx" ON "Expense"("vendorId");

-- CreateIndex
CREATE INDEX "Expense_maintenanceEventId_idx" ON "Expense"("maintenanceEventId");

-- CreateIndex
CREATE INDEX "Expense_sparePartId_idx" ON "Expense"("sparePartId");

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "ExpenseVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_maintenanceEventId_fkey" FOREIGN KEY ("maintenanceEventId") REFERENCES "MaintenanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_sparePartId_fkey" FOREIGN KEY ("sparePartId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
