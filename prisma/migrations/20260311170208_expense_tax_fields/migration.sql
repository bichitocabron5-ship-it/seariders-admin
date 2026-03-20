-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "hasInvoice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxRateBp" INTEGER;
