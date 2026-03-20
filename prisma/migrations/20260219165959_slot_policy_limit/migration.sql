-- CreateTable
CREATE TABLE "SlotPolicy" (
    "id" TEXT NOT NULL,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "openTime" TEXT NOT NULL DEFAULT '10:00',
    "closeTime" TEXT NOT NULL DEFAULT '19:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotLimit" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "maxUnits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlotLimit_category_key" ON "SlotLimit"("category");
