/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Service` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `ServiceOption` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[serviceId,durationMinutes,paxMax]` on the table `ServiceOption` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Service_name_key";

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "ServiceOption" ADD COLUMN     "code" TEXT;
-- Evitar duplicados en Service.code (si los hubiera)
WITH dup AS (
  SELECT "code"
  FROM "Service"
  WHERE "code" IS NOT NULL
  GROUP BY "code"
  HAVING COUNT(*) > 1
)
UPDATE "Service" s
SET "code" = CONCAT(s."code", '_', RIGHT(s."id", 6))
FROM dup
WHERE s."code" = dup."code";

-- Evitar duplicados en ServiceOption.code (si los hubiera)
WITH dup AS (
  SELECT "code"
  FROM "ServiceOption"
  WHERE "code" IS NOT NULL
  GROUP BY "code"
  HAVING COUNT(*) > 1
)
UPDATE "ServiceOption" o
SET "code" = CONCAT(o."code", '_', RIGHT(o."id", 6))
FROM dup
WHERE o."code" = dup."code";

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOption_code_key" ON "ServiceOption"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOption_serviceId_durationMinutes_paxMax_key" ON "ServiceOption"("serviceId", "durationMinutes", "paxMax");

-- Backfill Service.code usando name (slug simple)
UPDATE "Service"
SET "code" = UPPER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '_', 'g'))
WHERE "code" IS NULL;

-- Si quedara vacío (por nombres raros), fallback por id
UPDATE "Service"
SET "code" = CONCAT('SERVICE_', RIGHT("id", 8))
WHERE "code" IS NULL OR "code" = '';

-- Backfill ServiceOption.code basado en serviceCode + duración + pax
UPDATE "ServiceOption" so
SET "code" = CONCAT(
  COALESCE(s."code", CONCAT('SERVICE_', RIGHT(s."id", 8))),
  '_',
  so."durationMinutes",
  '_',
  so."paxMax"
)
FROM "Service" s
WHERE so."serviceId" = s."id"
  AND so."code" IS NULL;

UPDATE "ServiceOption"
SET "code" = CONCAT('OPT_', RIGHT("id", 10))
WHERE "code" IS NULL OR "code" = '';
