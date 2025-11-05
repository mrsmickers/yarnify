# Quick Test: Token Refresh Fix

## ✅ The Fix is Applied

Your authentication issue has been resolved! Here's how to verify it's working:

## 1. Start the App

```bash
cd /Users/simonsmyth/Projects/yarnify
pnpm run dev
```

## 2. Open Browser DevTools

1. Open your app in Chrome/Firefox
2. Press F12 to open DevTools
3. Go to the **Console** tab

## 3. Log In

Visit `http://localhost:3000/api/v1/auth/login` and log in with your Entra ID account

## 4. Look for These Console Messages

Immediately after the app loads, you should see:
```
[TokenRefresh] Next refresh scheduled in 55 minutes
```

This confirms the proactive refresh timer is running!

## 5. Test Scenarios

### Scenario A: Wait 55 Minutes (Full Test)
Leave the tab open and wait 55 minutes. You should see:
```
[TokenRefresh] Proactively refreshing token...
[TokenRefresh] Token refreshed successfully
[TokenRefresh] Next refresh scheduled in 55 minutes
```

**Result**: You stay logged in! ✅

### Scenario B: Switch Tabs (Quick Test)
1. Switch to another browser tab for a few seconds
2. Come back to the Yarnify tab
3. You should see:
```
[TokenRefresh] Page became visible, triggering proactive refresh
[TokenRefresh] Proactively refreshing token...
[TokenRefresh] Token refreshed successfully
```

**Result**: Token refreshes automatically when you return! ✅

### Scenario C: Use the App Normally (Real World Test)
1. Log in
2. Use the app for 2-3 hours
3. Keep interacting (clicking, viewing pages, etc.)
4. Check the console occasionally

**Result**: You should see refresh messages every 55 minutes, and you never get kicked out! ✅

## 6. Verify Cookies

In DevTools → Application → Cookies → `http://localhost:3000`:

You should see:
- `access_token` - Your JWT session token
- `refresh_token` - Your Entra refresh token

These should persist and update automatically.

## What's Different Now?

### Before (❌ Bad)
- Token expires after 1 hour
- No automatic refresh
- Get kicked out unexpectedly
- Have to log in again

### After (✅ Good)
- Token refreshes automatically every 55 minutes
- Token refreshes when you return to the tab
- Stay logged in indefinitely (while tab is open)
- Only log out when you explicitly want to

## Troubleshooting

### I don't see the console messages
- Make sure you've built and started the app with the latest code
- Check that you're logged in (have cookies)
- Refresh the page once

### I still get kicked out
Check if:
1. Your Entra refresh token expired (unlikely, lasts ~90 days)
2. Network errors preventing refresh (check console for errors)
3. Entra ID configuration issues (check `offline_access` scope is granted)

### To test the refresh works immediately
Open the browser console and run:
```javascript
// Manually trigger a refresh
fetch('/api/v1/auth/refresh', { 
  credentials: 'include' 
}).then(r => r.json()).then(console.log)
```

You should see: `{ message: 'Token refreshed successfully', accessToken: '...' }`

## Files Changed

- ✅ `apps/frontend/src/api/axios-instance.ts` - Added proactive token refresh
- ✅ `docs/authentication-notes.md` - Updated documentation
- ✅ `docs/token-refresh-fix.md` - Full technical documentation

## You're All Set! 🎉

The token refresh issue is fixed. You'll now stay logged in as long as:
1. Your browser tab stays open (timer keeps refreshing)
2. Your Entra refresh token is valid (~90 days)
3. You're not explicitly logged out

---

**Need Help?** Check `docs/token-refresh-fix.md` for full technical details.

