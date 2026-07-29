UPDATE "ReservationUnit" ru
SET "reservationItemId" = NULL
WHERE ru."reservationItemId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ReservationItem" ri
    WHERE ri."id" = ru."reservationItemId"
  );

CREATE INDEX "ReservationUnit_reservationItemId_idx"
ON "ReservationUnit"("reservationItemId");

CREATE INDEX "ReservationUnit_reservationId_reservationItemId_unitIndex_idx"
ON "ReservationUnit"("reservationId", "reservationItemId", "unitIndex");

ALTER TABLE "ReservationUnit"
ADD CONSTRAINT "ReservationUnit_reservationItemId_fkey"
FOREIGN KEY ("reservationItemId")
REFERENCES "ReservationItem"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
