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
