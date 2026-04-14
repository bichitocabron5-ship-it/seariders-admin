ALTER TABLE "ReservationContract"
ADD COLUMN "logicalUnitIndex" INTEGER,
ADD COLUMN "supersededAt" TIMESTAMP(3);

UPDATE "ReservationContract"
SET "logicalUnitIndex" = "unitIndex"
WHERE "logicalUnitIndex" IS NULL;

CREATE INDEX "ReservationContract_reservationId_logicalUnitIndex_idx"
ON "ReservationContract"("reservationId", "logicalUnitIndex");
