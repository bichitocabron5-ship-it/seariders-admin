/*
  Warnings:

  - You are about to drop the column `employeeId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_employeeId_fkey";

-- DropIndex
DROP INDEX "User_employeeId_key";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "internshipEndDate" TIMESTAMP(3),
ADD COLUMN     "internshipHoursTotal" INTEGER,
ADD COLUMN     "internshipHoursUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "internshipStartDate" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "employeeId";

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
