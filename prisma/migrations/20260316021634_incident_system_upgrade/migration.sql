-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "title" TEXT,
ADD COLUMN     "visibleInMechanics" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visibleInPlatform" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visibleInStore" BOOLEAN NOT NULL DEFAULT true;
