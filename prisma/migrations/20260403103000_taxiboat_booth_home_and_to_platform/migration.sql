ALTER TYPE "TaxiboatOperationStatus" ADD VALUE 'TO_PLATFORM';

ALTER TABLE "TaxiboatOperation"
ADD COLUMN "departedBoothAt" TIMESTAMP(3);

ALTER TABLE "TaxiboatOperation"
ALTER COLUMN "status" SET DEFAULT 'AT_BOOTH';

UPDATE "TaxiboatOperation"
SET "status" = 'AT_BOOTH',
    "arrivedBoothAt" = COALESCE("arrivedBoothAt", NOW())
WHERE "status" = 'AT_PLATFORM'
  AND "departedPlatformAt" IS NULL
  AND "arrivedPlatformAt" IS NOT NULL;
