ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "visibleInWeb" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "visibleInStore" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "visibleInWeb" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ServiceOption"
  ADD COLUMN IF NOT EXISTS "visibleInWeb" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Service"
SET "visibleInStore" = false
WHERE lower(coalesce("code", '')) LIKE '%acompa%'
   OR lower(coalesce("name", '')) LIKE '%acompa%';

DO $$
DECLARE
  web_channel_id TEXT;
BEGIN
  SELECT "id"
  INTO web_channel_id
  FROM "Channel"
  WHERE "code" = 'WEB' OR upper("name") = 'WEB'
  ORDER BY CASE WHEN "code" = 'WEB' THEN 0 ELSE 1 END
  LIMIT 1;

  IF web_channel_id IS NULL THEN
    INSERT INTO "Channel" (
      "id",
      "name",
      "code",
      "kind",
      "commissionPct",
      "customerDiscountMode",
      "customerDiscountValue",
      "customerDiscountCents",
      "promoterCommissionMode",
      "promoterCommissionValue",
      "promoterCommissionCents",
      "discountResponsibility",
      "promoterDiscountShareBps",
      "isActive",
      "visibleInStore",
      "visibleInBooth",
      "visibleInWeb",
      "allowsPromotions",
      "commissionEnabled",
      "commissionBps",
      "commissionAppliesToDeposit"
    )
    VALUES (
      'channel_web_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      'WEB',
      'WEB',
      'STANDARD',
      0,
      'PERCENT',
      0,
      0,
      'PERCENT',
      0,
      0,
      'COMPANY',
      0,
      true,
      false,
      false,
      true,
      false,
      false,
      0,
      false
    );
  ELSE
    UPDATE "Channel"
    SET "code" = NULL
    WHERE "code" = 'WEB' AND "id" <> web_channel_id;

    UPDATE "Channel"
    SET
      "code" = 'WEB',
      "isActive" = true,
      "visibleInWeb" = true
    WHERE "id" = web_channel_id;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Channel_code_key" ON "Channel"("code");
