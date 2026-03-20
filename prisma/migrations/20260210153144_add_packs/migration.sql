-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "packId" TEXT;

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pricePerPersonCents" INTEGER NOT NULL,
    "minPax" INTEGER NOT NULL,
    "maxPax" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "allowedSources" "ReservationSource"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackItem" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "optionId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PackItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pack_code_key" ON "Pack"("code");

-- CreateIndex
CREATE INDEX "PackItem_packId_idx" ON "PackItem"("packId");

-- AddForeignKey
ALTER TABLE "PackItem" ADD CONSTRAINT "PackItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackItem" ADD CONSTRAINT "PackItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackItem" ADD CONSTRAINT "PackItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
