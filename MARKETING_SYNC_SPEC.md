# Marketing Sync Module — Build Spec

## Overview
Build a Marketing module into The Oracle (NestJS + React + PostgreSQL + BullMQ) that syncs contacts from ConnectWise PSA to Encharge email marketing platform.

## Branch
We're on `feature/marketing-sync` (branched off `main`). Commit all work here.

## What to Build

### Backend: `apps/api/src/modules/marketing/`

Follow existing patterns from `voip/` and `call-analysis/` modules.

Files:
- `marketing.module.ts` — NestJS module, registers BullMQ queue
- `marketing.controller.ts` — REST endpoints (protected with existing JwtOrStagingGuard)
- `marketing-sync.service.ts` — Business logic: pull CW contacts, diff, push to Encharge
- `encharge.service.ts` — Encharge REST API client
- `connectwise-contacts.service.ts` — CW contact query logic
- `marketing-sync.producer.ts` — BullMQ job producer
- `marketing-sync.consumer.ts` — BullMQ job consumer
- `constants.ts` — Queue name, job names
- `dto/` — Request/response types

### Prisma Models (add to `apps/api/prisma/schema.prisma`)

```prisma
model MarketingSync {
  id          String   @id @default(uuid())
  name        String
  description String?
  sourceType  String   // e.g. "connectwise"
  destType    String   // e.g. "encharge"
  filterConfig Json    // JSON with the CW filter params
  tagName     String   // Tag to apply in Encharge
  schedule    String?  // Cron expression
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  runs        MarketingSyncRun[]
}

model MarketingSyncRun {
  id              String   @id @default(uuid())
  syncId          String
  sync            MarketingSync @relation(fields: [syncId], references: [id])
  status          String   // "running", "completed", "failed"
  triggeredBy     String   // "manual", "schedule"
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  contactsTotal   Int      @default(0)
  contactsCreated Int      @default(0)
  contactsUpdated Int      @default(0)
  contactsRemoved Int      @default(0)  // tag removed (contact still exists)
  contactsSkipped Int      @default(0)
  contactsFailed  Int      @default(0)
  errorMessage    String?
  details         Json?    // Detailed per-contact results if needed
}
```

### API Endpoints

All under `/api/v1/marketing`:
- `GET /syncs` — list all sync automations
- `GET /syncs/:id` — get sync detail + last 10 runs
- `POST /syncs/:id/trigger` — trigger sync now (manual)
- `PATCH /syncs/:id` — update schedule, enable/disable
- `GET /syncs/:id/runs` — run history (paginated, last 50)
- `GET /syncs/:id/runs/:runId` — single run detail

### BullMQ Queue: `marketing-sync`
- Repeatable job per enabled sync (cron from sync config)
- Job name: `sync-{syncId}`
- Consumer processes the sync

### Sync Logic (ConnectWise → Encharge)

**ConnectWise query:**
1. GET companies: status/id in (1,19), has type 48 (Fully Managed), exclude types 35 (Owner) and 5 (Partner)
   - API can't filter on nested types array, so get all active companies and filter in code
2. GET contacts at those companies: inactiveFlag = false
   - Filter in code for contact types: Approver (1), Decision Maker (2), AM Point of Contact (21)
   - Exclude contact type: Managed Group (19)
3. Extract email from communicationItems (type.name == "Email", take first)

**ConnectWise API:**
- Base: `https://api-eu.myconnectwise.net/v2025_1/apis/3.0/`
- Auth: Basic auth with `base64(companyId+publicKey:privateKey)` + `clientId` header
- Company ID: `computereyez`
- Env vars needed: `CW_CLIENT_ID`, `CW_PUBLIC_KEY`, `CW_PRIVATE_KEY` (or fetch from existing ConnectWise module if available)

**Encharge REST API:**
- Base: `https://api.encharge.io/v1/`
- Auth: `X-Encharge-Token` header
- Env var: `ENCHARGE_REST_API_KEY`

**Encharge endpoints used:**
- `GET /people/all` — get all current contacts (returns {people: [...]})
- `POST /people` — create/update contact (upsert by email). Body: `{email, firstName, lastName, company, tags: "tag1,tag2"}`
- `POST /tags` — add tag to contact. Body: `{tag, email}`
- `DELETE /tags` — remove tag from contact. Body: `{tag, email}`

**Sync algorithm:**
1. Pull CW contacts (86 expected)
2. Pull Encharge contacts (`GET /people/all`)
3. Match on email (case-insensitive)
4. For each CW contact:
   - If exists in Encharge: update name/company if changed, ensure tag applied
   - If new: create in Encharge with tag
5. For Encharge contacts with this sync's tag but NOT in CW results: remove tag (don't delete the person)
6. Log everything to MarketingSyncRun

### Seed Data
Create a seed/migration that inserts the first sync config:
```json
{
  "name": "Managed Client Newsletter",
  "description": "Syncs approvers, decision makers and AM contacts from fully managed ConnectWise companies to Encharge for the monthly newsletter.",
  "sourceType": "connectwise",
  "destType": "encharge",
  "filterConfig": {
    "companyTypes": [48],
    "companyExcludeTypes": [35, 5],
    "companyStatuses": [1, 19],
    "contactTypes": [1, 2, 21],
    "contactExcludeTypes": [19]
  },
  "tagName": "managed-client-newsletter",
  "schedule": "0 6 * * 1",
  "enabled": true
}
```

### Frontend: `apps/frontend/src/pages/marketing/`

Files:
- `MarketingPage.tsx` — main page with sync automation cards
- `SyncRunHistory.tsx` — run history table component
- `SyncSettingsModal.tsx` — modal for schedule/enable/disable

**Nav item** (add to AppShell.tsx navigation):
```ts
{
  label: 'Marketing',
  icon: Megaphone,  // from lucide-react
  children: [
    { label: 'Automations', path: '/marketing', icon: RefreshCw, permission: 'marketing.view' }
  ]
}
```

Add route in the router config.

**UI Design:**
- Card per sync automation showing:
  - Name + description
  - Status badge: Active (green) / Paused (amber)
  - Last run: time + result (e.g. "85 synced, 1 new, 0 removed" or "Failed: error message")
  - Next scheduled run
  - Buttons: "Sync Now" (primary), "Pause/Resume" toggle, "Settings" gear icon
- Settings modal:
  - Schedule: dropdown for frequency (Daily/Weekly/Monthly) + day picker for weekly + time
  - Enable/disable toggle
  - Save button
- Run history: table with columns: Date, Trigger (manual/schedule), Duration, Created, Updated, Removed, Skipped, Failed, Status
- Use existing UI component patterns from the codebase (tailwind, same card/table styles)
- Ingenio brand: Navy #222E40, Yellow #DEDC00 for accents

**Permissions:**
Add to existing permission system:
- `marketing.view` — see marketing page
- `marketing.manage` — trigger syncs, change settings

### API Route Registration
Add the MarketingModule to `app.module.ts` imports.

### Important Notes
- Check existing `connectwise-manage/` module — reuse the CW API client if one exists there
- The existing app uses `JwtOrStagingGuard` on controllers — use the same pattern
- Staging has `STAGING_API_KEY` for auth bypass in testing
- Don't touch any existing code unnecessarily — this is a new, self-contained module
- Run `npx prisma generate` after schema changes
- Run `npx prisma db push` to apply schema to dev DB (no migration files needed for now)

### Testing
After building, verify:
1. `npx prisma generate` succeeds
2. The app compiles without errors (`npm run build` or `npx nest build`)
3. Frontend compiles (`cd apps/frontend && npm run build`)
