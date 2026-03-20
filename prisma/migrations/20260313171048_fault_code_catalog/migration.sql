-- CreateEnum
CREATE TYPE "FaultCodeVerificationStatus" AS ENUM ('VERIFIED_OFFICIAL', 'VERIFIED_COMMUNITY', 'INTERNAL_OBSERVED', 'PENDING_VERIFY');

-- CreateTable
CREATE TABLE "FaultCodeCatalog" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'SEA_DOO',
    "code" TEXT NOT NULL,
    "system" TEXT,
    "titleEs" TEXT NOT NULL,
    "descriptionEs" TEXT,
    "likelyCausesEs" TEXT,
    "recommendedActionEs" TEXT,
    "severityHint" TEXT,
    "source" TEXT,
    "verificationStatus" "FaultCodeVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFY',
    "notesInternal" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaultCodeCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FaultCodeCatalog_code_idx" ON "FaultCodeCatalog"("code");

-- CreateIndex
CREATE INDEX "FaultCodeCatalog_brand_system_idx" ON "FaultCodeCatalog"("brand", "system");

-- CreateIndex
CREATE INDEX "FaultCodeCatalog_verificationStatus_idx" ON "FaultCodeCatalog"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FaultCodeCatalog_brand_code_key" ON "FaultCodeCatalog"("brand", "code");
