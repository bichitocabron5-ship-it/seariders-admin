ALTER TABLE "Channel"
ADD COLUMN "allowsPromotions" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Channel"
SET "allowsPromotions" = true
WHERE UPPER("name") IN ('WEB', 'DIRECT', 'DIRECTO');

ALTER TYPE "DiscountKind" ADD VALUE IF NOT EXISTS 'FINAL_PRICE';
