-- CreateEnum
CREATE TYPE "FulfillmentSource" AS ENUM ('STORE', 'BAR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('CATERING', 'EXTRA_DELIVERY');

-- CreateEnum
CREATE TYPE "FulfillmentArea" AS ENUM ('BAR', 'STORE', 'PLATFORM');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'DELIVERED', 'CANCELED');

-- CreateTable
CREATE TABLE "FulfillmentTask" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "source" "FulfillmentSource" NOT NULL DEFAULT 'STORE',
    "type" "FulfillmentType" NOT NULL,
    "area" "FulfillmentArea" NOT NULL DEFAULT 'BAR',
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(140) NOT NULL,
    "customerNameSnap" VARCHAR(120),
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAmountCents" INTEGER DEFAULT 0,
    "scheduledFor" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveredByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentTaskItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "barProductId" TEXT,
    "reservationItemId" TEXT,
    "kind" VARCHAR(30) NOT NULL,
    "nameSnap" VARCHAR(140) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentTask_reservationId_idx" ON "FulfillmentTask"("reservationId");

-- CreateIndex
CREATE INDEX "FulfillmentTask_area_status_scheduledFor_idx" ON "FulfillmentTask"("area", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "FulfillmentTask_type_status_idx" ON "FulfillmentTask"("type", "status");

-- CreateIndex
CREATE INDEX "FulfillmentTaskItem_taskId_idx" ON "FulfillmentTaskItem"("taskId");

-- CreateIndex
CREATE INDEX "FulfillmentTaskItem_barProductId_idx" ON "FulfillmentTaskItem"("barProductId");

-- CreateIndex
CREATE INDEX "FulfillmentTaskItem_reservationItemId_idx" ON "FulfillmentTaskItem"("reservationItemId");

-- AddForeignKey
ALTER TABLE "FulfillmentTask" ADD CONSTRAINT "FulfillmentTask_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentTask" ADD CONSTRAINT "FulfillmentTask_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentTaskItem" ADD CONSTRAINT "FulfillmentTaskItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "FulfillmentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentTaskItem" ADD CONSTRAINT "FulfillmentTaskItem_barProductId_fkey" FOREIGN KEY ("barProductId") REFERENCES "BarProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
