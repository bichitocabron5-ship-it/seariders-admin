DO $$
BEGIN
  CREATE TYPE "ChannelCommissionLineStatus" AS ENUM ('PENDING', 'PAID', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ChannelCommissionLine" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "reservationId" TEXT,
  "paymentId" TEXT,
  "sourceOrigin" "PaymentOrigin" NOT NULL,
  "serviceId" TEXT,
  "customerName" VARCHAR(160),
  "commissionBaseCents" INTEGER NOT NULL,
  "appliedCommissionMode" "CommercialValueMode" NOT NULL DEFAULT 'PERCENT',
  "appliedCommissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "appliedCommissionPct" DOUBLE PRECISION,
  "commissionCents" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "status" "ChannelCommissionLineStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paidByUserId" TEXT,
  "paymentMethod" "PaymentMethod",
  "notes" VARCHAR(800),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelCommissionLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelCommissionLine_paymentId_key"
  ON "ChannelCommissionLine"("paymentId");

CREATE UNIQUE INDEX IF NOT EXISTS "ChannelCommissionLine_reservationId_channelId_serviceId_key"
  ON "ChannelCommissionLine"("reservationId", "channelId", "serviceId");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_channelId_status_generatedAt_idx"
  ON "ChannelCommissionLine"("channelId", "status", "generatedAt");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_sourceOrigin_generatedAt_idx"
  ON "ChannelCommissionLine"("sourceOrigin", "generatedAt");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_serviceId_idx"
  ON "ChannelCommissionLine"("serviceId");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_reservationId_idx"
  ON "ChannelCommissionLine"("reservationId");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_paidAt_idx"
  ON "ChannelCommissionLine"("paidAt");

CREATE INDEX IF NOT EXISTS "ChannelCommissionLine_dueDate_idx"
  ON "ChannelCommissionLine"("dueDate");

DO $$
BEGIN
  ALTER TABLE "ChannelCommissionLine"
    ADD CONSTRAINT "ChannelCommissionLine_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ChannelCommissionLine"
    ADD CONSTRAINT "ChannelCommissionLine_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ChannelCommissionLine"
    ADD CONSTRAINT "ChannelCommissionLine_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ChannelCommissionLine"
    ADD CONSTRAINT "ChannelCommissionLine_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ChannelCommissionLine"
    ADD CONSTRAINT "ChannelCommissionLine_paidByUserId_fkey"
    FOREIGN KEY ("paidByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
