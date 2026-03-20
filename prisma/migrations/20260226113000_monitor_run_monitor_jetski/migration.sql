ALTER TABLE "MonitorRun"
ADD COLUMN IF NOT EXISTS "monitorJetskiId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MonitorRun_monitorJetskiId_fkey'
  ) THEN
    ALTER TABLE "MonitorRun"
    ADD CONSTRAINT "MonitorRun_monitorJetskiId_fkey"
    FOREIGN KEY ("monitorJetskiId") REFERENCES "Jetski"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MonitorRun_monitorJetskiId_status_idx"
ON "MonitorRun"("monitorJetskiId", "status");
