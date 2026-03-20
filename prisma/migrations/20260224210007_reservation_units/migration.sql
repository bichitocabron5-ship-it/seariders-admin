/*
  Warnings:

  - You are about to drop the column `chargedAt` on the `ExtraTimeEvent` table. All the data in the column will be lost.
  - You are about to drop the column `chargedByUserId` on the `ExtraTimeEvent` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `ExtraTimeEvent` table. All the data in the column will be lost.
  - Made the column `createdByUserId` on table `ExtraTimeEvent` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ReservationUnitStatus" AS ENUM ('READY_FOR_PLATFORM', 'IN_SEA', 'WAITING', 'COMPLETED', 'CANCELED');

-- DropForeignKey
ALTER TABLE "ExtraTimeEvent" DROP CONSTRAINT "ExtraTimeEvent_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "ExtraTimeEvent" DROP CONSTRAINT "ExtraTimeEvent_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "ExtraTimeEvent" DROP CONSTRAINT "ExtraTimeEvent_runId_fkey";

-- AlterTable
ALTER TABLE "ExtraTimeEvent" DROP COLUMN "chargedAt",
DROP COLUMN "chargedByUserId",
DROP COLUMN "status",
ADD COLUMN     "reservationUnitId" TEXT,
ALTER COLUMN "serviceCode" SET DATA TYPE TEXT,
ALTER COLUMN "createdByUserId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "reservationUnitId" TEXT;

-- AlterTable
ALTER TABLE "MonitorRunAssignment" ADD COLUMN     "reservationUnitId" TEXT;

-- CreateTable
CREATE TABLE "ReservationUnit" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "status" "ReservationUnitStatus" NOT NULL DEFAULT 'READY_FOR_PLATFORM',
    "jetskiId" TEXT,
    "driverName" VARCHAR(120),
    "driverPhone" VARCHAR(40),
    "driverEmail" VARCHAR(160),
    "driverCountry" VARCHAR(2),
    "driverAddress" VARCHAR(200),
    "driverDocType" VARCHAR(20),
    "driverDocNumber" VARCHAR(40),
    "driverBirthDate" TIMESTAMP(3),
    "minorAuthorizationProvided" BOOLEAN NOT NULL DEFAULT false,
    "minorNeedsAuthorization" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationUnit_reservationId_idx" ON "ReservationUnit"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationUnit_jetskiId_idx" ON "ReservationUnit"("jetskiId");

-- CreateIndex
CREATE INDEX "ReservationUnit_status_idx" ON "ReservationUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationUnit_reservationId_unitIndex_key" ON "ReservationUnit"("reservationId", "unitIndex");

-- CreateIndex
CREATE INDEX "ExtraTimeEvent_reservationId_idx" ON "ExtraTimeEvent"("reservationId");

-- CreateIndex
CREATE INDEX "ExtraTimeEvent_runId_idx" ON "ExtraTimeEvent"("runId");

-- CreateIndex
CREATE INDEX "ExtraTimeEvent_assignmentId_idx" ON "ExtraTimeEvent"("assignmentId");

-- CreateIndex
CREATE INDEX "ExtraTimeEvent_reservationUnitId_idx" ON "ExtraTimeEvent"("reservationUnitId");

-- CreateIndex
CREATE INDEX "MonitorRunAssignment_reservationUnitId_idx" ON "MonitorRunAssignment"("reservationUnitId");

-- AddForeignKey
ALTER TABLE "ReservationUnit" ADD CONSTRAINT "ReservationUnit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationUnit" ADD CONSTRAINT "ReservationUnit_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_reservationUnitId_fkey" FOREIGN KEY ("reservationUnitId") REFERENCES "ReservationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reservationUnitId_fkey" FOREIGN KEY ("reservationUnitId") REFERENCES "ReservationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MonitorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MonitorRunAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_reservationUnitId_fkey" FOREIGN KEY ("reservationUnitId") REFERENCES "ReservationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
