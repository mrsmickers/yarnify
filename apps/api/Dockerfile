FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10 --activate

# ENV here makes the sha available via os.Getenv
USER node:node

# Create a working directory for the application
WORKDIR /app

COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node packages/db/package.json packages/db/
RUN pnpm install --frozen-lockfile

# Copy the application code to the image
COPY --chown=node:node . .

## Generate the Prisma client
RUN pnpm --filter @mailhooks/db exec prisma generate

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
COPY --chown=node:node --from=builder /app/package.json /app/package.json
COPY --chown=node:node --from=builder /app/packages/db/prisma /app/packages/db/prisma
COPY --chown=node:node --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --chown=node:node --from=builder /app/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --chown=node:node --from=builder /app/apps/api/package.json /app/apps/api/package.json
COPY --chown=node:node --from=builder /app/packages/db/package.json /app/packages/db/package.json
COPY --chown=node:node --from=builder /app/node_modules /app/node_modules
COPY --chown=node:node --from=builder /app/apps/api/dist /app/apps/api/dist

# Expose port 3000 for the application server
EXPOSE 3001

# Set the NODE_ENV environment variable to production
ENV NODE_ENV=production

# Start the application server
CMD ["pnpm", "--filter", "api", "run", "start:prod"]
