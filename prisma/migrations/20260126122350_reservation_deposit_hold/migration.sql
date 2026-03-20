-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "depositHeld" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositHeldAt" TIMESTAMP(3),
ADD COLUMN     "depositHeldByUserId" TEXT,
ADD COLUMN     "depositHoldReason" TEXT;
