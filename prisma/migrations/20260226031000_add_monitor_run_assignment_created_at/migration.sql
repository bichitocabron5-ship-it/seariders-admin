ALTER TABLE "MonitorRunAssignment"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

UPDATE "MonitorRunAssignment"
SET "createdAt" = COALESCE("startedAt", NOW())
WHERE "createdAt" IS NULL;

ALTER TABLE "MonitorRunAssignment"
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "MonitorRunAssignment"
ALTER COLUMN "createdAt" SET NOT NULL;
