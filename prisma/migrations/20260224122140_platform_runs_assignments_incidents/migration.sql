/*
  Warnings:

  - Added the required column `activityDate` to the `MonitorRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MonitorRunStatus" AS ENUM ('READY', 'IN_SEA', 'CLOSED');

-- CreateEnum
CREATE TYPE "RunAssignmentStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('ACCIDENT', 'DAMAGE', 'MECHANICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "MonitorRun" ADD COLUMN     "activityDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "status" "MonitorRunStatus" NOT NULL DEFAULT 'READY';

-- CreateTable
CREATE TABLE "MonitorRunAssignment" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "jetskiId" TEXT NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "status" "RunAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedEndAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MonitorRunAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "reservationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "jetskiId" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "level" "IncidentLevel" NOT NULL,
    "notes" VARCHAR(800),
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitorRunAssignment_runId_status_idx" ON "MonitorRunAssignment"("runId", "status");

-- CreateIndex
CREATE INDEX "MonitorRunAssignment_reservationId_idx" ON "MonitorRunAssignment"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorRunAssignment_runId_jetskiId_key" ON "MonitorRunAssignment"("runId", "jetskiId");

-- CreateIndex
CREATE INDEX "Incident_runId_createdAt_idx" ON "Incident"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "Incident_jetskiId_isOpen_idx" ON "Incident"("jetskiId", "isOpen");

-- CreateIndex
CREATE INDEX "Incident_reservationId_idx" ON "Incident"("reservationId");

-- CreateIndex
CREATE INDEX "MonitorRun_activityDate_status_idx" ON "MonitorRun"("activityDate", "status");

-- CreateIndex
CREATE INDEX "MonitorRun_monitorId_status_idx" ON "MonitorRun"("monitorId", "status");

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MonitorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRunAssignment" ADD CONSTRAINT "MonitorRunAssignment_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MonitorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MonitorRunAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
