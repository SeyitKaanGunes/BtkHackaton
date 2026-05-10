# Fintwin

AI-powered Financial Digital Twin platform for personal finance first, with a separate KOBI/AI CFO module.

## Stack

- Web: Next.js
- Mobile: React Native CLI, iOS first and Android-compatible
- Backend: NestJS
- DB: PostgreSQL with Prisma schema
- AI: LangChain + LangGraph with Qwen API (DashScope OpenAI-compatible)
- OCR: Qwen multimodal structured JSON output
- Auth: JWT with Google OAuth placeholders
- Notifications: Firebase Cloud Messaging placeholders
- Charts: Recharts on web

## Local Setup

```bash
npm install
docker compose up -d
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Never commit `.env` files. Only `.env.example` files belong in git.

Demo fallbacks are opt-in. Web and mobile call the API by default and surface API errors instead of silently rendering local demo data. For an offline demo, set:

- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`
- `EXPO_PUBLIC_ENABLE_DEMO_FALLBACK=true`

## Production Env

Use `.env.production.example` as the deployment checklist. For the API, these values are required when `NODE_ENV=production`:

- `DATABASE_URL`: Supabase transaction pooler URI, used by the running API.
- `DIRECT_URL`: Supabase direct/session-pooler URI, used by Prisma schema pushes.
- `JWT_SECRET`: a random secret with at least 32 characters.
- `API_CORS_ORIGINS`: comma-separated web origins allowed to call the API.
- `QWEN_API_KEY`: required for production AI/OCR flows.

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

- Web: `NEXT_PUBLIC_API_URL="https://your-api-domain.com"`
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
- Quote cache: 24 hours, with fallback demo prices when the provider is unavailable

## Product Focus

The main product is a personal AI Financial Digital Twin: Spending DNA, campaign readiness, what-if simulations, Emotional Delay, action center, receipt scanning, subscription leakage detection and explainable agent answers.

The KOBI features live separately under the business module: AI CFO Lite, cash flow projection, collection score and corporate decision simulation.

## Document Agents

- `Receipt Agent`: `POST /documents/receipt-agent/import` reads a receipt image, detects merchant, amount, tax, date, payment method and category, then adds one expense transaction.
- `Statement Agent`: `POST /documents/statement-agent/preview` reads an end-of-month statement PDF/image/text and returns categorized spending rows for review; `POST /documents/statement-agent/confirm` adds the selected rows as expense transactions.
- Subscription reminders: `POST /actions/subscription-reminder` creates a dated pending action from recurring subscriptions detected in the statement analysis.

Document agents require `QWEN_API_KEY`; they no longer return demo receipt or statement results when the key or input document is missing.
