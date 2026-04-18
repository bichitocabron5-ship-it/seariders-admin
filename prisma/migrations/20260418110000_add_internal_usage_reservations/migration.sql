ALTER TABLE "Reservation"
ADD COLUMN "isInternalUsage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "employeeId" TEXT;

CREATE INDEX "Reservation_isInternalUsage_activityDate_idx"
ON "Reservation"("isInternalUsage", "activityDate");

CREATE INDEX "Reservation_employeeId_idx"
ON "Reservation"("employeeId");

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
