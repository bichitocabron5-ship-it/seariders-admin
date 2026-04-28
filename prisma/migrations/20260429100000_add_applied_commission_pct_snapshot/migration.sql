ALTER TABLE "Reservation"
ADD COLUMN "appliedCommissionPct" DOUBLE PRECISION;

ALTER TABLE "Payment"
ADD COLUMN "appliedCommissionPct" DOUBLE PRECISION;
