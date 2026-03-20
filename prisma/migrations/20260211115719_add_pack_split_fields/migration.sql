-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_splitReservationId_fkey" FOREIGN KEY ("splitReservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
