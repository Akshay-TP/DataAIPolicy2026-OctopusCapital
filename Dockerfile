# ---- Stage 1: build native modules (the SQLCipher database driver compiles from source on Alpine) ----
FROM node:24-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Fail the build now, not at runtime, if the encrypted-SQLite driver cannot load.
RUN node -e "const D=require('better-sqlite3-multiple-ciphers');new D(':memory:').close();console.log('database driver OK')"

# ---- Stage 2: small runtime image without compilers ----
FROM node:24-alpine
# Defaults make the image a ready-to-run public DEMO (synthetic data, passwordless demo sign-in,
# self-generated database key), so it deploys with no environment variables.
# For real records override: DEMO_MODE=false NODE_ENV=production ADMIN_PASSWORD DATABASE_KEY
# (compose.yaml already does this).
ENV NODE_ENV=demo DEMO_MODE=true COOKIE_SECURE=true HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend ./backend
COPY --chown=node:node database ./database
COPY --chown=node:node frontend ./frontend
COPY --chown=node:node shared ./shared
# The app writes under /app (demo keys in /app/.local) and DATA_DIR at runtime.
RUN mkdir -p /app/data /app/.local && chown node:node /app /app/data /app/.local
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "backend/server.mjs"]
