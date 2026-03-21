-- AlterTable
ALTER TABLE "ReservationContract" ADD COLUMN     "preparedAssetId" TEXT,
ADD COLUMN     "preparedJetskiId" TEXT;

-- CreateIndex
CREATE INDEX "ReservationContract_preparedJetskiId_idx" ON "ReservationContract"("preparedJetskiId");

-- CreateIndex
CREATE INDEX "ReservationContract_preparedAssetId_idx" ON "ReservationContract"("preparedAssetId");

-- AddForeignKey
ALTER TABLE "ReservationContract" ADD CONSTRAINT "ReservationContract_preparedJetskiId_fkey" FOREIGN KEY ("preparedJetskiId") REFERENCES "Jetski"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationContract" ADD CONSTRAINT "ReservationContract_preparedAssetId_fkey" FOREIGN KEY ("preparedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
