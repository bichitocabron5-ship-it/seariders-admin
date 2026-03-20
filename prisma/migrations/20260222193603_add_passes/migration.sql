-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "passVoucherId" TEXT;

-- CreateTable
CREATE TABLE "PassProduct" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceId" TEXT NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "origin" "PaymentOrigin" NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buyerName" VARCHAR(120),
    "buyerPhone" VARCHAR(40),
    "buyerEmail" VARCHAR(160),
    "soldByUserId" TEXT,
    "soldPaymentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "minutesTotal" INTEGER NOT NULL,
    "minutesRemaining" INTEGER NOT NULL,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "PassVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassConsume" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedByUserId" TEXT,
    "minutesUsed" INTEGER NOT NULL,
    "serviceId" TEXT NOT NULL,
    "optionId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pax" INTEGER NOT NULL DEFAULT 1,
    "reservationId" TEXT,

    CONSTRAINT "PassConsume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PassProduct_code_key" ON "PassProduct"("code");

-- CreateIndex
CREATE INDEX "PassProduct_isActive_idx" ON "PassProduct"("isActive");

-- CreateIndex
CREATE INDEX "PassProduct_serviceId_idx" ON "PassProduct"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "PassVoucher_code_key" ON "PassVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PassVoucher_soldPaymentId_key" ON "PassVoucher"("soldPaymentId");

-- CreateIndex
CREATE INDEX "PassVoucher_origin_soldAt_idx" ON "PassVoucher"("origin", "soldAt");

-- CreateIndex
CREATE INDEX "PassVoucher_expiresAt_idx" ON "PassVoucher"("expiresAt");

-- CreateIndex
CREATE INDEX "PassVoucher_productId_idx" ON "PassVoucher"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PassConsume_reservationId_key" ON "PassConsume"("reservationId");

-- CreateIndex
CREATE INDEX "PassConsume_voucherId_consumedAt_idx" ON "PassConsume"("voucherId", "consumedAt");

-- CreateIndex
CREATE INDEX "PassConsume_consumedAt_idx" ON "PassConsume"("consumedAt");

-- CreateIndex
CREATE INDEX "PassConsume_serviceId_idx" ON "PassConsume"("serviceId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_passVoucherId_fkey" FOREIGN KEY ("passVoucherId") REFERENCES "PassVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassProduct" ADD CONSTRAINT "PassProduct_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassVoucher" ADD CONSTRAINT "PassVoucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PassProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassVoucher" ADD CONSTRAINT "PassVoucher_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassVoucher" ADD CONSTRAINT "PassVoucher_soldPaymentId_fkey" FOREIGN KEY ("soldPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassConsume" ADD CONSTRAINT "PassConsume_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "PassVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassConsume" ADD CONSTRAINT "PassConsume_consumedByUserId_fkey" FOREIGN KEY ("consumedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassConsume" ADD CONSTRAINT "PassConsume_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
