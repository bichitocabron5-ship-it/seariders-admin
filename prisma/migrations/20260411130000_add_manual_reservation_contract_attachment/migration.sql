ALTER TABLE "Reservation"
ADD COLUMN "manualContractFileKey" TEXT,
ADD COLUMN "manualContractFileName" TEXT,
ADD COLUMN "manualContractFileUrl" TEXT,
ADD COLUMN "manualContractUploadedAt" TIMESTAMP(3),
ADD COLUMN "manualContractUploadedByUserId" TEXT;
