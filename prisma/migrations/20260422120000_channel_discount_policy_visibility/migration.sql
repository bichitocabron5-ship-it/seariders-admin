ALTER TABLE "Channel"
  ADD COLUMN "showDiscountPolicyInStore" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showDiscountPolicyInBooth" BOOLEAN NOT NULL DEFAULT true;
