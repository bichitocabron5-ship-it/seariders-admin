CREATE TYPE "AssetMaintenanceProfile" AS ENUM ('OPERATIONAL', 'MAINTENANCE_ONLY');
CREATE TYPE "AssetMeterType" AS ENUM ('HOURS', 'NONE');

ALTER TABLE "Asset"
ADD COLUMN "maintenanceProfile" "AssetMaintenanceProfile" NOT NULL DEFAULT 'OPERATIONAL',
ADD COLUMN "meterType" "AssetMeterType" NOT NULL DEFAULT 'HOURS';

ALTER TABLE "MaintenanceEvent"
ALTER COLUMN "hoursAtService" DROP NOT NULL;

UPDATE "Asset"
SET
  "maintenanceProfile" = 'MAINTENANCE_ONLY',
  "meterType" = 'NONE',
  "platformUsage" = 'HIDDEN',
  "currentHours" = NULL,
  "lastServiceHours" = NULL
WHERE
  UPPER(COALESCE("code", '')) IN ('BUGGY', 'FURGONETA')
  OR UPPER(COALESCE("name", '')) IN ('BUGGY', 'FURGONETA');
