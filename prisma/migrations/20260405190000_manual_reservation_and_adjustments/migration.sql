ALTER TABLE "Reservation"
ADD COLUMN "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manualEntryNote" VARCHAR(500),
ADD COLUMN "manualEntryCreatedByUserId" TEXT,
ADD COLUMN "manualEntryCreatedAt" TIMESTAMP(3),
ADD COLUMN "financialAdjustmentNote" VARCHAR(500),
ADD COLUMN "financialAdjustedByUserId" TEXT,
ADD COLUMN "financialAdjustedAt" TIMESTAMP(3);

ALTER TYPE "OperationalOverrideAction" ADD VALUE IF NOT EXISTS 'MANUAL_RESERVATION_CREATE';
ALTER TYPE "OperationalOverrideAction" ADD VALUE IF NOT EXISTS 'RESERVATION_FINANCIAL_ADJUSTMENT';
