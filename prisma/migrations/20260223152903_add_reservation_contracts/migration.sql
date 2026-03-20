-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'READY', 'SIGNED', 'VOID');

-- CreateTable
CREATE TABLE "ReservationContract" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "driverName" VARCHAR(120),
    "driverPhone" VARCHAR(40),
    "driverEmail" VARCHAR(160),
    "driverCountry" VARCHAR(2),
    "driverAddress" VARCHAR(200),
    "driverDocType" VARCHAR(20),
    "driverDocNumber" VARCHAR(40),
    "licenseSchool" VARCHAR(120),
    "licenseType" VARCHAR(40),
    "licenseNumber" VARCHAR(40),
    "signedAt" TIMESTAMP(3),
    "signatureProvider" VARCHAR(40),
    "signatureEnvelopeId" VARCHAR(120),
    "signatureUrl" VARCHAR(400),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationContract_reservationId_idx" ON "ReservationContract"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationContract_status_idx" ON "ReservationContract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationContract_reservationId_unitIndex_key" ON "ReservationContract"("reservationId", "unitIndex");

-- AddForeignKey
ALTER TABLE "ReservationContract" ADD CONSTRAINT "ReservationContract_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
