-- Add the missing updatedAt column in a way that preserves existing Incident rows.
ALTER TABLE "Incident" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "Incident"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "Incident" ALTER COLUMN "updatedAt" SET NOT NULL;
