DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MonitorRunMode') THEN
    CREATE TYPE "MonitorRunMode" AS ENUM ('MONITOR', 'SOLO', 'TEST');
  END IF;
END
$$;

ALTER TABLE "MonitorRun"
  ADD COLUMN IF NOT EXISTS "mode" "MonitorRunMode" NOT NULL DEFAULT 'MONITOR';

ALTER TABLE "MonitorRun"
  ALTER COLUMN "monitorId" DROP NOT NULL;
