ALTER TABLE "Reservation"
ADD COLUMN "customerPostalCode" VARCHAR(20),
ADD COLUMN "customerBirthDate" TIMESTAMP(3);

ALTER TABLE "ReservationContract"
ADD COLUMN "driverPostalCode" VARCHAR(20);
