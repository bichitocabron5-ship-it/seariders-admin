-- Link contracts to the reservation item that owns their contractual activity.
-- Legacy contracts remain nullable and keep the previous reservation-level fallback.
ALTER TABLE "ReservationContract"
ADD COLUMN "reservationItemId" TEXT;

ALTER TABLE "ReservationContract"
ADD CONSTRAINT "ReservationContract_reservationItemId_fkey"
FOREIGN KEY ("reservationItemId") REFERENCES "ReservationItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ReservationContract_reservationItemId_idx"
ON "ReservationContract"("reservationItemId");

CREATE INDEX "ReservationContract_reservationId_reservationItemId_logicalUnitIndex_idx"
ON "ReservationContract"("reservationId", "reservationItemId", "logicalUnitIndex");
