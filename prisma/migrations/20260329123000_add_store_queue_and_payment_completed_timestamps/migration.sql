ALTER TABLE "Reservation"
ADD COLUMN "storeQueueStartedAt" TIMESTAMP(3);

ALTER TABLE "Reservation"
ADD COLUMN "paymentCompletedAt" TIMESTAMP(3);

UPDATE "Reservation"
SET "storeQueueStartedAt" = COALESCE("arrivedStoreAt", "createdAt")
WHERE "storeQueueStartedAt" IS NULL
  AND (
    ("source" = 'BOOTH' AND "arrivedStoreAt" IS NOT NULL)
    OR ("source" = 'STORE' AND "activityDate" <= NOW())
  );

UPDATE "Reservation"
SET "paymentCompletedAt" = COALESCE("readyForPlatformAt", "formalizedAt", "createdAt")
WHERE "paymentCompletedAt" IS NULL
  AND "status" IN ('READY_FOR_PLATFORM', 'IN_SEA', 'COMPLETED');
