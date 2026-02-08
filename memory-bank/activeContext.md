# Active Context

This file tracks the project's current status, including recent changes, current goals, and open questions.

## Current Status (February 2026)

**The Oracle is live in production** at https://theoracle.ingeniotech.co.uk/

### Working ✅
- **Transcription:** OpenAI Whisper API (fast, reliable)
- **LLM Analysis:** NVIDIA Kimi-k2.5 (`moonshotai/kimi-k2-thinking`) via NIM API
- **Auth:** Microsoft Entra ID SSO + Cloudflare Access
- **Storage:** Persistent Docker volume with correct permissions
- **API:** All routes working via `/api/v1/` prefix
- **Database:** PostgreSQL with pgvector

### Infrastructure
- **Hosted on:** Business Coolify (ingcoolify, 100.99.183.58 via Tailscale)
- **App UUID:** `r84g88k8g0cg4wwccc8gk4sw`
- **Port:** 3100:3000 (host:container)
- **Tunnel:** ingpve1 via `*.ingeniotech.co.uk`
- **Volume:** `r84g88k8g0cg4wwccc8gk4sw-oracle-storage` → `/app/storage-data`

## Current Focus

1. **Fix agent attribution for transferred calls** — Priority issue
2. Consider re-enabling transcript refinement with Kimi-2.5
3. Process full recording backlog once attribution is fixed

## Open Issues

### Agent Attribution Bug ⚠️
For transferred calls, wrong agent gets attributed.

**Root Cause:** `extractInternalPhoneNumber()` in `call-analysis.service.ts` checks fields in this order:
1. `snumber` (source number)
2. `callerid_internal`
3. `cnumber`
4. `dnumber` (destination number)

First match wins — so for calls transferred from reception to technician, we pick the receptionist (initial answerer) not the technician (final handler).

**Fix Options:**
1. Reverse priority: check `dnumber` before `snumber`
2. Use LLM analysis to identify speaker from transcript content
3. Check NTA API for call disposition/final handler metadata

### Key Files
- Agent extraction: `apps/api/src/modules/call-analysis/call-analysis.service.ts`
- NTA API reference: `docs/nta-api-reference.md`

## Recent Changes (Feb 2026)

- [2026-02-08] Switched from self-hosted Whisper to OpenAI Whisper API
- [2026-02-08] Added `limit` parameter to `/api/v1/voip/recordings/process`
- [2026-02-08] Fixed persistent storage with Docker volume + permissions
- [2026-02-08] Added NTA API reference documentation
- [2026-02-07] Deployed to business Coolify
- [2026-02-07] Renamed from Yarnify to "The Oracle"
- [2026-02-07] Added NVIDIA Kimi-k2.5 integration

## Key Configuration

```env
# Transcription
TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=<configured in Coolify>
SKIP_TRANSCRIPT_REFINEMENT=true

# LLM Analysis
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=<configured in Coolify>

# VoIP
EXTENSION_STARTS_WITH=56360
NTA_API_BASE_URL=<NTA API endpoint>
```

## Key Staff Extensions
- Joel Allen: 563601012
- Freddy Carey: 563601007
- Leanna Landers: 563601002

## Notes

- Container runs as `node:node` — volumes need `chown -R node:node /app/storage-data` after creation
- Self-hosted Whisper (large-v3) proved unreliable: 12 timeouts vs 6 completions
- GitHub repo is public for Coolify pulls
