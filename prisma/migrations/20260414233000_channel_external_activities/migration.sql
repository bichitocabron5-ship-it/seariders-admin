ALTER TABLE "Channel"
ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "isExternalActivity" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Channel_kind_check'
  ) THEN
    ALTER TABLE "Channel"
    ADD CONSTRAINT "Channel_kind_check"
    CHECK ("kind" IN ('STANDARD', 'EXTERNAL_ACTIVITY'));
  END IF;
END $$;
