/*
  Warnings:

  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "roleId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "user_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
