/*
  Warnings:

  - You are about to drop the column `userId` on the `Incident` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Incident" DROP CONSTRAINT "Incident_userId_fkey";

-- AlterTable
ALTER TABLE "Incident" DROP COLUMN "userId";

-- CreateIndex
CREATE INDEX "Incident_reservationUnitId_idx" ON "Incident"("reservationUnitId");

-- CreateIndex
CREATE INDEX "Incident_assignmentId_idx" ON "Incident"("assignmentId");

-- CreateIndex
CREATE INDEX "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");
