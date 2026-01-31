# PlanetF1 (and other Playwright) tests in Docker – same Linux env as CI
# CI=1 so we use default browser cache (no project path); browsers installed after npm ci
FROM node:20-bookworm-slim

WORKDIR /app

ENV CI=1

# App deps (includes @playwright/test)
COPY package.json package-lock.json ./
RUN npm ci

# App code
COPY . .

# Playwright system deps + Chromium (same as CI)
RUN npx playwright install --with-deps chromium

# Default: run PlanetF1 test (override: docker run ... npm run test:planetf1:quick)
CMD ["npm", "run", "test:planetf1"]
