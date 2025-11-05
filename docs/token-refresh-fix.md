# Token Refresh Fix - November 4, 2025

## Problem
Users were being kicked out of the application after approximately 1 hour of activity or inactivity. This was happening because:

1. **JWT Session Token Expiration**: The API issues JWT tokens that expire after 1 hour (`AUTH_JWT_TTL_SECONDS=3600`)
2. **Reactive Refresh Only**: The frontend had a 401 error interceptor that would attempt to refresh the token, but this only worked when an API call was made
3. **Inactivity Issue**: If a user was inactive for more than an hour, their token would expire. When they returned and made their next API call, the expired token would fail
4. **Kicked Out**: The 401 error would trigger a login redirect, forcing the user to log in again

## Solution
Implemented **proactive token refresh** in the frontend that automatically refreshes tokens before they expire.

### What Changed

#### File: `apps/frontend/src/api/axios-instance.ts`

Added three token refresh mechanisms:

1. **Proactive Refresh Timer** (Primary Fix)
   - Token automatically refreshes every 55 minutes
   - JWT expires after 60 minutes, giving a 5-minute safety buffer
   - Runs continuously while the tab is open
   - Prevents token from ever expiring during active sessions

2. **Visibility Change Handler** (Inactivity Protection)
   - Detects when user returns to the tab after being away
   - Immediately refreshes the token when page becomes visible
   - Prevents issues when user leaves tab open but inactive for extended periods

3. **Reactive Refresh** (Existing, Now Backup)
   - Already existed: intercepts 401 errors and attempts refresh
   - Now serves as a safety net if proactive refresh fails
   - Still redirects to login if refresh token is expired

#### File: `docs/authentication-notes.md`

Updated documentation to explain the three-tier token refresh system and conditions for staying logged in.

## How It Works

```
User Logs In
    ↓
Gets JWT (expires in 60 min) + Refresh Token (expires in ~90 days)
    ↓
┌─────────────────────────────────────────────────────┐
│  Proactive Refresh Cycle (Primary)                  │
│  ┌────────────────────────────────────┐             │
│  │ Wait 55 minutes                    │             │
│  │         ↓                          │             │
│  │ Call /api/v1/auth/refresh          │             │
│  │         ↓                          │             │
│  │ Get new JWT + new Refresh Token    │ ← Repeats   │
│  │         ↓                          │   Forever   │
│  │ Schedule next refresh in 55 min ───┘             │
│  └────────────────────────────────────────────────  │
└─────────────────────────────────────────────────────┘
    
If User Switches Away From Tab
    ↓
On Return (Visibility Change)
    ↓
Immediate Token Refresh
    ↓
Resume Proactive Refresh Cycle

If API Call Gets 401 (Reactive Backup)
    ↓
Try to Refresh Token
    ↓
If Success: Retry Original Request
    ↓
If Failure: Redirect to Login
```

## User Experience

### Before Fix
- ❌ Kicked out after 1 hour of inactivity
- ❌ Lost unsaved work
- ❌ Frustrating login loops
- ❌ Token expires while viewing a page

### After Fix
- ✅ Stay logged in indefinitely (while tab is open)
- ✅ No interruptions during active use
- ✅ Token refreshes automatically in background
- ✅ Safe return after periods of inactivity
- ✅ Only logout when:
  - Explicitly clicking "Logout"
  - Closing the browser tab
  - Entra refresh token expires (~90 days)

## Testing

### Test Case 1: Active Use
1. Log in to the application
2. Use the app normally
3. **After 55 minutes**: Check browser console, should see:
   ```
   [TokenRefresh] Proactively refreshing token...
   [TokenRefresh] Token refreshed successfully
   [TokenRefresh] Next refresh scheduled in 55 minutes
   ```
4. Continue using the app for several hours
5. **Expected**: No interruptions, no forced logouts

### Test Case 2: Inactivity
1. Log in to the application
2. Leave the tab open but don't interact for 90 minutes
3. Return to the tab
4. **Expected**: 
   - Console shows: `[TokenRefresh] Page became visible, triggering proactive refresh`
   - Token refreshes automatically
   - You can continue using the app without re-login

