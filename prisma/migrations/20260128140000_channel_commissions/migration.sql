-- prisma/migrations/20260128140000_channel_commissions/migration.sql

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "commissionEnabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "commissionBps" integer NOT NULL DEFAULT 0;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "commissionAppliesToDeposit" boolean NOT NULL DEFAULT false;
