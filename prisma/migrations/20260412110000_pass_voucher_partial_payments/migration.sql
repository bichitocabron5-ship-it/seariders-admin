-- AlterTable
ALTER TABLE "PassVoucher" ADD COLUMN "salePriceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "passVoucherSaleId" TEXT;

-- Backfill legacy sold price from current product price
UPDATE "PassVoucher" pv
SET "salePriceCents" = pp."priceCents"
FROM "PassProduct" pp
WHERE pv."productId" = pp."id";

-- ForeignKey
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_passVoucherSaleId_fkey"
FOREIGN KEY ("passVoucherSaleId") REFERENCES "PassVoucher"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "Payment_passVoucherSaleId_createdAt_idx" ON "Payment"("passVoucherSaleId", "createdAt");
