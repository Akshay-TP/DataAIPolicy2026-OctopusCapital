FROM node:24-alpine
# Defaults describe a private production workspace. For a public demo, override
# DEMO_MODE=true and NODE_ENV (anything but "production"); see render.yaml.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data DEMO_MODE=false
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
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
