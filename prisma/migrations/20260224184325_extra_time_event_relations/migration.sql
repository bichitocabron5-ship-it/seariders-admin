-- CreateEnum
CREATE TYPE "ExtraTimeStatus" AS ENUM ('PENDING', 'CHARGED', 'VOIDED');

-- CreateTable
CREATE TABLE "ExtraTimeEvent" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "jetskiId" TEXT NOT NULL,
    "serviceCode" VARCHAR(50) NOT NULL,
    "extraMinutes" INTEGER NOT NULL,
    "status" "ExtraTimeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "chargedAt" TIMESTAMP(3),
    "chargedByUserId" TEXT,

    CONSTRAINT "ExtraTimeEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "MonitorRunAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MonitorRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraTimeEvent" ADD CONSTRAINT "ExtraTimeEvent_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
