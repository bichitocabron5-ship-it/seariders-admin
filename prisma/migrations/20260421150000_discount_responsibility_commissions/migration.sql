CREATE TYPE "DiscountResponsibility" AS ENUM ('COMPANY', 'PROMOTER', 'SHARED');

ALTER TABLE "Channel"
  ADD COLUMN "discountResponsibility" "DiscountResponsibility" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "promoterDiscountShareBps" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Reservation"
  ADD COLUMN "commissionBaseCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountResponsibility" "DiscountResponsibility" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "promoterDiscountShareBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "promoterDiscountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "companyDiscountCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
  ADD COLUMN "commissionBaseCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "externalDiscountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountResponsibility" "DiscountResponsibility" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "promoterDiscountShareBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "promoterDiscountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "companyDiscountCents" INTEGER NOT NULL DEFAULT 0;
