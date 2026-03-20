-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "isPackParent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentReservationId" TEXT;

-- AlterTable
ALTER TABLE "ReservationItem" ADD COLUMN     "splitReservationId" TEXT;

-- CreateIndex
CREATE INDEX "Reservation_parentReservationId_idx" ON "Reservation"("parentReservationId");

-- CreateIndex
CREATE INDEX "Reservation_packId_idx" ON "Reservation"("packId");

-- CreateIndex
CREATE INDEX "ReservationItem_splitReservationId_idx" ON "ReservationItem"("splitReservationId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_parentReservationId_fkey" FOREIGN KEY ("parentReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
