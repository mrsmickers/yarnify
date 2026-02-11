# HubSpot Lost Deal → Encharge Sync — Build Spec

## Overview
Add a second marketing sync to The Oracle that pushes contacts from HubSpot "Closed Lost" deals to Encharge with a `lost-deal` tag. This uses the same Marketing module framework built for the CW newsletter sync.

## Branch
`feature/hubspot-lost-deal-sync` (branched off `main`).

## What to Build

### New file: `apps/api/src/modules/marketing/hubspot-deals.service.ts`

A HubSpot API client that:
1. Searches for deals in stage `closedlost` using the HubSpot CRM v3 Search API
2. For each deal, fetches associated contacts (via the associations API)
3. Returns contact details (email, firstName, lastName, company name) for each associated contact

**HubSpot API details:**
- Base URL: `https://api.hubapi.com`
- Auth: `Authorization: Bearer {token}` header
- Env var: `HUBSPOT_ACCESS_TOKEN`

**Endpoints needed:**
- `POST /crm/v3/objects/deals/search` — search deals by stage
  - Body: `{"filterGroups":[{"filters":[{"propertyName":"dealstage","operator":"EQ","value":"closedlost"}]}],"properties":["dealname","closedate","lost_reason","amount"],"limit":100}`
- `GET /crm/v3/objects/deals/{dealId}/associations/contacts` — get associated contacts for a deal
- `GET /crm/v3/objects/contacts/{contactId}?properties=email,firstname,lastname,company` — get contact details

**Important:** HubSpot deals can have multiple associated contacts. We want ALL contacts from lost deals, deduplicated by email.

### Update: `apps/api/src/modules/marketing/marketing-sync.service.ts`

Add a new sync handler for `sourceType: "hubspot"`. The existing service handles `sourceType: "connectwise"`. Add an else-if branch:

```typescript
if (sync.sourceType === 'connectwise') {
  // existing CW logic
} else if (sync.sourceType === 'hubspot') {
  // new HubSpot logic - use hubspot-deals.service.ts
}
```

The HubSpot sync logic:
1. Pull all Closed Lost deals from HubSpot
2. Get associated contacts for each deal (with email, name, company)
3. Deduplicate by email
4. Pull current Encharge contacts
5. For each HubSpot contact:
   - If exists in Encharge: ensure `lost-deal` tag is applied
   - If new: create in Encharge with `lost-deal` tag, firstName, lastName, company
6. For Encharge contacts with `lost-deal` tag but NOT in HubSpot results: remove tag
7. Log to MarketingSyncRun

### Update: `apps/api/src/modules/marketing/marketing.module.ts`

Add `HubspotDealsService` to providers.

### Seed Data

Add a second sync config (in seed-marketing.ts or via a SQL insert):
```json
{
  "name": "Lost Deal Nurture",
  "description": "Syncs contacts from Closed Lost deals in HubSpot to Encharge for the lost deal nurture sequence.",
  "sourceType": "hubspot",
  "destType": "encharge",
  "filterConfig": {
    "dealStage": "closedlost",
    "properties": ["dealname", "closedate", "lost_reason", "amount"]
  },
  "tagName": "lost-deal",
  "schedule": "0 7 * * *",
  "enabled": true
}
```

Schedule: Daily at 07:00 UTC (lost deals should sync faster than the weekly newsletter).

### Environment Variables
- `HUBSPOT_ACCESS_TOKEN` — already exists in Coolify for production (check — may need adding)

### What NOT to change
- Don't modify the existing ConnectWise sync logic
- Don't modify the frontend (the existing MarketingPage already renders cards for ALL syncs from the API — the new sync will appear automatically as a second card)
- Don't modify the existing Prisma schema (MarketingSync model is generic enough)
- Don't modify the existing controller or producer (they're sync-agnostic)

### Testing
After building:
1. Verify `npx prisma generate` still works
2. Verify `npx nest build` compiles
3. Verify `cd apps/frontend && npx vite build` compiles
4. Commit all changes with a descriptive message

### Key Notes
- The HubSpot API uses pagination (default 100 per page). Handle `paging.next.after` for > 100 deals.
- Contact associations require a separate API call per deal — be mindful of rate limits. Add a small delay between requests if needed.
- HubSpot contact properties use lowercase: `firstname`, `lastname`, `company`, `email`
- The `HUBSPOT_ACCESS_TOKEN` is a PAT (Personal Access Token), format: `pat-eu1-*`
