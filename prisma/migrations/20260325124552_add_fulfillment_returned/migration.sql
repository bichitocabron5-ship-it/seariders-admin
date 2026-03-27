-- AlterEnum
ALTER TYPE "FulfillmentStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "FulfillmentTask" ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedByUserId" TEXT;

-- AlterTable
ALTER TABLE "FulfillmentTaskItem" ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "FulfillmentTask" ADD CONSTRAINT "FulfillmentTask_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
