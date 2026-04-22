-- Add employee linkage and snapshot fields for BAR staff sales pending settlement.
ALTER TABLE "BarSale"
ADD COLUMN "employeeId" TEXT,
ADD COLUMN "staffEmployeeNameSnap" TEXT;

CREATE INDEX "BarSale_employeeId_soldAt_idx" ON "BarSale"("employeeId", "soldAt");

ALTER TABLE "BarSale"
ADD CONSTRAINT "BarSale_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
