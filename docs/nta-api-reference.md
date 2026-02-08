# NTA VoIP API Reference

> Source: https://nta.co.uk/help/api/

## Overview

The NTA API provides JSON endpoints for managing VoIP telephony. Authentication is required via `auth_username` and `auth_password` parameters.

---

## Key Categories for The Oracle

### CDRs (Call History)

**Endpoint:** `/api/json/cdrs/list/`

Lists completed calls with filtering options.

#### Key Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `start` | Integer | Start Unix timestamp | 0 |
| `end` | Integer | End Unix timestamp | Now |
| `snumber` | String | Source number filter | (all) |
| `dnumber` | String | Destination number filter | (all) |
| `cnumber` | String | Called number filter | (all) |
| `phone` | String | Source telephone line | (all) |
| `direction` | String | `in`, `out`, `internal` | (all) |
| `status` | String | `answer`, `cancel`, `other` | (all) |
| `recorded` | String | `yes`, `no`, or empty | (all) |
| `talktime_minimum` | Integer | Min talk seconds | 0 |
| `talktime_maximum` | Integer | Max talk seconds (-1=no limit) | -1 |
| `limit` | Integer | Result limit | (none) |
| `sort` | String | Sort field | `start` |
| `descending` | Integer | 1 for desc | 0 |

#### Key Fields Returned

- `uniqueid` - Unique call identifier
- `start` / `end` - Unix timestamps
- `snumber` - Source number (who made/answered the call)
- `cnumber` - Called number (what was dialed)
- `dnumber` - Destination number (where call was routed)
- `direction` - `in`, `out`, `internal`
- `status` - Call status
- `talktime` / `totaltime` - Duration in seconds
- `callerid_internal` - Internal caller ID

#### Example

```
GET /api/json/cdrs/list/?auth_username=user&auth_password=pass&start=1707350400&end=1707436800&recorded=yes
```

---

### Call Recordings

**Endpoint:** `/api/json/recording/recordings/list/`

Lists call recordings with metadata.

#### Key Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `customer` | Integer | Customer ID | Yes (unless recordgroup) |
| `recordgroup` | Integer | Record group ID | Yes (unless customer) |
| `start` | Integer | Start Unix timestamp | Recommended |
| `end` | Integer | End Unix timestamp | Recommended |
| `caller` | String | CallerID contains | No |
| `called` | String | Called number contains | No |
| `complete` | Integer | 1=complete, 0=in-progress, -1=all | 1 |
| `totaltime_minimum` | Integer | Min duration seconds | 0 |
| `sort` | String | Sort field | `start` |
| `descending` | Integer | 1 for desc | 0 |

#### Other Recording Endpoints

- `recording/recordings/get` - Get single recording metadata
- `recording/recordings/copy` - Copy to different group
- `recording/recordings/delete` - Delete recording
- `recording/recordings/send/ftp` - Export via FTP
- `recording/recordings/send/sftp` - Export via SFTP

---

### Active Calls

**Endpoint:** `/api/json/calls/active/list/`

Gets array of currently active calls.

#### Call Control Endpoints

- `calls/answer` - Answer a call
- `calls/atxfer` - Attended transfer
- `calls/blindxfer` - Blind transfer
- `calls/hangup` - Hang up
- `calls/hold` / `calls/resume` - Hold management
- `calls/pickup` - Pick up ringing call
- `calls/redirect` - Redirect call
- `calls/make` - Originate a call

---

### Telephone Lines (Phones)

**Endpoint:** `/api/json/phones/list/`

Lists all telephone lines/extensions.

#### Key Endpoints

- `phones/get` - Get single phone details
- `phones/dnd/get` - DND status
- `phones/forward/get` - Forward status
- `phones/registrations/list` - SIP registrations

---

## Agent Attribution Logic

For determining which agent handled a call:

### Current Field Priority (The Oracle)
1. `snumber` - Source number (initial answerer)
2. `callerid_internal` - Internal caller ID
3. `cnumber` - Called number
4. `dnumber` - Destination number

### Issue with Transferred Calls
When a call is transferred from reception → technician:
- `snumber` = receptionist (who first answered)
- `dnumber` = technician (who actually handled)

Current logic picks the **first answerer** (`snumber`), not the **final handler** (`dnumber`).

### Potential Solutions
1. **Reverse priority**: Check `dnumber` before `snumber`
2. **LLM analysis**: Use transcript content to identify speaker
3. **Additional API data**: Check if NTA provides transfer/disposition info

---

## All Available Categories

| Category | Description |
|----------|-------------|
| access | Remote access |
| addresses | SIP addresses |
| alerts | Alerts |
| audit | Audit log |
| blacklist | Blacklist numbers |
| bulk | Bulk dialer |
| calls | Active calls |
| callshops | Callshops |
| cards | Calling cards |
| carriers | Carriers |
| cdrs | Call history |
| charges | Charges |
| conferences | Conferences |
| configs | Configuration settings |
| customers | Customers |
| domains | Domains |
| emails | Emails |
| faxes | Faxes |
| features | Telephony features |
| huntgroups | Hunt groups |
| ivrs | IVR menus |
| mailboxes | Mailboxes |
| messages | Messages |
| music | Music on hold |
| numbers | Numbers |
| phones | Telephone lines |
| queues | Queues |
| recording | Call recording |
| sms | SMS |
| sounds | Sounds |
| speeddials | Speed dials |

---

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid input parameters |
| 401 | Invalid authentication |
| 402 | Role not allowed |
| 403 | Rate plan not allowed |
| 500 | Internal error |

---

## Notes

- Always specify `start` and `end` to avoid heavy database load
- Recordings are returned without sound files (fetch separately)
- Unix timestamps are in seconds
