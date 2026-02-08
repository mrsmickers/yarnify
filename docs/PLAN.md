# The Oracle - Product Roadmap & Feature Ideas

This document captures planned features and ideas for The Oracle call analysis platform.

---

## 1. User Profiles with Context Box

**Goal:** Help the LLM understand who each agent is for better analysis.

**Details:**
- Each user has a profile with a "context box" - free text describing:
  - Who they are (role, department)
  - Their purpose (sales, support, account management)
  - Skills and specialties
  - Extension information
  - Any other identifying information to avoid ambiguity
- Context box content is included with prompts sent to the LLM
- Helps with agent identification when transcript is ambiguous

**Location:** User management / profile settings

---

## 2. Company Match (Caller Context)

**Goal:** Enrich calls with company information before LLM analysis.

**Details:**
- Before sending to LLM, use the caller's phone number to fetch:
  - Company name
  - Any other relevant context (industry, account status, etc.)
- This context is sent with the prompt to help LLM understand who called
- Could integrate with CRM (ConnectWise) for richer data

**Implementation:** Pre-processing step in call analysis pipeline

---

## 3. Our Company Information

**Goal:** Ensure LLM correctly references Ingenio Technologies (not "Ingenie" etc.)

**Details:**
- Admin section to define:
  - Official company name
  - What the company does
  - Key context about services
- This information is included with all prompts
- Prevents LLM hallucinations about company identity

**Location:** Admin → Company Settings

---

## 4. Permission System

**Goal:** Granular access control as The Oracle expands.

**Details:**
- Restrict areas to different people and departments
- Examples:
  - Sales training section not visible to 1st line engineers
  - Engineers don't see sales team feedback/summaries
  - Team leads see their team's calls
  - Managers see department-wide data
- Role-based with ability to customize per user

**Location:** Admin → Roles & Permissions

---

## 5. Sales Trainer Module

**Goal:** Training and feedback system for sales calls.

**Details:**
- **Product Catalogue** in admin area:
  - List of products/services we sell
  - Key features, pricing tiers, upsell opportunities
- When analysing sales calls, LLM has product context to:
  - Identify missed upsell opportunities
  - Check if correct products were recommended
  - Assess product knowledge accuracy

**Location:** Admin → Product Catalogue, Analysis → Sales Training

---

## 6. Prompt Editor (Admin UI)

**Goal:** Edit prompts without code changes.

**Details:**
- Super admins access Admin → Prompts page
- Edit any system prompts with variable support
- Variables replaced at runtime (e.g., `{{agent_name}}`, `{{company_context}}`)
- Changes apply to all new calls and resubmissions
- Version history for rollback

**Location:** Admin → Prompts (nav may already exist)

---

## 7. Default Call Visibility

**Goal:** Users see only their own calls by default.

**Details:**
- Non-admins see only calls where they are the assigned agent
- Permission system allows admins to expand access:
  - Team lead → sees all engineer calls
  - Department head → sees department calls
  - Admin → sees all calls
- Granular enough for custom configurations

