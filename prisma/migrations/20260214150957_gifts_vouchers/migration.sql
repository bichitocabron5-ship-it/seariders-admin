-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'VOUCHER';

-- CreateTable
CREATE TABLE "GiftProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftVoucher" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "origin" "PaymentOrigin" NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldByUserId" TEXT,
    "soldPaymentId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "redeemedReservationId" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "GiftVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftProduct_isActive_idx" ON "GiftProduct"("isActive");

-- CreateIndex
CREATE INDEX "GiftProduct_serviceId_idx" ON "GiftProduct"("serviceId");

-- CreateIndex
CREATE INDEX "GiftProduct_optionId_idx" ON "GiftProduct"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftVoucher_code_key" ON "GiftVoucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GiftVoucher_soldPaymentId_key" ON "GiftVoucher"("soldPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftVoucher_redeemedReservationId_key" ON "GiftVoucher"("redeemedReservationId");

-- CreateIndex
CREATE INDEX "GiftVoucher_origin_soldAt_idx" ON "GiftVoucher"("origin", "soldAt");

-- CreateIndex
CREATE INDEX "GiftVoucher_redeemedAt_idx" ON "GiftVoucher"("redeemedAt");

-- CreateIndex
CREATE INDEX "GiftVoucher_productId_idx" ON "GiftVoucher"("productId");

-- AddForeignKey
ALTER TABLE "GiftProduct" ADD CONSTRAINT "GiftProduct_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftProduct" ADD CONSTRAINT "GiftProduct_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftVoucher" ADD CONSTRAINT "GiftVoucher_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GiftProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftVoucher" ADD CONSTRAINT "GiftVoucher_soldByUserId_fkey" FOREIGN KEY ("soldByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftVoucher" ADD CONSTRAINT "GiftVoucher_soldPaymentId_fkey" FOREIGN KEY ("soldPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftVoucher" ADD CONSTRAINT "GiftVoucher_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftVoucher" ADD CONSTRAINT "GiftVoucher_redeemedReservationId_fkey" FOREIGN KEY ("redeemedReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
