/*
  Warnings:

  - The `type` column on the `MaintenanceEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MaintenanceEventType" AS ENUM ('SERVICE', 'OIL_CHANGE', 'REPAIR', 'INSPECTION', 'INCIDENT_REVIEW', 'HOUR_ADJUSTMENT');

-- AlterTable
ALTER TABLE "MaintenanceEvent" DROP COLUMN "type",
ADD COLUMN     "type" "MaintenanceEventType" NOT NULL DEFAULT 'SERVICE';

-- DropEnum
DROP TYPE "MaintenanceEnventType";
