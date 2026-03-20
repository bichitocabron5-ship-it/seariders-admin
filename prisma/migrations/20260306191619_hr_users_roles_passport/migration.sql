/*
  Warnings:

  - A unique constraint covering the columns `[employeeId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[passportCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmployeeKind" AS ENUM ('MONITOR', 'SKIPPER', 'SELLER', 'INTERN', 'MECHANIC', 'HR', 'OTHER');

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'HR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "passportCode" TEXT;

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "kind" "EmployeeKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_code_key" ON "Employee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_passportCode_key" ON "User"("passportCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
