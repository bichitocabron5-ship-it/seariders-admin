-- AlterTable
ALTER TABLE "ReservationContract" ADD COLUMN     "renderedHtml" TEXT,
ADD COLUMN     "renderedPdfUrl" TEXT,
ADD COLUMN     "signatureAuditJson" JSONB,
ADD COLUMN     "signaturePayloadJson" JSONB,
ADD COLUMN     "signatureRequestId" TEXT,
ADD COLUMN     "signatureSignedPdfUrl" TEXT,
ADD COLUMN     "signatureStatusRaw" TEXT,
ADD COLUMN     "templateCode" TEXT,
ADD COLUMN     "templateVersion" TEXT;
