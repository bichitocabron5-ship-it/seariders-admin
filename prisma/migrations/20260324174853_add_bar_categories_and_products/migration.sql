-- CreateEnum
CREATE TYPE "BarProductType" AS ENUM ('DRINK', 'FOOD', 'SNACK', 'MERCH', 'ICE', 'OTHER');

-- CreateTable
CREATE TABLE "BarCategory" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "BarProductType" NOT NULL DEFAULT 'OTHER',
    "sku" VARCHAR(60),
    "salePriceCents" INTEGER NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00,
    "controlsStock" BOOLEAN NOT NULL DEFAULT true,
    "currentStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitLabel" VARCHAR(30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BarCategory_isActive_sortOrder_idx" ON "BarCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BarCategory_name_key" ON "BarCategory"("name");

-- CreateIndex
CREATE INDEX "BarProduct_categoryId_isActive_idx" ON "BarProduct"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "BarProduct_type_isActive_idx" ON "BarProduct"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BarProduct_sku_key" ON "BarProduct"("sku");

-- AddForeignKey
ALTER TABLE "BarProduct" ADD CONSTRAINT "BarProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BarCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
