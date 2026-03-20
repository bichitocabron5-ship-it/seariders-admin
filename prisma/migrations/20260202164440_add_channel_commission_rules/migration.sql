-- CreateTable
CREATE TABLE "ChannelCommissionRule" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "commissionPct" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelCommissionRule_channelId_idx" ON "ChannelCommissionRule"("channelId");

-- CreateIndex
CREATE INDEX "ChannelCommissionRule_serviceId_idx" ON "ChannelCommissionRule"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCommissionRule_channelId_serviceId_key" ON "ChannelCommissionRule"("channelId", "serviceId");

-- AddForeignKey
ALTER TABLE "ChannelCommissionRule" ADD CONSTRAINT "ChannelCommissionRule_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCommissionRule" ADD CONSTRAINT "ChannelCommissionRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
