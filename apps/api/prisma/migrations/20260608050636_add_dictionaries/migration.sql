-- CreateEnum
CREATE TYPE "DictionaryStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DictionaryBadgeVariant" AS ENUM ('DEFAULT', 'SUCCESS', 'WARNING', 'DANGER', 'NEUTRAL');

-- CreateTable
CREATE TABLE "DictionaryType" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "DictionaryStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictionaryItem" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "value" VARCHAR(120) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "DictionaryStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "badgeVariant" "DictionaryBadgeVariant",
    "metadata" JSONB,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryType_code_key" ON "DictionaryType"("code");

-- CreateIndex
CREATE INDEX "DictionaryItem_typeId_sortOrder_idx" ON "DictionaryItem"("typeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DictionaryItem_typeId_value_key" ON "DictionaryItem"("typeId", "value");

-- AddForeignKey
ALTER TABLE "DictionaryItem" ADD CONSTRAINT "DictionaryItem_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "DictionaryType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
