# Videora AI

A full-stack SaaS platform for generating professional videos with AI —
describe an idea, get a script, storyboard, AI-generated scenes, voiceover,
captions and music, then edit and export. Built with Next.js, TypeScript,
Prisma and a provider-abstraction architecture so real AI/video/voice APIs
can be plugged in without touching the rest of the app.

This is a real, working application — authentication, a Postgres/SQLite
database, a credit system, background job processing, and a full product
UI — not a static mockup. It runs end-to-end today in **Demo Mode**, using
deterministic mock AI/video/voice providers, so you can try every screen
before connecting any paid API.

## 1. What was built

- **Landing page** — hero, feature sections, pricing, independent from the app.
- **Auth** — email/password (bcrypt), optional Google OAuth, forgot/reset
  password, protected routes via middleware, persistent sessions (NextAuth).
- **Dashboard** — sidebar navigation, credits pill, quick-create cards, recent
  projects.
- **Create flow** (`/create`) — describe your video, pick type/style/duration/
  aspect ratio/language, upload product photos, then:
  - **AI script** (`/projects/[id]/script`) — scene-by-scene script, regenerate
    or edit inline.
  - **Storyboard** (`/projects/[id]/storyboard`) — per-scene visual/voice/prompt
    editing, reorder, duplicate, delete, regenerate, music selection.
  - **Generation progress** (`/projects/[id]/generate`) — live progress through
    Analyzing → Script → Storyboard → Scenes → Voice → Captions → Render →
    Finalize, backed by a real background job (works even if you close the tab
    and come back later), with cancel + credit refund.
- **Editor** (`/editor/[videoId]`) — tools (Scenes, Text, Captions, Voice,
  Music, Images, Effects), center preview, timeline, live caption/effect
  preview, export dialog (720p/1080p, MP4, aspect ratio) with download.
- **My Videos** (`/videos`) — search, filter by status, open/duplicate/rename/
  delete/download.
- **Templates** (`/templates`) — public gallery, "Use template" seeds a new
  project.
- **Brand Kit** (`/brand-kit`) — logo, colors, fonts, company/social info.
- **Assets** (`/assets`) — reusable product photo library.
- **Credits & billing** (`/credits`) — balance, plans, transaction history,
  Stripe-ready checkout (falls back to a demo upgrade when Stripe isn't
  configured).
- **Settings** — profile, password change, sign out.
- **Admin panel** (`/admin`, role-gated) — platform stats, user management
  (disable, change plan, grant credits), generation log with errors.
- **Provider abstractions** — `AIProvider`, `VideoProvider`, `VoiceProvider`,
  `StorageProvider`, each with a `Mock*` and `Real*` implementation selected
  automatically based on environment variables (see below).
- **Credits system** — `CreditBalance` + `CreditTransaction`, atomic
  deduction (never goes negative), refunds on failure/cancel.
- **Background jobs** — generation runs as an async pipeline persisted in the
  `Generation` table, polled by the client — no long-running HTTP requests.

## 2. Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS,
  a small hand-built shadcn/ui-style component kit (Radix primitives + CVA).
- **Backend:** Next.js Route Handlers (API routes), TypeScript.
- **Database:** Prisma ORM with PostgreSQL (Vercel Postgres, Neon, Supabase,
  RDS, or local Postgres all work). Swappable to SQLite for zero-infra local
  dev with a one-line change (see below).
- **Auth:** NextAuth.js (credentials + optional Google), JWT sessions.
- **Storage:** local disk in dev, pluggable S3/Supabase-compatible adapter.
- **Jobs:** in-process async pipeline (see production note below).
- **Video:** demo clips are short local MP4s; architecture is ready for
  server-side FFmpeg composition when you plug in a real render step.

## 3. Running it locally

```bash
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL to a Postgres connection string
# (e.g. a free instance from neon.tech or Vercel Postgres)
npx prisma db push          # creates the schema in your database
npm run db:seed             # demo users, projects, templates
npm run dev
```

Prefer not to set up Postgres for local dev? Change `provider = "postgresql"`
to `provider = "sqlite"` in `prisma/schema.prisma`, set
`DATABASE_URL="file:./dev.db"` in `.env`, then run the same commands above —
zero external services needed. Just remember to switch it back to
`"postgresql"` before deploying.

Open http://localhost:3000. Log in with:

- **Demo user:** `demo@videora.ai` / `demo1234`
- **Admin user:** `admin@videora.ai` / `admin1234`

Or register your own account (starts with 100 free credits).

Other useful scripts: `npm run build`, `npm run typecheck`,
`npm run db:studio` (Prisma Studio), `npm run db:migrate` (proper migrations
instead of `db push`).

## 4. Environment variables

