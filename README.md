This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase Migrations & Environment Setup

This project uses the Supabase CLI with SQL files in `supabase/migrations/` to manage database schema changes. We run against remote Supabase projects (dev/staging/prod). No local DB is required.

### App runtime env
Create `.env.local` with your project's public keys:

```bash
PROJECT_REF=<ref>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<service-role-key>
```

See `.env.example` for the full template.

### Commands (project setup)
```bash
npm install

# 1) Ensure you are logged in
npx supabase@latest login

# 2) Link to Dev project (once)
npm run supa:link

# Create a migration
npm run migrate:new -- create_users

# Apply migrations to the linked project
npm run migrate:up

# Start the app
npm run dev
```

Notes:
- `supa:link` wraps `supabase link --project-ref <ref>` and reads `.env.local` automatically.
- `migrate:new` creates a timestamped SQL file under `supabase/migrations/`.
- `migrate:up` runs `supabase db push` against the currently linked project.

### Creating/Reverting changes
- Create: `npm run migrate:new -- <name>` then edit the generated SQL.
- Apply: `npm run migrate:up`.
- Rollback strategy: create a new "revert" migration (Supabase CLI doesn't support per-migration down). Example:

```sql
drop index if exists public.idx_users_created_at;
drop table if exists public.users;
```

### Seeding demo data

```bash
# 1) Reference + demo data (org, roles, seniority, stages, scraper, profiles, CVs, jobs).
#    Locally:  supabase db reset   (runs migrations + seed.sql)
#    Remote fresh project: supabase db reset --linked
#    (prompts for the DB password; re-applies all migrations + seed. Alternative:
#    psql "$DATABASE_URL" -f supabase/seed.sql)

# 2) Admin auth user (Fareed Zafar) + users row + roles + profile link.
#    Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY,
#    and seed.sql applied first (the organization must exist).
npm run seed:user
# or: node scripts/createUser.cjs <email> <password> <full name>
```

Both are idempotent and safe to re-run. See `supabase/database-schema.md` §8 for details.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
