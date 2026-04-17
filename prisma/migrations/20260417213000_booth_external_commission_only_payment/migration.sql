ALTER TABLE "Payment"
  ADD COLUMN "isExternalCommissionOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "externalGrossAmountCents" INTEGER;
