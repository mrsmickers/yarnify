-- Add ConnectWise push permission

-- Insert the new permission
INSERT INTO "permissions" ("code", "name", "category", "description", "sortOrder") VALUES
    ('connectwise.push', 'Push Notes to ConnectWise', 'integrations', 'Push call notes to ConnectWise tickets', 0);

-- Grant to admin role (admin already has all permissions via the previous migration pattern)
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_admin_cw_push', 'admin', 'connectwise.push');

-- Grant to manager role (they should be able to push notes too)
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_manager_cw_push', 'manager', 'connectwise.push');

-- Grant to team_lead role
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_teamlead_cw_push', 'team_lead', 'connectwise.push');

-- Grant to regular users (engineers need this to push their call notes)
INSERT INTO "role_permissions" ("id", "role", "permissionCode") VALUES
    ('rp_user_cw_push', 'user', 'connectwise.push');
