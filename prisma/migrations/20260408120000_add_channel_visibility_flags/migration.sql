ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "visibleInStore" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Channel"
  ADD COLUMN IF NOT EXISTS "visibleInBooth" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Channel"
SET "visibleInBooth" = true
WHERE lower("name") IN ('karim', 'nomad')
   OR lower("name") LIKE '%port olimpic%'
   OR lower("name") LIKE '%portolimpic%';
