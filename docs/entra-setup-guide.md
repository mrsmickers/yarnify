# Entra ID Setup Guide for Yarnify

This guide walks you through registering Yarnify with Microsoft Entra ID (Azure AD) in your **ingeniotech.co.uk** tenant.

## Prerequisites

- Global Administrator or Application Administrator role in the ingeniotech.co.uk tenant
- Your deployed application URL (or `http://localhost:3000` for local testing)

## Part 1: Register the Application

### 1.1 Navigate to Entra ID

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **Microsoft Entra ID** (or Azure Active Directory)
3. Select **App registrations** from the left menu
4. Click **+ New registration**

### 1.2 Configure Basic Settings

Fill in the registration form:

| Field | Value |
|-------|-------|
| **Name** | `Yarnify` (or `Yarnify Dev` for testing) |
| **Supported account types** | **Accounts in this organizational directory only (ingeniotech.co.uk only - Single tenant)** |
| **Redirect URI** | Select **Web** platform |

#### Redirect URI Configuration

For **local development**:
```
http://localhost:3000/api/v1/auth/callback
```

For **production** (replace with your actual domain):
```
https://yarnify.yourdomain.com/api/v1/auth/callback
```

> ⚠️ **Important**: The redirect URI must match exactly, including trailing slashes (or lack thereof). The auth service constructs this as `{FRONTEND_URL}/api/v1/auth/callback`.

Click **Register** to create the app.

### 1.3 Record Your Client ID and Tenant ID

After registration, you'll see the **Overview** page. Note these values:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - Save as: `ENTRA_CLIENT_ID`
  
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - Save as: `ENTRA_TENANT_ID`

## Part 2: Create a Client Secret

### 2.1 Generate the Secret

1. From your app registration, select **Certificates & secrets** in the left menu
2. Under **Client secrets**, click **+ New client secret**
3. Add a description: `Yarnify Production` or `Yarnify Dev`
4. Choose an expiration period:
   - **90 days (3 months)** - for testing
   - **12 months** - for dev environments
   - **24 months** - for production (set a calendar reminder to rotate before expiry)
5. Click **Add**

### 2.2 Copy the Secret Value

> ⚠️ **Critical**: The secret value is only shown **once**. Copy it immediately.

- **Value** (not Secret ID): `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Save as: `ENTRA_CLIENT_SECRET`

## Part 3: Configure API Permissions

### 3.1 Add Required Permissions

1. Select **API permissions** from the left menu
2. You should see `User.Read` already listed (added by default)
3. Click **+ Add a permission**
4. Select **Microsoft Graph**
5. Choose **Delegated permissions**
6. Search for and add:
   - `openid` (should be there by default)
   - `profile` (should be there by default)
   - `email` (optional, but recommended for user identification)
   - `offline_access` (required for refresh tokens)

### 3.2 Grant Admin Consent

After adding permissions:

1. Click **Grant admin consent for ingeniotech.co.uk**
2. Confirm by clicking **Yes**

You should see green checkmarks in the **Status** column for all permissions.

> ℹ️ **Why admin consent?** This allows all users in your tenant to use the app without individual consent prompts.

## Part 4: Configure Token Settings

### 4.1 Enable ID Tokens

1. Select **Authentication** from the left menu
2. Scroll to **Implicit grant and hybrid flows**
3. Check **ID tokens** (used for user authentication)
4. Click **Save** at the top

### 4.2 Optional: Configure App Roles (for RBAC)

If you want role-based access control:

1. Select **App roles** from the left menu
2. Click **+ Create app role**
3. Configure an admin role:
   - **Display name**: `Administrator`
   - **Allowed member types**: `Users/Groups`
   - **Value**: `admin` (this will appear in the `roles` claim)
   - **Description**: `Full administrative access to Yarnify`
   - **Enable this app role**: Checked
4. Click **Apply**

Repeat for additional roles (e.g., `user`, `viewer`).

> ℹ️ Assign roles to users via **Enterprise applications** → **Yarnify** → **Users and groups**.

## Part 5: Configure Environment Variables

Now populate your `.env` file in `apps/api/`:

```bash
# Entra ID Authentication
ENTRA_TENANT_ID=your-tenant-id-from-step-1.3
ENTRA_CLIENT_ID=your-client-id-from-step-1.3
ENTRA_CLIENT_SECRET=your-client-secret-from-step-2.2

# Optional: explicitly set the redirect URI (defaults to {FRONTEND_URL}/api/v1/auth/callback)
# AUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback

# Optional: customize scopes (defaults shown below)
# ENTRA_SCOPES=openid,profile,offline_access,email

# Optional: explicitly enforce tenant ID in tokens (defaults to ENTRA_TENANT_ID)
# ENTRA_EXPECTED_TENANT=your-tenant-id

# JWT Session Configuration
AUTH_JWT_SECRET=your-random-secure-secret-at-least-32-characters-long
AUTH_JWT_TTL_SECONDS=3600

