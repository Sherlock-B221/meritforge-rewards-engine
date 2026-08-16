# meritforge frontend — Next.js 15 + Node 20, three-stage build.
# `deps` installs pinned dependencies once (cached unless package*.json change);
# `builder` reuses that layer to produce the production build; `runner` copies
# only the built output + pruned node_modules, keeping the final image lean.
# NEXT_PUBLIC_API_URL must be a build ARG (not just a runtime env var) because
# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time.
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
