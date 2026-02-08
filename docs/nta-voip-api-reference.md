# NTA VoIP API Reference

Official documentation: https://nta.co.uk/help/api/

This document captures the key API endpoints used by The Oracle for call recording analysis.

## Authentication

All API calls require:
- `auth_username` - Authentication username
- `auth_password` - Authentication password

## Recording API

### List Recordings
`GET /api/json/recording/recordings/list`

Lists call recordings within a date range.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| auth_username | String | Yes | Authentication username |
| auth_password | String | Yes | Authentication password |
| recordgroup | Integer | Yes* | ID of record group (e.g., `4303` for Ingenio) |
| customer | Integer | Yes* | Customer ID (alternative to recordgroup) |
| start | Integer | Recommended | Start Unix timestamp |
| end | Integer | Recommended | End Unix timestamp |
| complete | Integer | No | 1=completed only, 0=in progress, -1=all (default: 1) |
| totaltime_minimum | Integer | No | Minimum call duration in seconds |
| totaltime_maximum | Integer | No | Maximum call duration (-1=no limit) |
| sort | String | No | Sort by: cnumber, expires, snumber, start, totaltime |
| descending | Integer | No | 1=descending, 0=ascending |

**Response Fields (per recording):**
- `uniqueid` - Unique call identifier (e.g., `1770217174.110066`)
- `start` - Unix timestamp of call start
- `end` - Unix timestamp of call end
- `totaltime` - Total call duration in seconds
- `talktime` - Talk time in seconds
- `snumber` - Source number
- `snumber_display` - Source number display name
- `dnumber` - Destination number
- `dnumber_display` - Destination number display name
- `cnumber` - Called number
- `callerid_internal` - Internal caller ID
- `scustomer` - Source customer
- `dcustomer` - Destination customer
- `stype` - Source type
- `dtype` - Destination type
- `ctype` - Called type
- `status` - Call status
- `callid` - Call ID
- `asteriskid` - Asterisk ID
- `recordid` - Record ID
- `recordgroup` - Record group ID
- `complete` - 0 or 1
- `mimetype` - Audio MIME type
- `size` - File size
- `path` - File path

### Get Recording
`GET /api/json/recording/recordings/get`

Gets a specific recording with audio data.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| auth_username | String | Yes | Authentication username |
| auth_password | String | Yes | Authentication password |
| recordgroup | Integer | Yes | Record group ID |
| uniqueid | String | Yes | Unique ID of recording |
| recordid | String | Yes | Record ID |
| encoding | String | No | "base64" or "raw" (default: raw) |
| sha1 | Integer | No | 1 to include SHA1 hash |

**Response:**
Returns all fields above plus `data` containing the audio (base64 if requested).

## Phones API (Extensions)

### Get Phone/Extension
`GET /api/json/phones/get`

Gets details of a telephone line/extension.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| auth_username | String | Yes | Authentication username |
| auth_password | String | Yes | Authentication password |
| name | String | Yes | Extension number (e.g., `563601007`) |
| customer | Integer | No | Customer ID |

**Response Fields:**
- `name` - Extension number
- `description` - Description
- `display` - Display name
- `callername_internal` - Internal caller name (agent name)
- `callername_external` - External caller name
- Additional configuration fields

## CDR API (Call Detail Records)

### List CDRs
`GET /api/json/cdrs/list`

Gets completed call records with detailed routing information.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| start | Integer | Recommended | Start Unix timestamp |
| end | Integer | Recommended | End Unix timestamp |
| customer | String/Int | No | Customer ID or "all", "system" |
| direction | String | No | "in", "out", "internal", or empty for all |
| phone | String | No | Source telephone line |
| snumber | String | No | Source number filter |
| cnumber | String | No | Called number filter |
| dnumber | String | No | Destination number filter |
| recorded | String | No | "yes", "no", or empty for all |
| limit | Integer | No | Limit results |

**Response Fields:**
- `uniqueid` - Unique call identifier
- `callid` - Call ID (may link related call legs)
- `start` - Start timestamp
- `end` - End timestamp
- `talktime` - Talk time
- `totaltime` - Total time
- `snumber` - Source number
- `dnumber` - Destination number
- `cnumber` - Called number
- `scustomer` - Source customer
- `dcustomer` - Destination customer
- `stype` - Source type
- `dtype` - Destination type
- `direction` - Call direction
- `status` - Call status (answer, cancel, etc.)
- `peer` - Peer ID

## Call Transfer Detection

**The Problem:** When a call is transferred (e.g., Joel answers, transfers to Freddy), the recording metadata may only show the initial answerer's extension in `snumber`.

**Potential Solutions:**

1. **CDR Correlation:** Use `callid` to find related call legs that share the same call chain.

2. **Multiple Extension Detection:** Check if both `snumber` and `dnumber` contain internal extensions - this indicates an internal transfer.

3. **LLM-based Detection:** Extract the actual handler's name from the transcript and update agent attribution.

**Fields to check for transfers:**
- `snumber` - Initial answering extension
- `dnumber` - Destination (may be transfer target)
- `callerid_internal` - Internal caller ID
- `callid` - May link multiple legs of same call
- `asteriskid` - Asterisk call identifier

## Ingenio-Specific Configuration

- **Record Group:** `4303`
- **Customer ID:** Check environment variable
- **Extension Prefix:** `56360` (9-digit extensions like `563601007`)
- **API Base URL:** `https://voip.ingeniotech.co.uk`

## Agents/Extensions Mapping

| Extension | Agent Name |
|-----------|------------|
| 563601001 | Zain Hassan |
| 563601002 | Leanna Landers |
| 563601003 | George Stokes |
| 563601004 | Cameron Ash |
| 563601005 | Arron Seymour |
| 563601007 | Freddy Carey |
| 563601012 | Joel Allen |
| 563601014 | Alicja Nowok |

## Current Implementation

The Oracle currently uses:

1. **`recording/recordings/list`** - To fetch recordings in a date range
2. **`recording/recordings/get`** - To download individual recordings with audio data
3. **`phones/get`** - To resolve extension numbers to agent names

### Extension Extraction Logic

Located in `call-analysis.service.ts`:

```typescript
// Fields checked in order (first match wins):
const fields = [
  { name: 'snumber', value: obj.snumber },
  { name: 'callerid_internal', value: obj.callerid_internal },
  { name: 'cnumber', value: obj.cnumber },
  { name: 'dnumber', value: obj.dnumber },
];
```

**Issue:** For transferred calls, `snumber` (initial answerer) is checked before `dnumber` (transfer target), causing wrong agent attribution.

## Future Improvements

1. **Call Chain Analysis:** Use CDR API to detect transfers by finding multiple legs with same `callid`
2. **Preference for dnumber:** For inbound calls, prefer `dnumber` over `snumber` when both contain internal extensions
3. **LLM Correction:** Use analysis results to update agent if transcript clearly identifies a different handler
