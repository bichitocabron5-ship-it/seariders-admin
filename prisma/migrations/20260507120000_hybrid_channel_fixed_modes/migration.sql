DO $$
BEGIN
  CREATE TYPE "CommercialValueMode" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "customerDiscountMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "customerDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerDiscountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promoterCommissionMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "promoterCommissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promoterCommissionCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ChannelCommissionRule"
  ADD COLUMN IF NOT EXISTS "promoterCommissionMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "promoterCommissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promoterCommissionCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "appliedCommissionMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "appliedCommissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "appliedCommissionCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerDiscountMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "customerDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerDiscountCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "appliedCommissionMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "appliedCommissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "appliedCommissionCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerDiscountMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN IF NOT EXISTS "customerDiscountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerDiscountCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "Channel"
SET "promoterCommissionValue" = COALESCE("commissionBps", 0) / 100.0
WHERE "promoterCommissionValue" = 0;

UPDATE "ChannelCommissionRule"
SET "promoterCommissionValue" = COALESCE("commissionPct", 0)
WHERE "promoterCommissionValue" = 0;

UPDATE "Reservation"
SET "appliedCommissionValue" = COALESCE("appliedCommissionPct", 0)
WHERE "appliedCommissionValue" = 0;

UPDATE "Payment"
SET "appliedCommissionValue" = COALESCE("appliedCommissionPct", 0)
WHERE "appliedCommissionValue" = 0;
