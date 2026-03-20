/*
  Warnings:

  - A unique constraint covering the columns `[serviceId]` on the table `Pack` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serviceId` to the `Pack` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "serviceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReservationItem" ADD COLUMN     "isPackParent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Pack_serviceId_key" ON "Pack"("serviceId");

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
