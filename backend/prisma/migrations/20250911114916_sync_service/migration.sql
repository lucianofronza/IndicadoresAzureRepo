-- CreateTable
CREATE TABLE "service_api_keys" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "service_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_api_keys_apiKey_key" ON "service_api_keys"("apiKey");
