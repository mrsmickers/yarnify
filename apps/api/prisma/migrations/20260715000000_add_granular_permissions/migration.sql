-- Add granular permission system

-- Create permissions table
CREATE TABLE "permissions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("code")
);

-- Create role_permissions table
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- Create user_permission_overrides table
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionCode" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "permissions_category_idx" ON "permissions"("category");
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");
CREATE INDEX "user_permission_overrides_userId_idx" ON "user_permission_overrides"("userId");

-- Create unique constraints
CREATE UNIQUE INDEX "role_permissions_role_permissionCode_key" ON "role_permissions"("role", "permissionCode");
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionCode_key" ON "user_permission_overrides"("userId", "permissionCode");

-- Add foreign keys
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "entra_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionCode_fkey" FOREIGN KEY ("permissionCode") REFERENCES "permissions"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default permissions
INSERT INTO "permissions" ("code", "name", "category", "description", "sortOrder") VALUES
    ('dashboard.view', 'View Dashboard', 'dashboard', 'Access to the main dashboard', 0),
    ('calls.list', 'View Call List', 'calls', 'View all calls in the system', 0),
    ('calls.mine', 'View My Calls', 'calls', 'View own calls only', 1),
    ('calls.detail', 'View Call Details', 'calls', 'Access detailed call information', 2),
    ('admin.users', 'User Management', 'admin', 'Manage user accounts', 0),
    ('admin.agents', 'Agent Management', 'admin', 'Manage VoIP agents', 1),
    ('admin.prompts', 'Prompt Management', 'admin', 'Manage AI prompts', 2),
    ('admin.training', 'Training Rules', 'admin', 'Manage training rules', 3),
    ('admin.scoring', 'Scoring Configuration', 'admin', 'Configure scoring categories', 4),
    ('admin.alerts', 'Sentiment Alerts', 'admin', 'Configure sentiment alerts', 5),
    ('admin.company', 'Company Info', 'admin', 'Manage company information', 6),
    ('admin.permissions', 'Permission Management', 'admin', 'Manage roles and permissions', 7),
    ('admin.impersonate', 'Impersonate Users', 'admin', 'Impersonate other users', 8);

-- Seed role permissions for admin (all permissions)
INSERT INTO "role_permissions" ("id", "role", "permissionCode")
SELECT 
    'rp_admin_' || row_number() OVER (),
    'admin',
    code
FROM "permissions";

-- Seed role permissions for manager
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_manager_1', 'manager', 'dashboard.view'),
    ('rp_manager_2', 'manager', 'calls.list'),
    ('rp_manager_3', 'manager', 'calls.mine'),
    ('rp_manager_4', 'manager', 'calls.detail'),
    ('rp_manager_5', 'manager', 'admin.training'),
    ('rp_manager_6', 'manager', 'admin.alerts');

-- Seed role permissions for team_lead
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_teamlead_1', 'team_lead', 'dashboard.view'),
    ('rp_teamlead_2', 'team_lead', 'calls.list'),
    ('rp_teamlead_3', 'team_lead', 'calls.mine'),
    ('rp_teamlead_4', 'team_lead', 'calls.detail');

-- Seed role permissions for user
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_user_1', 'user', 'dashboard.view'),
    ('rp_user_2', 'user', 'calls.mine'),
    ('rp_user_3', 'user', 'calls.detail');
