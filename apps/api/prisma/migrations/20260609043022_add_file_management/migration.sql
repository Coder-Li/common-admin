-- CreateEnum
CREATE TYPE "FileStorageDriver" AS ENUM ('LOCAL');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE');

-- CreateTable
CREATE TABLE "ManagedFile" (
    "id" TEXT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "extension" VARCHAR(32),
    "size" BIGINT NOT NULL,
    "storageDriver" "FileStorageDriver" NOT NULL DEFAULT 'LOCAL',
    "bucket" VARCHAR(120),
    "objectKey" VARCHAR(500) NOT NULL,
    "checksum" VARCHAR(128),
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "description" VARCHAR(500),
    "metadata" JSONB,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ManagedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedFile_createdAt_idx" ON "ManagedFile"("createdAt");

-- CreateIndex
CREATE INDEX "ManagedFile_mimeType_idx" ON "ManagedFile"("mimeType");

-- CreateIndex
CREATE INDEX "ManagedFile_storageDriver_idx" ON "ManagedFile"("storageDriver");

-- CreateIndex
CREATE INDEX "ManagedFile_uploadedById_idx" ON "ManagedFile"("uploadedById");

-- CreateIndex
CREATE INDEX "ManagedFile_deletedAt_idx" ON "ManagedFile"("deletedAt");

-- AddForeignKey
ALTER TABLE "ManagedFile" ADD CONSTRAINT "ManagedFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
