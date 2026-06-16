-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('ALL', 'SELF', 'DEPT', 'DEPT_AND_CHILDREN', 'CUSTOM_DEPT');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "dataScope" "DataScope" NOT NULL DEFAULT 'SELF';

-- CreateTable
CREATE TABLE "RoleDataScopeDepartment" (
    "roleId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleDataScopeDepartment_pkey" PRIMARY KEY ("roleId","departmentId")
);

-- CreateIndex
CREATE INDEX "RoleDataScopeDepartment_departmentId_idx" ON "RoleDataScopeDepartment"("departmentId");

-- AddForeignKey
ALTER TABLE "RoleDataScopeDepartment" ADD CONSTRAINT "RoleDataScopeDepartment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleDataScopeDepartment" ADD CONSTRAINT "RoleDataScopeDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
