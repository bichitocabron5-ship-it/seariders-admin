-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'STORE', 'PLATFORM', 'BOOTH', 'BAR');

-- CreateEnum
CREATE TYPE "ShiftName" AS ENUM ('MORNING', 'AFTERNOON');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('STORE', 'BOOTH', 'WEB');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('SCHEDULED', 'WAITING', 'READY_FOR_PLATFORM', 'IN_SEA', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentOrigin" AS ENUM ('STORE', 'BOOTH', 'WEB', 'BAR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateEnum
CREATE TYPE "JetskiStatus" AS ENUM ('OPERATIONAL', 'DAMAGED', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "ShiftSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "shift" "ShiftName" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ShiftSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditLock" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiresPlatform" BOOLEAN NOT NULL DEFAULT false,
    "requiresJetski" BOOLEAN NOT NULL DEFAULT false,
    "requiresMonitor" BOOLEAN NOT NULL DEFAULT false,
    "isLicense" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceOption" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "paxMax" INTEGER NOT NULL,
    "contractedMinutes" INTEGER NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'WAITING',
    "activityDate" TIMESTAMP(3) NOT NULL,
    "scheduledTime" TIMESTAMP(3),
    "channelId" TEXT,
    "marketing" TEXT,
    "serviceId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "pax" INTEGER NOT NULL DEFAULT 1,
    "basePriceCents" INTEGER NOT NULL,
    "manualDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "totalPriceCents" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCountry" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerDocType" TEXT NOT NULL,
    "customerDocNumber" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "isLicense" BOOLEAN NOT NULL DEFAULT false,
    "licenseSchool" TEXT,
    "licenseType" TEXT,
    "licenseNumber" TEXT,
    "arrivedStoreAt" TIMESTAMP(3),
    "formalizedAt" TIMESTAMP(3),
    "formalizedByUserId" TEXT,
    "departureAt" TIMESTAMP(3),
    "arrivalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "origin" "PaymentOrigin" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "shiftSessionId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorRun" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MonitorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jetski" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "plate" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "owner" TEXT,
    "status" "JetskiStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "currentHours" DOUBLE PRECISION,
    "lastServiceHours" DOUBLE PRECISION,
    "serviceIntervalHours" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "serviceWarnHours" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jetski_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationJetski" (
    "reservationId" TEXT NOT NULL,
    "jetskiId" TEXT NOT NULL,

    CONSTRAINT "ReservationJetski_pkey" PRIMARY KEY ("reservationId","jetskiId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "ShiftSession_userId_startedAt_idx" ON "ShiftSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EditLock_resource_resourceId_key" ON "EditLock"("resource", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_name_key" ON "Channel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_key" ON "Service"("name");

-- CreateIndex
CREATE INDEX "ServiceOption_serviceId_idx" ON "ServiceOption"("serviceId");

-- CreateIndex
CREATE INDEX "Reservation_activityDate_status_idx" ON "Reservation"("activityDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_name_key" ON "Monitor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Jetski_number_key" ON "Jetski"("number");

-- CreateIndex
CREATE INDEX "ReservationJetski_jetskiId_idx" ON "ReservationJetski"("jetskiId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSession" ADD CONSTRAINT "ShiftSession_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditLock" ADD CONSTRAINT "EditLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRun" ADD CONSTRAINT "MonitorRun_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationJetski" ADD CONSTRAINT "ReservationJetski_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationJetski" ADD CONSTRAINT "ReservationJetski_jetskiId_fkey" FOREIGN KEY ("jetskiId") REFERENCES "Jetski"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
