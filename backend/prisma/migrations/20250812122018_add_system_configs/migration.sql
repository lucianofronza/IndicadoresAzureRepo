/*
  Warnings:

  - You are about to drop the column `authorDevId` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `body` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAt` on the `comments` table. All the data in the column will be lost.
  - You are about to drop the column `authorDevId` on the `commits` table. All the data in the column will be lost.
  - You are about to drop the column `committedAt` on the `commits` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `commits` table. All the data in the column will be lost.
  - You are about to drop the column `pullRequestId` on the `commits` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAt` on the `commits` table. All the data in the column will be lost.
  - You are about to drop the column `leadId` on the `developers` table. All the data in the column will be lost.
  - You are about to drop the column `managerId` on the `developers` table. All the data in the column will be lost.
  - You are about to drop the column `stackId` on the `developers` table. All the data in the column will be lost.
  - You are about to drop the column `authorDevId` on the `pull_requests` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `pull_requests` table. All the data in the column will be lost.
  - You are about to drop the column `firstReviewAt` on the `pull_requests` table. All the data in the column will be lost.
  - You are about to drop the column `reviewQueueDays` on the `pull_requests` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAt` on the `pull_requests` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `repositories` table. All the data in the column will be lost.
  - You are about to drop the column `clientSecretEncrypted` on the `repositories` table. All the data in the column will be lost.
  - You are about to drop the column `reviewerDevId` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `submittedAt` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAt` on the `reviews` table. All the data in the column will be lost.
  - You are about to drop the `pr_files_changed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sync_jobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[azureId]` on the table `comments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[azureId]` on the table `commits` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `developers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[azureId]` on the table `developers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[azureId]` on the table `pull_requests` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[url]` on the table `repositories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[azureId]` on the table `repositories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[azureId]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authorId` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `azureId` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `comments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `authorId` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `azureId` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdAt` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hash` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `repositoryId` to the `commits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `developers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `azureId` to the `pull_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `pull_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceBranch` to the `pull_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetBranch` to the `pull_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `azureId` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdAt` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reviewerId` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `reviews` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vote` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_authorDevId_fkey";

-- DropForeignKey
ALTER TABLE "commits" DROP CONSTRAINT "commits_authorDevId_fkey";

-- DropForeignKey
ALTER TABLE "commits" DROP CONSTRAINT "commits_pullRequestId_fkey";

-- DropForeignKey
ALTER TABLE "developers" DROP CONSTRAINT "developers_leadId_fkey";

-- DropForeignKey
ALTER TABLE "developers" DROP CONSTRAINT "developers_managerId_fkey";

-- DropForeignKey
ALTER TABLE "developers" DROP CONSTRAINT "developers_roleId_fkey";

-- DropForeignKey
ALTER TABLE "developers" DROP CONSTRAINT "developers_stackId_fkey";

-- DropForeignKey
ALTER TABLE "developers" DROP CONSTRAINT "developers_teamId_fkey";

-- DropForeignKey
ALTER TABLE "pr_files_changed" DROP CONSTRAINT "pr_files_changed_pullRequestId_fkey";

-- DropForeignKey
ALTER TABLE "pull_requests" DROP CONSTRAINT "pull_requests_authorDevId_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewerDevId_fkey";

-- DropForeignKey
ALTER TABLE "user_tokens" DROP CONSTRAINT "user_tokens_userId_fkey";

-- DropIndex
DROP INDEX "commits_pullRequestId_externalId_key";

-- DropIndex
DROP INDEX "pull_requests_repositoryId_externalId_key";

-- DropIndex
DROP INDEX "reviews_pullRequestId_reviewerDevId_key";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "authorDevId",
DROP COLUMN "body",
DROP COLUMN "syncedAt",
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "azureId" INTEGER NOT NULL,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "commits" DROP COLUMN "authorDevId",
DROP COLUMN "committedAt",
DROP COLUMN "externalId",
DROP COLUMN "pullRequestId",
DROP COLUMN "syncedAt",
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "azureId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "hash" TEXT NOT NULL,
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "repositoryId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "developers" DROP COLUMN "leadId",
DROP COLUMN "managerId",
DROP COLUMN "stackId",
ADD COLUMN     "azureId" TEXT,
ADD COLUMN     "email" TEXT NOT NULL,
ALTER COLUMN "teamId" DROP NOT NULL,
ALTER COLUMN "roleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pull_requests" DROP COLUMN "authorDevId",
DROP COLUMN "externalId",
DROP COLUMN "firstReviewAt",
DROP COLUMN "reviewQueueDays",
DROP COLUMN "syncedAt",
ADD COLUMN     "azureId" INTEGER NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "filesChanged" INTEGER,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadTimeDays" DOUBLE PRECISION,
ADD COLUMN     "linesAdded" INTEGER,
ADD COLUMN     "linesDeleted" INTEGER,
ADD COLUMN     "reviewTimeDays" DOUBLE PRECISION,
ADD COLUMN     "sourceBranch" TEXT NOT NULL,
ADD COLUMN     "targetBranch" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "repositories" DROP COLUMN "clientId",
DROP COLUMN "clientSecretEncrypted",
ADD COLUMN     "azureId" TEXT;

-- AlterTable
ALTER TABLE "reviews" DROP COLUMN "reviewerDevId",
DROP COLUMN "state",
DROP COLUMN "submittedAt",
DROP COLUMN "syncedAt",
ADD COLUMN     "azureId" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "reviewerId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vote" INTEGER NOT NULL;

-- DropTable
DROP TABLE "pr_files_changed";

-- DropTable
DROP TABLE "sync_jobs";

-- DropTable
DROP TABLE "user_tokens";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DeveloperToStack" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "_DeveloperToStack_AB_unique" ON "_DeveloperToStack"("A", "B");

-- CreateIndex
CREATE INDEX "_DeveloperToStack_B_index" ON "_DeveloperToStack"("B");

-- CreateIndex
CREATE UNIQUE INDEX "comments_azureId_key" ON "comments"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "commits_azureId_key" ON "commits"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "developers_email_key" ON "developers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "developers_azureId_key" ON "developers"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_azureId_key" ON "pull_requests"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_url_key" ON "repositories"("url");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_azureId_key" ON "repositories"("azureId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_azureId_key" ON "reviews"("azureId");

-- AddForeignKey
ALTER TABLE "developers" ADD CONSTRAINT "developers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developers" ADD CONSTRAINT "developers_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeveloperToStack" ADD CONSTRAINT "_DeveloperToStack_A_fkey" FOREIGN KEY ("A") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DeveloperToStack" ADD CONSTRAINT "_DeveloperToStack_B_fkey" FOREIGN KEY ("B") REFERENCES "stacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
