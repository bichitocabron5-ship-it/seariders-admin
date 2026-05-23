CREATE TABLE "ServiceAllowedChannel" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAllowedChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceAllowedChannel_serviceId_channelId_key" ON "ServiceAllowedChannel"("serviceId", "channelId");
CREATE INDEX "ServiceAllowedChannel_serviceId_idx" ON "ServiceAllowedChannel"("serviceId");
CREATE INDEX "ServiceAllowedChannel_channelId_idx" ON "ServiceAllowedChannel"("channelId");

ALTER TABLE "ServiceAllowedChannel"
  ADD CONSTRAINT "ServiceAllowedChannel_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceAllowedChannel"
  ADD CONSTRAINT "ServiceAllowedChannel_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
