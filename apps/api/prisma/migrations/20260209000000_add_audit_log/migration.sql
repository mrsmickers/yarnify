-- Add audit_logs table for compliance and security
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetName" TEXT,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient querying
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");

-- Add foreign key to EntraUser
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "entra_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add audit permission
INSERT INTO "permissions" ("code", "name", "category", "description", "sortOrder") VALUES
    ('admin.audit', 'View Audit Log', 'admin', 'Access the audit trail of user actions', 9);

-- Grant audit permission to admin role
INSERT INTO "role_permissions" ("id", "role", "permissionCode") 
VALUES ('rp_admin_audit', 'admin', 'admin.audit');
