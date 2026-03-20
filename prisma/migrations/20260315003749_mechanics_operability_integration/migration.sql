/*
  Warnings:

  - The values [OUT] on the enum `AssetStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "PlatformOperabilityStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'DAMAGED', 'OUT_OF_SERVICE');

-- AlterEnum
BEGIN;
CREATE TYPE "AssetStatus_new" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'DAMAGED', 'OUT_OF_SERVICE');
ALTER TABLE "public"."Asset" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Asset" ALTER COLUMN "status" TYPE "AssetStatus_new" USING ("status"::text::"AssetStatus_new");
ALTER TYPE "AssetStatus" RENAME TO "AssetStatus_old";
ALTER TYPE "AssetStatus_new" RENAME TO "AssetStatus";
DROP TYPE "public"."AssetStatus_old";
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'OPERATIONAL';
COMMIT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "operabilityStatus" "PlatformOperabilityStatus" NOT NULL DEFAULT 'OPERATIONAL';

-- AlterTable
ALTER TABLE "Jetski" ADD COLUMN     "operabilityStatus" "PlatformOperabilityStatus" NOT NULL DEFAULT 'OPERATIONAL';

-- AlterTable
ALTER TABLE "MaintenanceEvent" ADD COLUMN     "affectsOperability" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "operabilityOnOpen" "PlatformOperabilityStatus",
ADD COLUMN     "operabilityOnResolved" "PlatformOperabilityStatus";
