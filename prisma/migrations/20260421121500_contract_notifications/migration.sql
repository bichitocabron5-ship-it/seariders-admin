CREATE TABLE "ContractNotification" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "provider" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "messagePreview" TEXT,
    "linkUrl" TEXT,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractNotification_contractId_createdAt_idx" ON "ContractNotification"("contractId", "createdAt");
CREATE INDEX "ContractNotification_status_createdAt_idx" ON "ContractNotification"("status", "createdAt");

ALTER TABLE "ContractNotification" ADD CONSTRAINT "ContractNotification_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "ReservationContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
