-- CreateEnum
CREATE TYPE "WorkArea" AS ENUM ('PLATFORM', 'BOOTH', 'STORE', 'BAR', 'MECHANICS', 'HR', 'ADMIN', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkLogStatus" AS ENUM ('OPEN', 'CLOSED', 'APPROVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "EmployeeRateType" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY', 'PER_SHIFT');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'CANCELED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "hireDate" TIMESTAMP(3),
ADD COLUMN     "terimnationDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER,
    "area" "WorkArea" NOT NULL DEFAULT 'OTHER',
    "status" "WorkLogStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRate" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "rateType" "EmployeeRateType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "amountCents" INTEGER NOT NULL,
    "concept" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkLog_employeeId_workDate_idx" ON "WorkLog"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "WorkLog_workDate_area_idx" ON "WorkLog"("workDate", "area");

-- CreateIndex
CREATE INDEX "WorkLog_status_workDate_idx" ON "WorkLog"("status", "workDate");

-- CreateIndex
CREATE INDEX "EmployeeRate_employeeId_effectiveFrom_idx" ON "EmployeeRate"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeRate_rateType_idx" ON "EmployeeRate"("rateType");

-- CreateIndex
CREATE INDEX "PayrollEntry_employeeId_periodStart_periodEnd_idx" ON "PayrollEntry"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayrollEntry_status_periodStart_idx" ON "PayrollEntry"("status", "periodStart");

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRate" ADD CONSTRAINT "EmployeeRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRate" ADD CONSTRAINT "EmployeeRate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
