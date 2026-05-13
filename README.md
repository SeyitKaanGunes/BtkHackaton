# Fintwin

AI-powered Financial Digital Twin platform for personal finance first, with a separate KOBI/AI CFO module.

## Stack

- Web: Next.js
- Mobile: React Native CLI, iOS first and Android-compatible
- Backend: NestJS
- DB: PostgreSQL with Prisma schema
- AI: LangChain + LangGraph with Qwen API (DashScope OpenAI-compatible)
- OCR: Qwen multimodal structured JSON output
- Auth: JWT plus web Google sign-in via Google Identity Services
- Notifications: Firebase Cloud Messaging placeholders
- Charts: Recharts on web

## Local Setup

```bash
npm install
npm run dev:local
npm run dev:mobile
```

`npm run dev:local` starts the API on `http://localhost:4000` and the web app on `http://localhost:3000`. On startup it clears stale Fintwin dev processes on ports 3000/4000, then prints readiness lines for both services. Use `npm run dev:local -- --no-clean` only when you intentionally want to keep already-running dev processes.

Never commit `.env` files. Only `.env.example` files belong in git.

Demo fallbacks are disabled. Web and mobile must call the API, and the API must connect to PostgreSQL through `DATABASE_URL`/`DIRECT_URL`; missing env values should fail startup/build instead of rendering local demo data.

## Production Env

Use `.env.production.example` as the deployment checklist. For the API, these values are required when `NODE_ENV=production`:

- `DATABASE_URL`: Supabase transaction pooler URI, used by the running API.
- `DIRECT_URL`: Supabase direct/session-pooler URI, used by Prisma schema pushes.
- `JWT_SECRET`: a random secret with at least 32 characters.
- `API_CORS_ORIGINS`: comma-separated web origins allowed to call the API.
- `QWEN_API_KEY`: required for production AI/OCR flows.
- `TWELVE_DATA_API_KEY`: required for production portfolio market data.
- `GOOGLE_OAUTH_CLIENT_ID`: Google OAuth Web Client ID used by the API to verify web `id_token` values.
- `OPENAI_API_KEY`: required for production speech-to-text.
- `GEMINI_API_KEY`: required for production text-to-speech. `GOOGLE_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` can be used by the API service instead.

For the web app, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be the same Google OAuth Web Client ID configured as `GOOGLE_OAUTH_CLIENT_ID` on the API.
The Google OAuth web client must allow `http://localhost:3000` as a JavaScript origin for local development and `http://localhost:3000/login/google` as a redirect URI for the redirect-based sign-in flow.
Local web auth is best started with `npm run dev:local`; `apps/web/next.config.mjs` also loads the repo-root `.env` so `npm run dev:web` can see `NEXT_PUBLIC_GOOGLE_CLIENT_ID` when it is run by itself.
The web app stores the session JWT in an HttpOnly `fintwin_token` cookie through `/api/auth/*` routes. Browser-side API calls go through `/api/backend/*`, which attaches that cookie server-side instead of reading a token from `localStorage`.
The `admin` / `admin` development account is only for local demos; `admin@local.dev` sign-in and registration are rejected when `NODE_ENV=production`.

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Before deploy, generate Prisma Client and push the current schema:

```bash
npm run db:generate
npm run db:push
```

Frontend deployments only need the public API URL:

- Web: `NEXT_PUBLIC_API_URL="https://your-api-domain.com"` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID="<your-google-oauth-web-client-id>"`
- Mobile build env: `EXPO_PUBLIC_API_URL="https://your-api-domain.com"`

Qwen defaults:

- Primary text model: `qwen3.6-flash-2026-04-16`
- Primary vision model: `qwen3.6-flash-2026-04-16`
- Secondary model: `qwen3.6-flash`
- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Key env name: `QWEN_API_KEY`
- Provider limits to keep in mind: 1M context window, 991K maximum input, 64K maximum output, 60 RPM, 1,000,000 TPM.

The API currently uses Qwen through the OpenAI-compatible DashScope endpoint. Future Gemini migration should change this provider layer rather than spreading Gemini-specific calls across controllers or agents.

Market data defaults:

- Provider: Twelve Data
- Key env name: `TWELVE_DATA_API_KEY`
- Portfolio API: `GET /investments/portfolio`, `GET /investments/symbols?query=THYAO`, `POST /investments/holdings`
- Quote cache: 24 hours for successful provider responses only. If the provider/key is unavailable, portfolio positions are explicitly marked unpriced; the app does not calculate profit/loss from static fallback quotes.

## Product Focus

The main product is a personal AI Financial Digital Twin: Spending DNA, campaign readiness, what-if simulations, Emotional Delay, action center, receipt scanning, subscription leakage detection and explainable agent answers.

The KOBI features live separately under the business module: AI CFO Lite, cash flow projection, collection score and corporate decision simulation.

## Document Agents

- `Receipt Agent`: `POST /documents/receipt-agent/import` reads a receipt image, detects merchant, amount, tax, date, payment method and category, then adds one expense transaction.
- `Statement Agent`: `POST /documents/statement-agent/preview` reads an end-of-month statement PDF/image/text and returns categorized spending rows for review; `POST /documents/statement-agent/confirm` adds the selected rows as expense transactions.
- Subscription reminders: `POST /actions/subscription-reminder` creates a dated pending action from recurring subscriptions detected in the statement analysis.

Document agents require `QWEN_API_KEY`; they no longer return demo receipt or statement results when the key or input document is missing.
