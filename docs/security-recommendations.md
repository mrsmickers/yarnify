# Security Recommendations for Yarnify

## Context
- **Data Sensitivity**: Employee-client call recordings, transcriptions, summaries
- **Jurisdiction**: United Kingdom (GDPR, Data Protection Act 2018)
- **Risk Level**: HIGH - Contains personal/potentially sensitive communications
- **Regulatory Considerations**: 
  - ICO (Information Commissioner's Office) guidance
  - Professional services data handling requirements
  - Potential health/financial information in calls

## Current Session Management Issues

### Problem 1: Indefinite Sessions
- Users stay logged in as long as browser tab is open
- No forced re-authentication even after days
- Violates principle of "session timeout" for sensitive data

### Problem 2: No Idle Detection
- No automatic logout after inactivity
- Unattended workstation = unauthorized access risk
- Non-compliance with security frameworks (Cyber Essentials, ISO 27001)

### Problem 3: No Absolute Session Limit
- Refresh tokens valid for 90 days (Entra ID default)
- No maximum session duration enforcement
- User could theoretically stay logged in for months

## Recommended Security Controls

### 1. Absolute Session Timeout (24 Hours)
**What**: Force re-authentication after 24 hours, regardless of activity

**Why**: 
- Limits exposure window if credentials are compromised
- Industry standard for sensitive data systems
- Meets "reasonable time limits" requirement in GDPR

**Implementation**:
- Track session start time in JWT or database
- Backend rejects tokens older than 24 hours
- Frontend redirects to login when absolute timeout reached

### 2. Idle Timeout (15-30 Minutes)
**What**: Automatic logout after period of inactivity

**Why**:
- Protects against unattended workstations
- Required by Cyber Essentials Plus
- ICO guidance for systems with personal data

**Implementation**:
- Track last user activity (clicks, API calls)
- Show warning dialog at 14 minutes: "You'll be logged out in 1 minute"
- Clear cookies and redirect to login at 15 minutes

### 3. Maximum Refresh Count
**What**: Limit number of times a token can be refreshed (e.g., 24 refreshes = 24 hours)

**Why**:
- Enforces absolute session limit at token level
- Prevents circumventing timeout by keeping tab active
- Defense in depth

**Implementation**:
- Include refresh counter in JWT payload
- Increment on each refresh
- Reject when limit reached

### 4. Concurrent Session Detection
**What**: Detect and optionally prevent multiple simultaneous logins

**Why**:
- Identifies potential credential sharing
- Helps detect compromised accounts
- Audit trail requirement

**Implementation**:
- Store active session IDs in Redis/database
- Check on each API call
- Alert/block if sessions from multiple IPs/locations

## Recommended Configuration

### For Call Center/Sensitive Data Context

```env
# Session Timeouts
AUTH_JWT_TTL_SECONDS=3600                    # 1 hour token expiry
AUTH_ABSOLUTE_SESSION_TIMEOUT_HOURS=24       # Force re-login after 24 hours
AUTH_IDLE_TIMEOUT_MINUTES=15                 # Logout after 15 min inactivity
AUTH_MAX_TOKEN_REFRESHES=24                  # Max 24 refreshes (24 hours)

# Proactive Refresh
AUTH_TOKEN_REFRESH_INTERVAL_MINUTES=55       # Refresh at 55 min

# Security Features
AUTH_REQUIRE_MFA=true                        # Require multi-factor auth
AUTH_ENABLE_SESSION_TRACKING=true            # Track active sessions
AUTH_MAX_CONCURRENT_SESSIONS=2               # Allow 2 devices max
AUTH_LOG_ALL_AUTH_EVENTS=true                # Full audit logging
```

### User Experience Impact

| Scenario | Current Behavior | Recommended Behavior |
|----------|------------------|----------------------|
| **Active work (8am-5pm)** | Stay logged in | Token refreshes automatically, stay logged in |
| **Left desk for 20 min** | Stay logged in ❌ | Logged out automatically ✅ |
| **Next day (9am)** | Still logged in ❌ | Must re-login ✅ |
| **Weekend (Friday to Monday)** | Still logged in ❌ | Must re-login ✅ |
| **Warning before logout** | None ❌ | "1 minute remaining" dialog ✅ |

## Compliance Mapping

### GDPR (UK GDPR)
- **Article 32** (Security of Processing): ✅ Session timeouts, access controls
- **Article 5(1)(f)** (Integrity & Confidentiality): ✅ Automatic logout, audit logs
- **Recital 39**: ✅ Appropriate security measures for sensitive data

### Cyber Essentials (Plus)
- **Access Control**: ✅ Automatic screen lock/logout
- **Secure Configuration**: ✅ Session timeout policies
- **Audit Logging**: ✅ Track all authentication events

### ICO Guidance
- **Personal Data**: ✅ Time-limited access to call records
- **Security Measures**: ✅ Prevent unauthorized access via unattended terminals
- **Accountability**: ✅ Audit trail of who accessed what and when

### Professional Services Standards
- **Law Firms** (SRA compliance): ✅ Client confidentiality protections
- **Healthcare** (if applicable): ✅ Data protection safeguards
- **Financial Services**: ✅ Strong authentication, session management

## Implementation Priority

### Phase 1: Critical (Implement Immediately)
1. ✅ **Idle Timeout (15 minutes)** - Highest priority for unattended workstations
2. ✅ **Absolute Session Timeout (24 hours)** - Compliance requirement
3. ✅ **Warning Dialog** - User experience for idle timeout

### Phase 2: Important (Next Sprint)
4. **Audit Logging** - Track all login/logout events with timestamps
5. **Session Tracking** - Store active sessions in database
6. **MFA Enforcement** - Require multi-factor via Entra ID

### Phase 3: Enhanced Security (Future)
7. **Concurrent Session Limits** - Detect multiple logins
8. **IP/Location Anomaly Detection** - Alert on unusual login locations
9. **Risk-Based Authentication** - Require re-auth for sensitive actions

## Testing Checklist

- [ ] Idle for 15 minutes → Automatic logout
- [ ] Warning dialog appears at 14 minutes
- [ ] Active use for 8 hours → No interruption (tokens refresh)
- [ ] Active use for 25 hours → Forced re-login at 24 hours
- [ ] Close tab and reopen after 10 min → Must re-login
- [ ] Multiple tabs → All logout when idle timeout reached
- [ ] Audit log captures: Login, logout (manual), logout (idle), logout (absolute timeout)

## Recommended Immediate Action

Replace the current "indefinite session" implementation with:

1. **Backend Changes**:
   - Add session start timestamp to JWT
   - Reject tokens older than 24 hours
   - Add refresh counter to JWT

2. **Frontend Changes**:
   - Replace 55-minute timer with idle detection
   - Add warning dialog ("You'll be logged out in 1 minute due to inactivity")
   - Track last activity time
   - Force logout after 15 minutes idle OR 24 hours absolute

3. **Configuration**:
   - Make all timeouts configurable via environment variables
   - Document security reasoning in code comments

## References

- **ICO**: [Guide to Data Security](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/security/)
- **NCSC**: [Password and Access Management](https://www.ncsc.gov.uk/collection/device-security-guidance/policies-and-settings/password-and-access-management)
- **Cyber Essentials**: [Requirements](https://www.ncsc.gov.uk/cyberessentials/overview)
- **OWASP**: [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

**Author**: Security Review - November 4, 2025  
**Status**: Recommendations - Requires Implementation  
**Priority**: HIGH - Compliance and data protection requirements

