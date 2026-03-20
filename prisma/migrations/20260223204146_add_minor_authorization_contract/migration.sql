-- AlterTable
ALTER TABLE "ReservationContract" ADD COLUMN     "driverBirthDate" TIMESTAMP(3),
ADD COLUMN     "minorAuthorizationProvided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minorNeedsAuthorization" BOOLEAN NOT NULL DEFAULT false;
