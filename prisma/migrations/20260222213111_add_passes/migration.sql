-- AlterTable
ALTER TABLE "PassProduct" ADD COLUMN     "optionId" TEXT;

-- CreateIndex
CREATE INDEX "PassProduct_optionId_idx" ON "PassProduct"("optionId");

-- AddForeignKey
ALTER TABLE "PassProduct" ADD CONSTRAINT "PassProduct_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
