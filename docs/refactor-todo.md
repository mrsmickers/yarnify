# Refactor To‑Dos & Next Steps

This document tracks the remaining work to finish the refactor away from Azure
and prepare the app for a smooth Coolify deployment.

## 1. Authentication & Authorization (Entra)

> 📖 **Setup Guides**:
> - Initial setup: [`docs/entra-setup-guide.md`](./entra-setup-guide.md)
> - Role-based access control: [`docs/rbac-setup-guide.md`](./rbac-setup-guide.md)
> - Quick reference: [`docs/entra-quick-reference.md`](./entra-quick-reference.md)

### Basic Authentication Setup
- [ ] Register the Entra app (single tenant) in **ingeniotech.co.uk** tenant:
  - [ ] Create app registration with redirect URI: `http://localhost:3000/api/v1/auth/callback` (dev) or `<coolify-domain>/api/v1/auth/callback` (prod)
  - [ ] Record Client ID, Tenant ID, and Client Secret
  - [ ] Configure API permissions: `openid`, `profile`, `offline_access`, `email`
  - [ ] Grant admin consent for all permissions
  - [ ] Enable ID tokens in Authentication settings
- [ ] Update `apps/api/.env` with Entra credentials and generate `AUTH_JWT_SECRET`
- [ ] Verify authentication flow locally:
  - [ ] Test login redirect to Microsoft
  - [ ] Verify successful callback and cookie setting
  - [ ] Check `/api/v1/auth/profile` returns user data
  - [ ] Test `/api/v1/auth/refresh` renews tokens
  - [ ] Confirm logout clears cookies

### Role-Based Access Control (RBAC)
- [ ] Configure App Roles in Entra ID:
  - [ ] Create "Administrator" role (value: `admin`)
  - [ ] Create "User" role (value: `user`)
  - [ ] Enable "Assignment required" in Enterprise Applications
- [ ] Assign roles to users:
  - [ ] Assign `simon@ingeniotech.co.uk` the Administrator role
  - [ ] Verify unauthorized users are blocked from logging in
- [ ] Run Prisma migration to create `entra_users` table:
  - [ ] `pnpm --filter api exec prisma migrate dev --name add_entra_users`
  - [ ] Verify user sync on login
- [ ] Test admin endpoints:
  - [ ] `/api/v1/admin/users` - list users (admin only)
  - [ ] `/api/v1/admin/stats` - system statistics (admin only)
  - [ ] Verify non-admin users get 403 Forbidden
- [ ] Frontend integration:
  - [ ] Create AuthContext with role checking
  - [ ] Implement ProtectedRoute component
  - [ ] Build admin user management UI
  - [ ] Add role-based navigation/menu items

## 2. Local File Storage

- [ ] Decide persistence path for production (Coolify volume), update
      `FILE_STORAGE_ROOT` accordingly.
- [ ] Add health check for read/write permissions on startup.
- [ ] Optional: implement retention/cleanup job for old recordings/transcripts.
- [ ] Confirm large-file streaming works end-to-end (range requests through the
      new service).

## 3. Operational Prep for Coolify

- [ ] Run `pnpm install` with network access to refresh dependencies.
- [ ] Validate `pnpm --filter api build` and `pnpm --filter frontend build`.
- [ ] Ensure Prisma migrations succeed against the managed Postgres instance you
      plan to attach.
- [ ] Define Coolify services:
  - Postgres (with pgvector extension)
  - Redis
  - API container (from `apps/api/Dockerfile`)
- [ ] Document secret names for Coolify (mirror `docs/env-reference.md`).

## 4. Developer Experience

- [ ] Implement admin UI scaffolding (React route, table of Entra users, role
      assignment flow).
- [ ] Add MSW or similar mocks for VOIP/ConnectWise when those credentials are
      absent.
- [ ] Review logging to ensure sensitive data is not persisted (especially
      token payloads).
- [ ] Expand unit/integration coverage around the new storage and auth modules.

## 5. Future Enhancements

- [ ] Consider moving long-running transcription/embedding tasks into
      dedicated worker containers for Coolify scaling.
- [ ] Evaluate storing processed transcripts in Postgres for easier querying
      (keep files as backup).
- [ ] Add audit logging to track who accessed recordings and when.
