# plango AI

Multi-agent family grocery OS for Sri Lanka — Next.js frontend with Gemini-powered meal planning and Supabase-ready backend.

## Stack

- **Next.js 15** (App Router) — deploy to Vercel
- **Supabase** — auth & database (client wired, ready for tables)
- **Gemini** — multi-agent meal plan orchestration via `/api/plan`
- **Tailwind CSS 4**

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` (or use the existing `.env`) and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add the same environment variables from `.env`
4. Deploy — Vercel auto-detects Next.js

## Project structure

```
app/
  page.tsx          # Main dashboard (migrated from Vite App.tsx)
  api/plan/         # Gemini meal planning endpoint
  api/health/       # Health + Supabase connectivity check
components/         # UI panels (inventory, agents, MiroFish, etc.)
lib/
  mockData.ts       # Seed data for demo
  plan-engine.ts    # Agent orchestration + Gemini/fallback logic
  supabase/         # Browser + server Supabase clients
```

## API

`POST /api/plan` — body:

```json
{
  "prompt": "Plan 3 dinners, diabetic-friendly, no fish",
  "budgetLkr": 5000,
  "inventory": [],
  "family": [],
  "prices": [],
  "weather": {},
  "traffic": {},
  "crisis": {}
}
```

Returns recipes, shopping list, savings, and agent execution logs.
