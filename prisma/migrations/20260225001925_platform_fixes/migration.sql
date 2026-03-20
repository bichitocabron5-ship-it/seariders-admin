-- AlterTable
ALTER TABLE "ExtraTimeEvent" ADD COLUMN     "status" "ExtraTimeStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "MonitorRun" ADD COLUMN     "createdByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "MonitorRun" ADD CONSTRAINT "MonitorRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
