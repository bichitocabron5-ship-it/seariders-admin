-- CreateEnum
CREATE TYPE "MaintenanceEnventType" AS ENUM ('SERVICE', 'OIL_CHANGE', 'RAPAIR', 'INSPECTION', 'INCIDENT_REVIEW', 'HOUR_ADJUSTMENT');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isMotorized" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MaintenanceEvent" ADD COLUMN     "type" "MaintenanceEnventType" NOT NULL DEFAULT 'SERVICE';