# Frontend URL (required for redirect construction)
FRONTEND_URL=http://localhost:3000
```

### Generate a Secure JWT Secret

Use one of these methods:

```bash
# macOS/Linux
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Part 6: Test the Integration

### 6.1 Start the Application

```bash
# From project root
pnpm run dev
```

### 6.2 Test Authentication Flow

1. Navigate to: http://localhost:3000/api/v1/auth/login
2. You should be redirected to Microsoft login
3. Sign in with an `@ingeniotech.co.uk` account
4. After successful authentication, you'll be redirected to `/dashboard`
5. Visit http://localhost:3000/api/v1/auth/profile to see your user profile

### 6.3 Verify Cookies

In your browser DevTools → Application → Cookies → `http://localhost:3000`:

- `access_token`: Your JWT session token (httpOnly)
- `refresh_token`: Entra refresh token for renewing sessions (httpOnly)

## Part 7: Troubleshooting

### Error: "AADSTS50011: The redirect URI specified in the request does not match"

**Solution**: Ensure the redirect URI in Entra exactly matches what your app is using:
- Check `FRONTEND_URL` in your `.env`
- Verify in Entra: App registrations → Yarnify → Authentication → Redirect URIs

### Error: "AADSTS65001: The user or administrator has not consented"

**Solution**: Grant admin consent in the API permissions section (Part 3.2)

### Error: "Missing refresh token from identity provider"

**Solution**: 
1. Ensure `offline_access` is in your permissions
2. Admin consent has been granted
3. Check that `ENTRA_SCOPES` includes `offline_access` (or is unset to use defaults)

### Error: "Tenant mismatch" in logs

**Solution**: The user is from a different tenant. Ensure:
- You're signing in with an `@ingeniotech.co.uk` account
- `ENTRA_EXPECTED_TENANT` matches your tenant ID

### Logs show "No refresh token returned"

**Solution**: Check that ID tokens are enabled in Entra:
- App registrations → Yarnify → Authentication → Implicit grant → **ID tokens** (checked)

## Part 8: Production Deployment Checklist

Before deploying to Coolify:

- [ ] Register a **separate** Entra app for production (or add production redirect URI to existing app)
- [ ] Update redirect URI to use your production domain: `https://yarnify.yourdomain.com/api/v1/auth/callback`
- [ ] Generate a new `AUTH_JWT_SECRET` (never reuse dev secrets)
- [ ] Store all secrets in Coolify environment variables (never commit to git)
- [ ] Set `NODE_ENV=production` in Coolify
- [ ] Set client secret expiration reminder in your calendar (2 months before expiry)
- [ ] Configure HTTPS only - refresh tokens require secure connections in production
- [ ] Consider using certificate-based authentication instead of client secrets for enhanced security

## Part 9: Optional Enhancements

### 9.1 Microsoft Graph Integration (for user sync)

If you plan to implement the admin user management feature (see `refactor-todo.md`):

1. Add Microsoft Graph permissions:
   - `User.Read.All` (application permission - requires admin consent)
2. Grant admin consent
3. This allows syncing Entra users to your local database

### 9.2 Multi-Environment Setup

For dev/staging/prod:

| Environment | Recommendation |
|-------------|----------------|
| **Local Dev** | Single app registration shared by team |
| **Staging** | Dedicated app registration with test users |
| **Production** | Dedicated app registration with strict permissions |

### 9.3 Conditional Access Policies

Enhance security by requiring:
- Multi-factor authentication (MFA)
- Specific device compliance
- Geographic restrictions

Configure in: Entra ID → Security → Conditional Access

## Reference: Authentication Flow

```
User → /api/v1/auth/login
  ↓
Redirect to Microsoft Entra ID
  ↓
User authenticates (enters credentials, MFA, etc.)
  ↓
Microsoft redirects to /api/v1/auth/callback?code=xxx
  ↓
API exchanges code for tokens (ID token, access token, refresh token)
  ↓
API validates tenant, creates JWT session
  ↓
API sets cookies (access_token, refresh_token)
  ↓
Redirect to /dashboard
```

## Reference: Token Refresh Flow

```
Frontend → /api/v1/auth/refresh (with refresh_token cookie)
  ↓
API sends refresh_token to Microsoft Entra
  ↓
Entra validates and returns new tokens
  ↓
API creates new JWT session
  ↓
API sets new cookies
  ↓
Return success
```

## Support

If issues persist after following this guide:

1. Check API logs: `docker compose -f docker-compose.deps.yml logs -f`
2. Enable MSAL debug logging (already configured in auth.service.ts)
3. Verify Entra ID sign-in logs: Entra ID → Monitoring → Sign-in logs

---

**Last Updated**: November 3, 2025
**Author**: Yarnify Team
**Related Docs**: `docs/env-reference.md`, `docs/refactor-todo.md`, `docs/local-development.md`

