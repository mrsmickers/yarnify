FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate

# ENV here makes the sha available via os.Getenv
USER node:node

# Create a working directory for the application
WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile

# Copy the application code to the image
COPY --chown=node:node . .

# Build the application
RUN pnpm --filter frontend build

## Generate the Prisma client
RUN pnpm --filter api exec prisma generate

# Build the application
RUN pnpm --filter api build

# Remove the development dependencies
RUN pnpm prune --prod

# Create a new stage for the production image
FROM node:22-alpine
ARG commit_sha
ARG built_at
ENV COMMIT_SHA=$commit_sha
ENV BUILT_AT=$built_at



# Create a new user and group for the builder stage
RUN corepack enable && corepack prepare pnpm@10 --activate
RUN apk add busybox-extras

# Set the user and group ID for the production image
USER node:node

# Create a working directory for the application
WORKDIR /app

# add CA certificates from lib/ssl

# Copy the build directory from the builder stage
COPY --chown=node:node --from=builder /apps/package.json /app/package.json
COPY --chown=node:node --from=builder /apps/api/prisma /app/api/prisma
COPY --chown=node:node --from=builder /apps/api/client /app/api/client
COPY --chown=node:node --from=builder /apps/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --chown=node:node --from=builder /apps/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --chown=node:node --from=builder /apps/api/package.json /app/apps/api/package.json
COPY --chown=node:node --from=builder /apps/node_modules /app/node_modules
COPY --chown=node:node --from=builder /apps/api/dist /app/apps/api/dist

# Expose port 3000 for the application server
EXPOSE 3000

# Set the NODE_ENV environment variable to production
ENV NODE_ENV=production

# Start the application server
CMD ["pnpm", "--filter", "api", "run", "start:prod"]
