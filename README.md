# APIDoorway

API marketplace where providers publish APIs, admins approve them, and developers discover, subscribe, and call APIs through a keyed gateway.

## Features

- Browse and search APIs (score, filters, compare)
- API detail pages with docs, code examples, and reviews
- Developer dashboard: API keys, playground, usage, billing
- Provider tools: OpenAPI import, versions, changelog
- Admin approval and featured listings
- Gateway with API-key auth, rate limits, and caching
- Stripe billing (Free / Pro)

## Tech stack

- **Frontend / App:** Next.js 14, React, TypeScript, Tailwind CSS
- **Database:** PostgreSQL + Prisma
- **Auth:** NextAuth.js
- **Payments:** Stripe
- **Cache / rate limits:** Redis (optional; works without it locally)

## Getting started

**Requirements:** Node.js 18+, PostgreSQL

```bash
git clone <repository-url>
cd api-arena
npm install
cp .env.example .env
```

Set at least these in `.env`:

- `DATABASE_URL`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
- `NEXTAUTH_URL=http://localhost:3000`

Then:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Seed logins** (local/dev only — never use these in a shared or production database)

| Role | Email | Password |
|------|-------|----------|
| Developer | `dev@apidoorway.local` | `user1234` |

Production seed is blocked unless `ALLOW_DEMO_SEED=true`.

## Security notes

- Keep `.env` / `.env.local` out of git. If any secret was previously hardcoded or shared, **rotate it immediately** (`NEXTAUTH_SECRET` / `AUTH_SECRET`, database password, OAuth secrets, Stripe keys, Redis, `CRON_SECRET`).
- Set `CRON_SECRET` before enabling cron. Admin catalog sync requires an admin session.

## Commit and push

Use short, meaningful commit messages that explain **why** you changed something.

```bash
# see what changed
git status
git diff

# stage files
git add .

# commit with a clear message
git commit -m "Add API playground request history"

# push to remote
git push origin <your-branch>
```

**Good commit message examples**

- `Fix gateway rate limit when Redis is offline`
- `Add OpenAPI import for YAML specs`
- `Simplify marketplace filters UI`
- `Update README with setup and push steps`

**Avoid**

- `update`
- `fix`
- `changes`
- `asdf`
