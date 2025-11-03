-- CreateTable
CREATE TABLE "entra_users" (
    "id" TEXT NOT NULL,
    "oid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entra_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entra_users_oid_key" ON "entra_users"("oid");

-- CreateIndex
CREATE UNIQUE INDEX "entra_users_email_key" ON "entra_users"("email");

-- CreateIndex
CREATE INDEX "entra_users_email_idx" ON "entra_users"("email");

-- CreateIndex
CREATE INDEX "entra_users_oid_idx" ON "entra_users"("oid");

-- CreateIndex
CREATE INDEX "entra_users_role_idx" ON "entra_users"("role");
