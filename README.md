# FINTWIN

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

Local Qwen defaults:

- Text model: `qwen-plus`
- Vision model: `qwen-vl-plus`
- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Key env name: `QWEN_API_KEY`

## Product Focus

The main product is a personal AI Financial Digital Twin: Spending DNA, campaign readiness, what-if simulations, Emotional Delay, action center, receipt scanning, subscription leakage detection and explainable agent answers.

The KOBI features live separately under the business module: AI CFO Lite, cash flow projection, collection score and corporate decision simulation.
