# Environment Variables

All variables live in `apps/api/.env` when running locally. Secrets should be
injected through Coolify for deployment.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | No | Defaults to `development`; set `production` when deploying. |
| `DATABASE_URL` | Yes | Postgres connection string (pgvector extension required). |
| `REDIS_URL` | No | Defaults to `redis://localhost:6379/0`. |
| `FILE_STORAGE_ROOT` | No | Local directory for transcripts/recordings. Defaults to `<repo>/apps/api/storage-data`. |
| `FRONTEND_URL` | Yes | Base URL of the combined app (used for auth redirects). |
| `ENTRA_TENANT_ID` | Yes | Azure Entra tenant (GUID). |
| `ENTRA_CLIENT_ID` | Yes | App registration client ID. |
| `ENTRA_CLIENT_SECRET` | Yes | Client secret created for the app registration. |
| `ENTRA_SCOPES` | No | Comma separated scopes requested during login (default `openid,profile,offline_access`). |
| `AUTH_REDIRECT_URI` | No | API callback URL registered in Entra; defaults to `<FRONTEND_URL>/api/v1/auth/callback`. |
| `ENTRA_EXPECTED_TENANT` | No | Extra guard to ensure tokens come from the right tenant; defaults to `ENTRA_TENANT_ID`. |
| `AUTH_JWT_SECRET` | Yes | Secret used to sign session cookies issued by the API. |
| `AUTH_JWT_TTL_SECONDS` | No | Session lifetime in seconds (default `3600`). |
| `OPENAI_API_KEY` | Yes | OpenAI access token. |
| `VOIP_USERNAME` | Yes | Credentials for the existing VOIP provider. |
| `VOIP_PASSWORD` | Yes | ″ |
| `VOIP_BASE_URL` | Yes | ″ |
| `VOIP_CUSTOMER_ID` | No | Optional customer scoping for VOIP. |
| `CONNECTWISE_COMPANY_ID` | Yes | ConnectWise integration credentials. |
| `CONNECTWISE_URL` | Yes | ″ |
| `CONNECTWISE_PUBLIC_KEY` | Yes | ″ |
| `CONNECTWISE_PRIVATE_KEY` | Yes | ″ |
| `CONNECTWISE_CLIENT_ID` | Yes | ″ |
| `EXTENSION_STARTS_WITH` | No | Default `56360`. |
| `EMBEDDING_CHUNK_SIZE_TOKENS` | No | Defaults to `7500`. |
| `EMBEDDING_CHUNK_OVERLAP_TOKENS` | No | Defaults to `200`. |

> ℹ️  Refresh tokens are stored in HTTP-only cookies. Ensure your Entra app has
> `offline_access` in the configured scopes so refresh works.