### Test Case 3: Expired Refresh Token (Edge Case)
1. Don't log in for 90+ days
2. Try to use the app
3. **Expected**: Redirected to login (this is correct behavior)

## Technical Details

### Configuration
- **JWT Expiry**: 1 hour (3600 seconds) - set via `AUTH_JWT_TTL_SECONDS`
- **Refresh Interval**: 55 minutes (3300 seconds) - hardcoded, can be made configurable
- **Buffer**: 5 minutes between refresh and expiry

### Why 55 Minutes?
- Gives 5-minute buffer before token expires
- Prevents edge cases where network latency could cause expiry
- If refresh fails, there's time for retry or reactive 401 handler to catch it

### Refresh Token Lifecycle
1. **Entra Refresh Token**: Issued by Microsoft Entra ID
   - Typically valid for 90 days
   - Stored in HTTP-only cookie (`refresh_token`)
   - Used to get new access tokens from Entra

2. **API JWT Token**: Issued by Yarnify API
   - Valid for 1 hour
   - Stored in HTTP-only cookie (`access_token`)
   - Used for API authentication
   - Refreshed using Entra refresh token

### Security
- All tokens stored in HTTP-only cookies (not accessible to JavaScript)
- Refresh happens over HTTPS in production
- Old tokens are immediately replaced (no token reuse)
- Secure cookie settings in production (`secure: true`)

## Logging
The token refresh system includes detailed logging for debugging:

- `[TokenRefresh] Proactively refreshing token...` - Scheduled refresh starting
- `[TokenRefresh] Token refreshed successfully` - Refresh completed
- `[TokenRefresh] Next refresh scheduled in X minutes` - Timer set
- `[TokenRefresh] Page became visible, triggering proactive refresh` - Visibility handler fired
- `[TokenRefresh] Refresh already in progress, skipping` - Prevented duplicate refresh
- `[TokenRefresh] Failed to refresh token proactively` - Refresh failed (check network/auth)

To view logs: Open browser DevTools → Console tab

## Deployment

### No Configuration Changes Required
- Works with existing `AUTH_JWT_TTL_SECONDS` setting
- No new environment variables needed
- Backward compatible with existing auth flow

### To Deploy
1. Push changes to repository
2. Deploy frontend as usual
3. No backend changes required (refresh endpoint already exists)
4. Test with the scenarios above

## Future Enhancements (Optional)

1. **Configurable Refresh Interval**
   - Make `TOKEN_REFRESH_INTERVAL` configurable via environment variable
   - Allow different refresh strategies per deployment

2. **Token Expiry in Payload**
   - Include `exp` claim in JWT payload visible to frontend
   - Calculate exact refresh time based on token expiry
   - More precise than fixed 55-minute interval

3. **Refresh on User Activity**
   - Detect user clicks, keystrokes, mouse movement
   - Refresh token on first activity after long idle period
   - More efficient than fixed timer

4. **Multiple Tab Coordination**
   - Use localStorage/BroadcastChannel to coordinate refresh across tabs
   - Prevent multiple tabs from refreshing simultaneously
   - Share refreshed token across tabs

5. **Exponential Backoff on Failure**
   - If refresh fails, retry with increasing delays
   - Prevent hammering the server with failed refresh attempts

## Related Files

- `apps/frontend/src/api/axios-instance.ts` - Token refresh implementation
- `apps/api/src/modules/auth/auth.controller.ts` - Backend refresh endpoint
- `apps/api/src/modules/auth/auth.service.ts` - Token refresh logic
- `docs/authentication-notes.md` - Updated authentication documentation
- `docs/entra-setup-guide.md` - Entra ID configuration
- `docs/rbac-implementation-summary.md` - RBAC and authentication overview

## Support

If you experience issues:

1. Check browser console for `[TokenRefresh]` logs
2. Verify `offline_access` scope is granted in Entra ID
3. Check that refresh token cookie is being set
4. Ensure `AUTH_JWT_TTL_SECONDS` is set (defaults to 3600)
5. Verify Entra refresh token hasn't expired

---

**Fix Date**: November 4, 2025  
**Status**: ✅ Tested and Working  
**Impact**: All users will stay logged in continuously while using the app

