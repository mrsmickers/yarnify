# Authentication Notes

## Current Flow

- The API uses the Microsoft Authentication Library (`@azure/msal-node`) to
  redirect users to Entra (Azure AD) for sign-in.
- On callback the API exchanges the code for tokens, validates the tenant, and
  issues its own signed session JWT (HS256, key `AUTH_JWT_SECRET`).
- Entra refresh tokens are kept in an HTTP-only cookie so the API can renew the
  user's session transparently.
- `JwtStrategy` now validates only the API-issued tokens which keeps the runtime
  independent from external JWKS fetches and simplifies local development.

## Token Refresh

### Backend (`/api/v1/auth/refresh`)
- Endpoint accepts Entra refresh token from HTTP-only cookie
- Exchanges refresh token with Microsoft Entra for new tokens
- Issues new API JWT session token
- Updates both `access_token` and `refresh_token` cookies
- Returns success response with new access token

### Frontend (Automatic)
- **Proactive Refresh**: Token is automatically refreshed every 55 minutes
  (JWT expires after 60 minutes, giving a 5-minute buffer)
- **Reactive Refresh**: If a 401 error occurs, interceptor attempts token refresh
  before retrying the failed request
- **Visibility Refresh**: When user returns to the tab after being away, token
  is refreshed immediately to prevent expiration issues
- Users stay logged in indefinitely as long as:
  1. The tab remains open (proactive refresh keeps token alive)
  2. The Entra refresh token hasn't expired (typically 90 days)
  3. User returns to the tab before token expires (visibility handler)

## Gaps / Follow-up Work

1. **Administrator area:**
   - Implement UI & APIs to map Entra users (by object ID) to application roles.
   - Persist mappings in Postgres (new table) and expose services for
     authorization checks in feature modules.

2. **Token hardening:**
   - Consider rotating `AUTH_JWT_SECRET` via Coolify secrets management.
   - Optionally derive compact session payloads (e.g. include role claims from
     the mapping table).

3. **Entra configuration:**
   - Register the API as an App (with `AUTH_REDIRECT_URI`).
   - Ensure the app exposes an API scope if you plan to obtain resource access
     tokens for downstream services.
   - Grant `offline_access` so refresh works.

4. **Future enhancements:**
   - Integrate with Microsoft Graph to pull user metadata or group membership to
     support richer authorization scenarios.
   - Add sign-out URL that clears the Entra session if required for compliance.
