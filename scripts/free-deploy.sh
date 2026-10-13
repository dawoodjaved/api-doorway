#!/usr/bin/env bash
# Free deploy helper for APIDoorway (Vercel + Neon + Upstash)
# Prerequisites: logged-in neonctl, vercel CLI, and Upstash API creds (or skip Redis).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true

echo "==> Checking CLIs"
command -v vercel >/dev/null || { echo "Install vercel CLI: npm i -g vercel"; exit 1; }
npx neonctl --version >/dev/null || { echo "neonctl unavailable"; exit 1; }

SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
PROJECT_NAME="${PROJECT_NAME:-apidoorway}"

echo "==> Creating Neon project (if needed)"
# List or create
if ! npx neonctl projects list -o json 2>/dev/null | grep -q "$PROJECT_NAME"; then
  npx neonctl projects create --name "$PROJECT_NAME" --region-id aws-us-east-1 || \
    npx neonctl projects create --name "$PROJECT_NAME"
fi

PROJECT_ID=$(npx neonctl projects list -o json | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
const list=d.projects||d||[];
const p=list.find(x=>x.name==='$PROJECT_NAME')||list[0];
if(!p) process.exit(1);
process.stdout.write(p.id);
")
echo "Neon project: $PROJECT_ID"

DATABASE_URL=$(npx neonctl connection-string "$PROJECT_ID" --pooled -o json 2>/dev/null | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
process.stdout.write(d.uri||d.connection_uri||d||'');
" || npx neonctl connection-string "$PROJECT_ID" --pooled)

if [ -z "$DATABASE_URL" ]; then
  echo "Failed to get DATABASE_URL"
  exit 1
fi
echo "DATABASE_URL acquired"

echo "==> Prisma generate / push"
export DATABASE_URL
npx prisma generate
npx prisma db push

if [ "${ALLOW_DEMO_SEED:-}" = "true" ]; then
  echo "==> Seeding demo users (ALLOW_DEMO_SEED=true) — change passwords immediately"
  ALLOW_DEMO_SEED=true NODE_ENV=production npm run db:seed
  npm run db:approve
else
  echo "==> Skipping demo seed (set ALLOW_DEMO_SEED=true only for disposable demos)"
fi

REDIS_URL="${REDIS_URL:-}"
if [ -z "$REDIS_URL" ]; then
  echo "WARN: REDIS_URL not set — app will use memory fallback on Vercel"
fi

echo "==> Linking / deploying on Vercel"
vercel link --yes --project "$PROJECT_NAME" || true

# Set env vars (production)
printf '%s' "$DATABASE_URL" | vercel env add DATABASE_URL production --force || true
printf '%s' "$SECRET" | vercel env add NEXTAUTH_SECRET production --force || true
printf '%s' "$SECRET" | vercel env add AUTH_SECRET production --force || true
if [ -n "$REDIS_URL" ]; then
  printf '%s' "$REDIS_URL" | vercel env add REDIS_URL production --force || true
fi

# Deploy first to get URL
URL=$(vercel deploy --prod --yes 2>&1 | tee /tmp/vercel-deploy.out | grep -Eo 'https://[^ ]+\.vercel\.app' | tail -1)
if [ -z "$URL" ]; then
  URL=$(grep -Eo 'https://[^ ]+\.vercel\.app' /tmp/vercel-deploy.out | tail -1 || true)
fi
echo "Deploy URL: $URL"

if [ -n "$URL" ]; then
  printf '%s' "$URL" | vercel env add NEXTAUTH_URL production --force || true
  vercel deploy --prod --yes
fi

echo "==> Done"
echo "Open: $URL"
echo "Health: $URL/api/health"
if [ "${ALLOW_DEMO_SEED:-}" = "true" ]; then
  echo "WARNING: Demo seed was enabled — rotate demo passwords immediately."
fi
