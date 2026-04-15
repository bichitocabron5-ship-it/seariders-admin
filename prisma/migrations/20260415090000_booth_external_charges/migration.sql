ALTER TABLE "Payment"
  ADD COLUMN "serviceId" TEXT,
  ADD COLUMN "channelId" TEXT,
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "notes" VARCHAR(800);

CREATE INDEX "Payment_serviceId_idx" ON "Payment"("serviceId");
CREATE INDEX "Payment_channelId_idx" ON "Payment"("channelId");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
