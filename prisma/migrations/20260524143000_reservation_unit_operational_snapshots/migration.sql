ALTER TABLE "ReservationUnit"
ADD COLUMN "reservationItemId" TEXT,
ADD COLUMN "serviceId" TEXT,
ADD COLUMN "optionId" TEXT,
ADD COLUMN "serviceCategory" TEXT,
ADD COLUMN "serviceName" VARCHAR(120),
ADD COLUMN "durationMinutesSnapshot" INTEGER,
ADD COLUMN "quantitySnapshot" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "paxSnapshot" INTEGER NOT NULL DEFAULT 1;
