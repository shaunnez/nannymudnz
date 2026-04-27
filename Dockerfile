FROM node:22-alpine
WORKDIR /app

# Copy workspace manifests so npm ci can resolve packages/* symlinks
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Full install (includes @swc-node/register for runtime TS transpilation)
RUN npm ci

# Copy source for the two packages the server needs
COPY packages/shared packages/shared
COPY packages/server packages/server

ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "@swc-node/register/esm-register", "packages/server/src/index.ts"]
