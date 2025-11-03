# Local Development

This project now runs entirely without Azure dependencies. The backend stores
binary assets on the local filesystem and uses Dockerised services for data
stores so it can run the same way on macOS and Coolify.

## Prerequisites

- Node.js 22.x (aligns with the API Dockerfile)
- pnpm 9+ (activate via `corepack enable`)
- Docker Desktop

## Bootstrapping

1. **Install packages**

   ```bash
   corepack enable
   pnpm install
   ```

2. **Start supporting services**

   ```bash
   docker compose -f docker-compose.deps.yml up -d
   ```

   This launches:
   - `pgvector` powered PostgreSQL on `localhost:5432`
   - Redis on `localhost:6379`

3. **Seed Prisma**

   ```bash
   pnpm --filter api exec prisma generate
   pnpm --filter api exec prisma migrate dev
   ```

4. **Create environment file**

   Copy `apps/api/.env.example` to `apps/api/.env` and add secrets that cannot
   be version controlled (Entra, OpenAI, VOIP, ConnectWise…).

5. **Run the stack**

   ```bash
   pnpm run dev
   ```

   - API: http://localhost:3000
   - Frontend (Vite): http://localhost:5173
   - Swagger: http://localhost:3000/api/docs

## File Storage

Uploaded audio and transcripts are written to the directory specified by
`FILE_STORAGE_ROOT` (defaults to `<repo>/apps/api/storage-data`). The folder is created
on first run. Mount the same path as a volume when packaging for Coolify to
retain data between releases.

## Tear Down

```bash
docker compose -f docker-compose.deps.yml down
```

Volumes are persisted locally under Docker Desktop; remove them with
`docker volume ls`/`docker volume rm` if you need a clean slate.
