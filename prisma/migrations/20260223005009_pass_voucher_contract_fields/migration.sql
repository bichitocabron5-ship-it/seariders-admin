-- AlterTable
ALTER TABLE "PassVoucher" ADD COLUMN     "customerAddress" VARCHAR(250),
ADD COLUMN     "customerCountry" VARCHAR(2),
ADD COLUMN     "customerDocNumber" VARCHAR(80),
ADD COLUMN     "customerDocType" VARCHAR(40);