See `.env.example` for the full, commented list. Nothing is required to run
in Demo Mode — `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` and `AUTH_SECRET` are
the only variables you truly need locally, and the file already ships with
working defaults for those.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string (SQLite file or Postgres URL) |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used in links/redirects |
| `AUTH_SECRET` | Session signing secret |
| `DEMO_MODE` | Forces mock providers even if API keys are set |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google login |
| `AI_API_KEY` / `AI_MODEL` / `AI_API_URL` | Script-writing LLM |
| `VIDEO_API_KEY` / `VIDEO_API_URL` | Video generation provider |
| `VOICE_API_KEY` / `VOICE_API_URL` | Text-to-speech provider |
| `STORAGE_URL` / `STORAGE_KEY` | Object storage for uploads (else local disk) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_CREATOR` / `STRIPE_PRICE_ID_PRO` | Subscriptions |

**No API key is ever hardcoded.** Every external call reads its key from
`process.env` on the server only; nothing is exposed to the browser.

## 5. What APIs do I need for real video generation?

None to try the product — Demo Mode covers the whole flow. When you're ready
to go live, you need three kinds of providers (any vendor that fits the
shape below works, since the app talks to an interface, not a specific SDK):

1. **A text/image-to-video API** (e.g. Runway, Luma Dream Machine, Pika,
   Kling, or your own model server) → `VIDEO_API_KEY` / `VIDEO_API_URL`.
2. **An LLM for script writing** (OpenAI-compatible chat completions —
   OpenAI, Azure OpenAI, or a self-hosted model) → `AI_API_KEY` / `AI_MODEL`
   / `AI_API_URL`.
3. **A text-to-speech API** (e.g. ElevenLabs, Azure Speech, Google TTS) →
   `VOICE_API_KEY` / `VOICE_API_URL`.

## 6. How to connect a real provider

Each provider lives under `lib/providers/<kind>/`:

```
lib/providers/video/
  types.ts   -> the VideoProvider interface (generateVideo, getGenerationStatus, downloadVideo, cancelGeneration)
  mock.ts    -> MockVideoProvider (used today)
  real.ts    -> RealVideoProvider (calls VIDEO_API_URL with VIDEO_API_KEY)
  index.ts   -> getVideoProvider() picks Mock vs Real based on env vars
```

To connect a real vendor:

1. Set `VIDEO_API_KEY` / `VIDEO_API_URL` (and set `DEMO_MODE=false`).
2. Open `lib/providers/video/real.ts` and adjust the request/response field
   names to match your chosen vendor's actual REST API (the file documents
   the expected shape — most vendors follow a create → poll → download
   pattern very close to what's already there).
3. That's it — no other file changes. `lib/jobs/pipeline.ts`,
   `/create`, the storyboard, and the editor all consume the interface, not
   the vendor.

The same pattern applies to `lib/providers/ai/real.ts` (LLM),
`lib/providers/voice/real.ts` (TTS) and `lib/providers/storage/real.ts`
(S3/Supabase Storage).

## 7. Demo Mode

`DEMO_MODE=true` (the default) forces every provider to its mock
implementation regardless of whether API keys are set — useful for staging/
QA environments where you don't want to spend real credits. Set it to
`false` once real keys are configured to go live; providers still fall back
to mocks automatically for any provider whose keys are missing, so you can
turn providers on one at a time.

## 8. Renaming / rebranding

Edit `lib/config.ts`:

```ts
export const APP_CONFIG = {
  name: "Videora AI",
  tagline: "Create professional videos with AI",
  ...
};
```

This flows through the landing page, dashboard, page titles and metadata.
For the logo mark, edit `app/icon.svg` (favicon) and the inline logo mark
used in `components/marketing/navbar.tsx`, `components/dashboard/sidebar.tsx`
and `app/(auth)/layout.tsx` (search for the `Sparkles` icon in a gradient
square — swap for your own mark or an `<img>`).

## 9. Deploying to production

1. **Database:** provision a Postgres instance (Vercel Postgres, Neon,
   Supabase, RDS, etc) and set `DATABASE_URL`. The schema already targets
   `provider = "postgresql"`. Run `npx prisma migrate dev` locally to create
   a migration, commit it, and run `npx prisma migrate deploy` (or
   `prisma db push` for a quick first deploy) as part of your build/release
   step.
2. **Environment variables:** set all of `.env.example` on your host
   (Vercel/Render/Fly/your own server). Generate a strong `AUTH_SECRET`.
3. **File storage:** on serverless hosts, local disk uploads
   (`lib/providers/storage/local.ts`) don't persist — configure
   `STORAGE_URL` / `STORAGE_KEY` (S3-compatible or Supabase Storage) before
   going live.
4. **Background jobs:** `lib/jobs/pipeline.ts` currently runs generation as
   an in-process async task, which is fine for a long-running Node process
   (`next start`, a VM, a container) but can be interrupted on serverless
   platforms that freeze functions after the response is sent. For that kind
   of deployment, swap the job runner for a real queue (BullMQ + Redis,
   Inngest, Trigger.dev, QStash, etc) — every call goes through
   `startGeneration()` in that one file, so only it needs to change.
5. **Stripe:** set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_ID_CREATOR`, `STRIPE_PRICE_ID_PRO`, and point a Stripe
   webhook at `https://<your-domain>/api/stripe/webhook`.
6. Build with `npm run build` and start with `npm run start`.

## Project structure

```
app/                 Next.js App Router pages + API routes
  (auth)/             login, register, forgot/reset password
  (dashboard)/         sidebar app: dashboard, create, projects, videos,
                        templates, assets, brand-kit, credits, settings, admin
  (studio)/editor/      full-screen video editor
  api/                 route handlers (REST-style JSON endpoints)
components/           UI components (ui/, marketing/, dashboard/, create/, ...)
lib/
  providers/           ai/, video/, voice/, storage/ — Mock + Real adapters
  jobs/pipeline.ts      background generation pipeline
  credits.ts            credit deduction/refund logic
  auth.ts                NextAuth configuration
  config.ts              branding config (name, plans, pricing)
  validations.ts          zod schemas for all inputs
prisma/
  schema.prisma          data model
  seed.ts                 demo data
```

## Security notes

- All API keys are server-only env vars, never sent to the client.
- Passwords are hashed with bcrypt; reset tokens are single-use and expire.
- All mutating API routes check the authenticated session and ownership
  before touching data; admin routes additionally check `role === "ADMIN"`.
- Uploads are validated by MIME type and size (8MB, JPG/PNG/WEBP only).
- Sensitive endpoints (register, login, forgot-password, generation,
  uploads) are rate-limited per IP/user.
- Credits can never go negative — deduction is a single DB transaction that
  checks balance first.
