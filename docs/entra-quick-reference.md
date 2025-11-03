# Entra ID Quick Reference

## Values to Collect from Azure Portal

| What to Copy | Where to Find It | Environment Variable |
|--------------|------------------|---------------------|
| **Tenant ID** | App registrations → Yarnify → Overview → Directory (tenant) ID | `ENTRA_TENANT_ID` |
| **Client ID** | App registrations → Yarnify → Overview → Application (client) ID | `ENTRA_CLIENT_ID` |
| **Client Secret** | App registrations → Yarnify → Certificates & secrets → Client secrets → Value | `ENTRA_CLIENT_SECRET` |

## Required Checklist

In Azure Portal (https://portal.azure.com):

- [ ] **App Registration Created**
  - Name: `Yarnify` or `Yarnify Dev`
  - Single tenant (ingeniotech.co.uk only)
  
- [ ] **Redirect URI Added**
  - Platform: Web
  - URI: `http://localhost:3000/api/v1/auth/callback` (local)
  - URI: `https://your-domain.com/api/v1/auth/callback` (production)
  
- [ ] **API Permissions Configured**
  - [x] `openid` (delegated)
  - [x] `profile` (delegated)
  - [x] `offline_access` (delegated)
  - [x] `email` (delegated)
  - [x] Admin consent granted ✅
  
- [ ] **Authentication Settings**
  - [x] ID tokens enabled (under Implicit grant and hybrid flows)
  
- [ ] **Client Secret Created**
  - Expiry: 12-24 months
  - Value copied (only shown once!)

## Environment Variables Template

Add to `apps/api/.env`:

```bash
# ============================================
# ENTRA ID AUTHENTICATION
# ============================================
ENTRA_TENANT_ID=
ENTRA_CLIENT_ID=
ENTRA_CLIENT_SECRET=

# ============================================
# JWT SESSION CONFIGURATION
# ============================================
# Generate with: openssl rand -base64 32
AUTH_JWT_SECRET=

# Session lifetime (1 hour = 3600 seconds)
AUTH_JWT_TTL_SECONDS=3600

# ============================================
# APPLICATION URLs
# ============================================
FRONTEND_URL=http://localhost:3000
# AUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/callback  # Optional, defaults to {FRONTEND_URL}/api/v1/auth/callback
```

## Quick Test Commands

After configuration:

```bash
# Start the app
pnpm run dev

# Test login (should redirect to Microsoft)
open http://localhost:3000/api/v1/auth/login

# After logging in, check your profile
curl http://localhost:3000/api/v1/auth/profile \
  --cookie "access_token=YOUR_TOKEN_FROM_BROWSER"

# Or just visit in browser after login
open http://localhost:3000/api/v1/auth/profile
```

## Common Issues

| Error | Solution |
|-------|----------|
| "Redirect URI does not match" | Verify URI in Entra exactly matches `{FRONTEND_URL}/api/v1/auth/callback` |
| "User has not consented" | Grant admin consent in API permissions |
| "No refresh token returned" | Ensure `offline_access` in scopes and ID tokens enabled |
| "Tenant mismatch" | Sign in with `@ingeniotech.co.uk` account |
| "Unable to authenticate" | Check MSAL logs in terminal, verify all 3 Entra values are correct |

## Support

- **Full Guide**: `docs/entra-setup-guide.md`
- **Environment Reference**: `docs/env-reference.md`
- **API Logs**: Check terminal running `pnpm run dev`
- **Entra Sign-in Logs**: Azure Portal → Entra ID → Monitoring → Sign-in logs

