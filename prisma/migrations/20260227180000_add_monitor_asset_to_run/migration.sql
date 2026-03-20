DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MonitorRun'
      AND column_name = 'Kind'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'MonitorRun'
      AND column_name = 'kind'
  ) THEN
    ALTER TABLE "MonitorRun" RENAME COLUMN "Kind" TO "kind";
  END IF;
END $$;

ALTER TABLE "MonitorRun"
ADD COLUMN IF NOT EXISTS "monitorAssetId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MonitorRun_monitorAssetId_fkey'
  ) THEN
    ALTER TABLE "MonitorRun"
    ADD CONSTRAINT "MonitorRun_monitorAssetId_fkey"
    FOREIGN KEY ("monitorAssetId") REFERENCES "Asset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MonitorRun_monitorAssetId_status_idx"
ON "MonitorRun"("monitorAssetId", "status");
