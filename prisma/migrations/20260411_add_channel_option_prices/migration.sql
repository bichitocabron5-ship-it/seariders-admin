CREATE TABLE "ChannelOptionPrice" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannelOptionPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelOptionPrice_channelId_optionId_key" ON "ChannelOptionPrice"("channelId", "optionId");
CREATE INDEX "ChannelOptionPrice_channelId_idx" ON "ChannelOptionPrice"("channelId");
CREATE INDEX "ChannelOptionPrice_optionId_idx" ON "ChannelOptionPrice"("optionId");

ALTER TABLE "ChannelOptionPrice"
  ADD CONSTRAINT "ChannelOptionPrice_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannelOptionPrice"
  ADD CONSTRAINT "ChannelOptionPrice_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
