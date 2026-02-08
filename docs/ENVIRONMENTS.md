# The Oracle — Environment Strategy

## Overview

Two environments running on the same Coolify host (ingcoolify):

| | **Staging** | **Production** |
|---|---|---|
| **Domain** | `staging-oracle.ingeniotech.co.uk` | `theoracle.ingeniotech.co.uk` |
| **Git branch** | `develop` | `main` |
| **Host port** | 3101 | 3100 |
| **Database** | Separate PG instance | Existing PG |
| **Redis** | Separate Redis instance | Existing Redis |
| **Whisper** | Shared (stateless) | Shared (stateless) |
| **Auto-deploy** | On push to `develop` | On push to `main` |

## Git Workflow

```
feature/xyz  →  develop  →  main
   (dev)       (staging)    (production)
```

1. **Feature branches** — all new work happens here (e.g. `feature/state-management`)
2. **`develop`** — merge features here. Auto-deploys to staging. Test here.
3. **`main`** — merge develop → main when tested. Auto-deploys to production.

### Day-to-day flow

```bash
# Start new work
git checkout develop
git pull origin develop
git checkout -b feature/my-feature

# ... make changes, commit ...

# Ready to test on staging
git checkout develop
git merge feature/my-feature
git push origin develop
# → Auto-deploys to staging-oracle.ingeniotech.co.uk

# Tested and approved → promote to production
git checkout main
git merge develop
git push origin main
# → Auto-deploys to theoracle.ingeniotech.co.uk
```

## Infrastructure

### Coolify Project Structure

```
Yarnify (project)
├── production (environment)
│   ├── The Oracle (app, branch: main, port: 3100)
│   ├── yarnify-db (PostgreSQL + pgvector)
│   ├── yarnify-redis (Redis 7.2)
│   └── Whisper ASR (shared)
└── staging (environment)
    ├── The Oracle Staging (app, branch: develop, port: 3101)
    ├── yarnify-staging-db (PostgreSQL + pgvector)
    └── yarnify-staging-redis (Redis 7.2)
```

### Staging Environment Variables

Same as production except:
- `DATABASE_URL` → points to staging DB
- `REDIS_URL` → points to staging Redis
- `FRONTEND_URL` → `https://staging-oracle.ingeniotech.co.uk`
- `COOLIFY_URL` / `COOLIFY_FQDN` → staging domain
- `NODE_ENV` → `production` (still a real build, just different data)

### Cloudflare Tunnel

Add `staging-oracle.ingeniotech.co.uk` → `http://192.168.120.12:3101` to the `ingpve1` tunnel.

## Database Strategy

- **Staging DB is fully isolated** — separate PostgreSQL instance, separate data
- Staging can be seeded with anonymised production data if needed
- Schema migrations run on both (Prisma migrate deploy runs on container start)
- **Never connect staging app to production DB**

## What's Shared

- **Whisper ASR** — stateless transcription service, safe to share
- **Coolify host** — same server, different containers
- **Cloudflare tunnel** — same tunnel, different hostnames
- **GitHub repo** — same repo, different branches

## What's NOT Shared

- Databases (completely separate data)
- Redis (separate queues, no job cross-contamination)
- VoIP credentials (staging should NOT auto-sync live calls — consider a flag)
- Entra SSO (same tenant, but staging users should know they're on staging)

## Staging Safeguards

1. **Visual indicator** — staging frontend shows a banner: "STAGING ENVIRONMENT"
2. **VoIP sync disabled by default** — prevent staging from processing live customer calls
3. **Separate BullMQ queues** — different Redis, no job leakage
4. **Domain makes it obvious** — `staging-oracle` vs `theoracle`
