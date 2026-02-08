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

**Details:**
- Each training filter has a score type:
  - **Boolean:** 0 or 10 (e.g., "said we're understaffed" = 0 or 10)
  - **Scale:** 0-10 sliding scale (e.g., "professionalism" rated 1-10)
- **Overall score** calculated from individual filter scores
- Weighting system (some filters more important than others)
- Scores feed into:
  - Training Box (#10)
  - Dashboards (#12)
  - Reports (#11)

**Ties to:** Training Filters (#9), Training Box (#10)

---

## Implementation Priority

*To be determined based on business value and dependencies*

| Priority | Feature | Dependencies |
|----------|---------|--------------|
| TBD | User Profiles | - |
| TBD | Company Match | CRM integration |
| TBD | Our Company Info | - |
| TBD | Permission System | - |
| TBD | Sales Trainer | Product Catalogue |
| TBD | Prompt Editor | - |
| TBD | Default Visibility | Permission System |
| TBD | CW Integration | ConnectWise API |
| TBD | Training Filters | Prompt Editor |
| TBD | Training Box | Training Filters, Scoring |
| TBD | Report Builder | Dashboards |
| TBD | Dashboards | Scoring System |
| TBD | Scoring System | Training Filters |

---

## Questions to Clarify

*(Add questions here as they arise during implementation)*

---

*Last updated: 2026-02-08*
