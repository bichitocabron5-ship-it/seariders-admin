/*
  Warnings:

  - The values [OTHER] on the enum `EmployeeKind` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EmployeeKind_new" AS ENUM ('MONITOR', 'SKIPPER', 'SELLER', 'INTERN', 'MECHANIC', 'HR', 'SECURITY', 'ASSISTANT_MECHANIC', 'EXTRA');
ALTER TABLE "Employee" ALTER COLUMN "kind" TYPE "EmployeeKind_new" USING ("kind"::text::"EmployeeKind_new");
ALTER TYPE "EmployeeKind" RENAME TO "EmployeeKind_old";
ALTER TYPE "EmployeeKind_new" RENAME TO "EmployeeKind";
DROP TYPE "public"."EmployeeKind_old";
COMMIT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "jobTitle" TEXT;
