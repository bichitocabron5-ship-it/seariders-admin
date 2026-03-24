-- AlterTable
ALTER TABLE "ReservationContract" ADD COLUMN     "imageConsentAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageConsentAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "imageConsentAcceptedBy" TEXT,
ADD COLUMN     "minorAuthorizationFileKey" TEXT,
ADD COLUMN     "minorAuthorizationFileName" TEXT,
ADD COLUMN     "minorAuthorizationFileUrl" TEXT,
ADD COLUMN     "minorAuthorizationUploadedAt" TIMESTAMP(3);
