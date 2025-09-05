/*
  Warnings:

  - A unique constraint covering the columns `[azureAdId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "azureAdEmail" TEXT,
ADD COLUMN     "azureAdId" TEXT,
ADD COLUMN     "developerId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_azureAdId_key" ON "users"("azureAdId");
