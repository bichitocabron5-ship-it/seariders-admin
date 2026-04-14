DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ChannelKind'
  ) THEN
    CREATE TYPE "ChannelKind" AS ENUM ('STANDARD', 'EXTERNAL_ACTIVITY');
  END IF;
END $$;

ALTER TABLE "Channel"
  ALTER COLUMN "kind" DROP DEFAULT;

ALTER TABLE "Channel"
  DROP CONSTRAINT IF EXISTS "Channel_kind_check";

ALTER TABLE "Channel"
  ALTER COLUMN "kind" TYPE "ChannelKind"
  USING ("kind"::text::"ChannelKind");

ALTER TABLE "Channel"
  ALTER COLUMN "kind" SET DEFAULT 'STANDARD';
