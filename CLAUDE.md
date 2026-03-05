# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000

# Build & Production
npm run build
npm run start

# Linting & Formatting
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run format:check # Prettier (check only)
```

There are no automated tests in this project.

## Architecture

**Smart Infra Cost** is a Next.js 16 app for tracking and allocating infrastructure costs across clients. It uses Supabase as the backend (auth + database).

### Route Structure

- `/` — Public landing, redirects authenticated users
- `/login`, `/register`, `/change-password` — Auth pages
- `/app/*` — Protected app area (requires auth via `requireAuth()` in layout)
  - `/app/clients` — Client management
  - `/app/applications` — Application/SaaS cost entries
  - `/app/aws` — AWS cost reports
  - `/app/transactions` — Transaction cost management
  - `/app/costs` — Monthly cost management
  - `/app/reports` — Cost distribution reports
  - `/app/users` — User management (Owner role only, enforced by layout)
- `/api/users/*` — REST API routes for user CRUD (uses admin Supabase client)

### Key Architectural Patterns

**Auth & Authorization** (`lib/auth.ts`, `lib/roles.ts`):
- Two roles stored in Supabase `user_metadata.role`: `owner` and `admin`
- Route protection happens in Next.js layouts via `requireAuth()` or `requireOwner()`
- `requireOwner()` redirects non-owners to `/app/reports`

**Supabase Clients** (`lib/supabase/`):
- `server.ts` — SSR client using cookies, for Server Components and route handlers
- `client.ts` — Browser client for Client Components
- `admin.ts` — Service role client (bypasses RLS), only used in `/api/*` routes. Requires `SUPABASE_SERVICE_ROLE_KEY` env var.

**Repository Pattern** (`lib/repositories/`):
- All DB access goes through typed repository classes (e.g., `ClientsRepository`, `ApplicationsRepository`)
- Each repository takes a `SupabaseClient` as a constructor argument
- Exported from `lib/repositories/index.ts`

**UI Components** (`components/ui/`):
- Shared primitives: `Button`, `Card`, `Input`, `Label`, `Table`, `PageHeader`, `LoadingSpinner`, `ErrorMessage`, `DateRangePicker`, `PasswordInput`
- All exported from `components/ui/index.ts`

**i18n** (`lib/i18n/`):
- Spanish-only UI using a custom `useTranslation` hook
- Translations live in `lib/i18n/translations.json`
- Use `const { t } = useTranslation()` in Client Components

**Types** (`types/index.ts`):
- All shared TypeScript types in one file

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY   # Required for /api/users/* routes only
```

### Code Style

Prettier config: no semicolons, single quotes, 2-space indent, trailing commas (ES5), 80 char line width.
