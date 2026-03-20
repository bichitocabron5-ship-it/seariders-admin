-- prisma/migrations/20260226_fix_run_assignment_drift/migration.sql

-- 1) status default => QUEUED
ALTER TABLE "MonitorRunAssignment"
  ALTER COLUMN "status" SET DEFAULT 'QUEUED'::"RunAssignmentStatus";

-- 2) startedAt nullable + sin default
ALTER TABLE "MonitorRunAssignment"
  ALTER COLUMN "startedAt" DROP NOT NULL;

ALTER TABLE "MonitorRunAssignment"
  ALTER COLUMN "startedAt" DROP DEFAULT;

-- 3) expectedEndAt nullable
ALTER TABLE "MonitorRunAssignment"
  ALTER COLUMN "expectedEndAt" DROP NOT NULL;