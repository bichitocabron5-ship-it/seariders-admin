-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('IN', 'OUT');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "direction" "PaymentDirection" NOT NULL DEFAULT 'IN';
