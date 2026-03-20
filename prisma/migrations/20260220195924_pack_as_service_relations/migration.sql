/*
  Warnings:

  - A unique constraint covering the columns `[packOptionId]` on the table `Pack` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "packOptionId" TEXT,
ALTER COLUMN "serviceId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Pack_packOptionId_key" ON "Pack"("packOptionId");

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_packOptionId_fkey" FOREIGN KEY ("packOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
