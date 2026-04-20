-- CreateTable
CREATE TABLE "PassNotification" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "consumeId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "messagePreview" TEXT,
    "portalUrl" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PassNotification_voucherId_createdAt_idx" ON "PassNotification"("voucherId", "createdAt");

-- CreateIndex
CREATE INDEX "PassNotification_consumeId_idx" ON "PassNotification"("consumeId");

-- CreateIndex
CREATE INDEX "PassNotification_status_createdAt_idx" ON "PassNotification"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PassNotification" ADD CONSTRAINT "PassNotification_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "PassVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassNotification" ADD CONSTRAINT "PassNotification_consumeId_fkey" FOREIGN KEY ("consumeId") REFERENCES "PassConsume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
