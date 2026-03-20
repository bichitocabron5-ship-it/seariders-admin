-- CreateTable
CREATE TABLE "CashClosure" (
    "id" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "origin" "PaymentOrigin" NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT NOT NULL,
    "computed" JSONB NOT NULL,
    "declared" JSONB,
    "diff" JSONB,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashClosure_origin_businessDate_idx" ON "CashClosure"("origin", "businessDate");

-- CreateIndex
CREATE INDEX "CashClosure_closedByUserId_idx" ON "CashClosure"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CashClosure_businessDate_origin_key" ON "CashClosure"("businessDate", "origin");

-- AddForeignKey
ALTER TABLE "CashClosure" ADD CONSTRAINT "CashClosure_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
