ALTER TABLE "Payment"
  ADD COLUMN "reversalOfPaymentId" TEXT;

CREATE INDEX "Payment_reversalOfPaymentId_idx" ON "Payment"("reversalOfPaymentId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_reversalOfPaymentId_fkey"
  FOREIGN KEY ("reversalOfPaymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
