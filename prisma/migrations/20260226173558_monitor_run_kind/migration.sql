-- CreateEnum
CREATE TYPE "MonitorRunKind" AS ENUM ('JETSKI', 'NAUTICA');

-- AlterTable
ALTER TABLE "MonitorRun" ADD COLUMN     "Kind" "MonitorRunKind" NOT NULL DEFAULT 'JETSKI';