**Ties to:** Permission System (#4)

---

## 8. Engineer Notes → ConnectWise Integration

**Goal:** Engineers can push call summaries to ConnectWise tickets.

**Details:**
- Engineers see their own call summaries with "engineer notes" section
- "Send to ConnectWise" button opens modal:
  - Editable transcript/summary
  - **Smart ticket matching:**
    - Shows today's tickets, ranked by relevance
    - Matches based on: call time ↔ ticket time, engineer assignment
    - Option to see all tickets (for updating someone else's)
  - Select ticket and submit
- Summary includes link back to The Oracle call detail
- **Value:** Captures full detail from in-depth calls, reduces manual typing, prevents errors/laziness

**Integration:** ConnectWise PSA API

---

## 9. Training Filters (Custom Prompts)

**Goal:** Add training rules without editing code.

**Details:**
- Separate area to create training filters/prompts
- Example: Hamilton Mercer training produced good/bad phrases
- UI: Press + button, type rule like:
  - "Never tell the customer we're understaffed"
  - "Always offer a callback if wait time exceeds 5 minutes"
  - "Use customer's name at least twice"
- Rules build up over time
- LLM uses these when generating training feedback

**Location:** Admin → Training Rules

---

## 10. Training Box (Per-Call Output)

**Goal:** Each call shows training feedback based on filters.

**Details:**
- Every call detail page has a "Training" section
- Shows flags triggered by training filters
- Example: If agent said "we're understaffed today" → flagged with the relevant training rule
- Visual indicators (pass/fail, warnings)
- Links to the specific training rule that was triggered

**Ties to:** Training Filters (#9), Scoring System (#13)

---

## 11. Report Builder System

**Goal:** Custom reports on any schedule.

**Details:**
- Create reports with:
  - Custom filters (departments, individuals, date ranges)
  - Specific metrics/items to include
  - Schedule (daily, weekly, monthly, ad-hoc)
  - Recipients
- Use cases:
  - Individual report for quarterly 1:1s
  - Weekly sales report (missed opportunities)
  - Monthly team performance summary
- Export options (PDF, email, dashboard embed)

**Location:** Admin → Reports

---

## 12. Dashboards

**Goal:** Visual KPIs for individuals and teams.

**Details:**
- **Individual dashboards:** Users see their own metrics
- **Team dashboards:** Elevated permissions see team/department
- **Metrics:**
  - Calls made (outbound)
  - Calls received (inbound)
  - Answered in X rings (if data available from VoIP)
  - Call duration (average, total)
  - Scores against training filters
- Filterable by date range
- Trend indicators (vs. previous period)

**Location:** Dashboard (main nav)

---

## 13. Scoring System

**Goal:** Quantify training filter performance.

**Typical Approach (Industry Standard):**

**Weighted Categories:**
- Group filters into categories (Compliance, Customer Service, Sales, etc.)
- Each category has a weight (e.g., Compliance 30%, Customer Service 40%, Sales 30%)
- Filters within each category contribute to that category's score

**Critical/Auto-Fail Rules:**
- Some filters instantly fail or cap the overall score
- E.g., "Disclosed confidential info" = auto-fail regardless of other scores
- "Said we're understaffed" might cap max score at 70%

**Example Structure:**
```
Overall Score = Weighted average of categories
├── Compliance (30% weight) - Critical, auto-fail possible
│   ├── GDPR mentioned when required (boolean)
│   └── No confidential disclosure (boolean, CRITICAL)
├── Customer Service (40% weight)
│   ├── Used customer name (boolean)
│   ├── Professional tone (1-10 scale)
│   └── Never said "understaffed" (boolean)
└── Sales/Resolution (30% weight)
    ├── Offered callback (boolean)
    └── Issue resolved (1-10 scale)
```

**Implementation:**
- Each filter has:
  - Score type: Boolean (0 or 10) or Scale (0-10)
  - Category assignment
  - Critical flag (auto-fail or score cap)
  - Weight within category
- Admins configure weights and critical flags via UI
- Start simple, add complexity as needed

**Scores feed into:**
- Training Box (#10)
- Dashboards (#12)
- Reports (#11)

**Ties to:** Training Filters (#9), Training Box (#10)

---

## 14. Sentiment Analysis with Alerting

**Goal:** Detect problematic calls in real-time and escalate automatically.

**Details:**
- Analyse call sentiment (already captured: mood, frustration level)
- **Alerting thresholds:**
  - If sentiment is "very negative" or frustration is "high" → flag for review
  - Configurable thresholds per metric
- **Escalation actions:**
  - Create ticket for manager review
  - Send email alert to designated recipients
  - Add to "Needs Review" queue in dashboard
- **Error elimination:**
  - Option to auto-resubmit flagged calls to a second model
  - Compare results to reduce false positives
  - Human review for confirmed issues

**Use cases:**
- Catch customer complaints before they escalate
- Identify agents who need immediate coaching
- Compliance monitoring (angry customer + sensitive topic)

**Location:** Admin → Alerting Rules, Dashboard → Flagged Calls

---

## 15. Dispatch Central

**Goal:** Central hub for dispatchers, service desk coordinators, and managers.

**Details:**

**Chat/Collaboration:**
- Chat interface about all tickets or individual tickets
- Tag team members, attach call summaries
- Threaded discussions per ticket

**Statistics & Monitoring:**
- General stats (tickets open, resolved, SLA status)
- Engineer load (who has capacity, who's overloaded)
- Real-time queue status

**Time Entry Auditing:**
- Check time entries across engineers
- **Mismatch detection:** Compare when ticket was actually logged vs. timestamp on ticket
- Audit trail for accountability
- Flag suspicious patterns

**Canned Checks (Prompt Library):**
- Pre-built queries/reports, e.g.:
  - "Who missed SLAs today?"
  - "Who has overlapping tickets?"
  - "Time entry mismatch report"
  - "Engineers with no activity in last 2 hours"
- Users can run these with one click
- Admins can create new canned checks

**Report Generation:**
- Create ad-hoc reports from any data in the system
- Export or email reports
- Schedule recurring reports

**Location:** Dispatch Central (main nav, elevated permissions)

**Integration:** ConnectWise PSA for ticket/time data

---

## 16. Semantic Call Search

**Goal:** Search across all call transcripts using natural language queries.

**Details:**
- Search box on dashboard/calls page: type natural language like "calls where customer complained about slow response" or "any calls mentioning server migration"
- Query is embedded via OpenAI `text-embedding-3-small` and matched against stored transcript chunk embeddings using pgvector cosine similarity
- Returns ranked results with relevant transcript snippets highlighted
- Filter results by date range, agent, company, sentiment

**Infrastructure:** Already built — transcripts are chunked (6k tokens, 200 overlap) and embedded into `CallTranscriptEmbedding` table via pgvector. **Currently disabled** (`SKIP_EMBEDDINGS=true`) until this search feature is implemented.

**Implementation:**
- Backend: Add similarity search endpoint using `<=>` cosine distance operator on pgvector
- Frontend: Search bar component with results list showing call card + matching snippet
- Re-enable embeddings (`SKIP_EMBEDDINGS=false`) when shipping this feature

**Ties to:** Dispatch Central (#15), Report Builder (#11)

**Location:** Calls page search bar, Dispatch Central search

---

---

## Feature #17: Agent-User Identity Linking

**Goal:** Automatically link VoIP agent identities (NTA extensions) to logged-in user profiles (Entra ID/SSO accounts), creating a unified identity per staff member that enriches call data with user context.

**Why it matters:**
- Enables "My Calls" view — agents see their own calls on login
- Unlocks per-agent dashboards, performance metrics, and personalised coaching
- Connects call data to org structure (department, role, manager) from Entra ID
- Foundation for permission scoping ("users see own calls, managers see team")

**Current state:**
- `Agent` model has `entraUserId` FK → `entra_users` table (schema ready, no records linked)
- `Agent` records created automatically from NTA extension data during call processing (name + extension)
- `entra_users` records created on first SSO login (Entra OID, email, displayName, department, role)
- 5 agents exist, 4 Entra users exist — Freddy and Joel appear in both but aren't linked

**Technical approach:**

1. **Auto-matching on login/sync:**
   - When an Entra user logs in, fuzzy-match their `displayName` or `email` against `Agent.name` / `Agent.email`
   - If match found and `Agent.entraUserId` is null → link automatically
   - Log the link for audit trail

2. **Admin UI for manual linking:**
   - Agent Management page already exists (`/admin/agents`)
   - Add dropdown to select Entra user for each agent
   - Handle edge cases: name mismatches, shared extensions, contractors without SSO

3. **NTA extension sync enrichment:**
   - NTA extensions API returns `callername_internal` — currently used to create Agent records
   - Could also pull email from NTA if available, improving auto-match accuracy

4. **Data enrichment once linked:**
   - Call detail page shows agent's department, role, profile photo (from Entra/Graph API)
   - Filter calls by "My Calls" using logged-in user's linked agent
   - Team views for managers (filter by department)

**Schema (already in place):**
```
Agent.entraUserId (String?, @unique) → EntraUser.id
```

**Key files:**
- `apps/api/prisma/schema.prisma` — Agent model with entraUserId relation
- `apps/api/src/modules/admin/admin-agents.service.ts` — Agent management (sync, link, CRUD)
- `apps/api/src/modules/auth/auth.service.ts` — Entra SSO login flow (place for auto-match)
- `apps/api/src/modules/call-analysis/call-processing.consumer.ts` — Agent creation during processing

**Ties to:** User Profiles (#1), Permission System (#4), Dashboards (#12), Scoring (#13)

---

## Implementation Priority

*To be determined based on business value and dependencies*

| # | Feature | Dependencies |
|---|---------|--------------|
| 1 | User Profiles | - |
| 2 | Company Match | CRM integration |
| 3 | Our Company Info | - |
| 4 | Permission System | - |
| 5 | Sales Trainer | Product Catalogue |
| 6 | Prompt Editor | - |
| 7 | Default Visibility | Permission System |
| 8 | CW Integration | ConnectWise API |
| 9 | Training Filters | Prompt Editor |
| 10 | Training Box | Training Filters, Scoring |
| 11 | Report Builder | Dashboards |
| 12 | Dashboards | Scoring System |
| 13 | Scoring System | Training Filters |
| 14 | Sentiment Alerting | - |
| 15 | Dispatch Central | ConnectWise API, Permission System |
| 16 | Semantic Call Search | Embeddings (re-enable SKIP_EMBEDDINGS) |
| 17 | Agent-User Identity Linking | User Profiles, Entra SSO |

---

## Questions to Clarify

*(Add questions here as they arise during implementation)*

---

*Last updated: 2026-02-08*
