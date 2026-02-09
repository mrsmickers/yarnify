-- CreateTable
CREATE TABLE "user_agent_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,

    CONSTRAINT "user_agent_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_agent_access_userId_idx" ON "user_agent_access"("userId");

-- CreateIndex
CREATE INDEX "user_agent_access_agentId_idx" ON "user_agent_access"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_agent_access_userId_agentId_key" ON "user_agent_access"("userId", "agentId");

-- AddForeignKey
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "entra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_agent_access" ADD CONSTRAINT "user_agent_access_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add permission for managing agent access
INSERT INTO "permissions" ("code", "name", "category", "description", "sortOrder", "createdAt")
VALUES ('admin.agent_access', 'Manage Agent Access', 'admin', 'Configure which users can see which agents'' calls', 60, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Grant permission to admin role
INSERT INTO "role_permissions" ("id", "role", "permissionCode", "createdAt")
SELECT gen_random_uuid()::text, 'admin', 'admin.agent_access', CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "role_permissions" WHERE "role" = 'admin' AND "permissionCode" = 'admin.agent_access'
);
