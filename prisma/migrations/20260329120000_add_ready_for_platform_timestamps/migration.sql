ALTER TABLE "Reservation"
ADD COLUMN "readyForPlatformAt" TIMESTAMP(3);

ALTER TABLE "ReservationUnit"
ADD COLUMN "readyForPlatformAt" TIMESTAMP(3);

-- Backfill conservador para filas que ya están actualmente en cola/listas para plataforma.
UPDATE "Reservation"
SET "readyForPlatformAt" = COALESCE("formalizedAt", "arrivedStoreAt", "createdAt")
WHERE "readyForPlatformAt" IS NULL
  AND "status" = 'READY_FOR_PLATFORM';

UPDATE "ReservationUnit" AS ru
SET "readyForPlatformAt" = COALESCE(r."readyForPlatformAt", ru."createdAt")
FROM "Reservation" AS r
WHERE r."id" = ru."reservationId"
  AND ru."readyForPlatformAt" IS NULL
  AND ru."status" = 'READY_FOR_PLATFORM';
