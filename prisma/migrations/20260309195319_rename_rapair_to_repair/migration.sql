/*
  Warnings:

  - The values [RAPAIR] on the enum `MaintenanceEnventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MaintenanceEnventType_new" AS ENUM ('SERVICE', 'OIL_CHANGE', 'REPAIR', 'INSPECTION', 'INCIDENT_REVIEW', 'HOUR_ADJUSTMENT');
ALTER TABLE "public"."MaintenanceEvent" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "MaintenanceEvent" ALTER COLUMN "type" TYPE "MaintenanceEnventType_new" USING ("type"::text::"MaintenanceEnventType_new");
ALTER TYPE "MaintenanceEnventType" RENAME TO "MaintenanceEnventType_old";
ALTER TYPE "MaintenanceEnventType_new" RENAME TO "MaintenanceEnventType";
DROP TYPE "public"."MaintenanceEnventType_old";
ALTER TABLE "MaintenanceEvent" ALTER COLUMN "type" SET DEFAULT 'SERVICE';
COMMIT;
