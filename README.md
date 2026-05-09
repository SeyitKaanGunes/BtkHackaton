# Fintwin

AI-powered Financial Digital Twin platform for personal finance first, with a separate KOBI/AI CFO module.

## Stack

- Web: Next.js
- Mobile: React Native CLI, iOS first and Android-compatible
- Backend: NestJS
- DB: PostgreSQL with Prisma schema
- AI: LangChain + LangGraph with Qwen API (DashScope OpenAI-compatible)
- OCR: Qwen-VL structured JSON output
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

Local Qwen defaults:

- Text model: `qwen-plus`
- Vision model: `qwen-vl-plus`
- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Key env name: `QWEN_API_KEY`

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
- `Statement Agent`: `POST /documents/statement-agent/import` reads an end-of-month statement image/text, extracts monthly spending rows, categorizes each row and adds them as expense transactions.
- Subscription reminders: `POST /actions/subscription-reminder` creates a dated pending action from recurring subscriptions detected in the statement analysis.

Document agents require `QWEN_API_KEY`; they no longer return demo receipt or statement results when the key or input document is missing.
