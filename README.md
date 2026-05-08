# FINTWIN

AI-powered Financial Digital Twin platform for personal finance first, with a separate KOBI/AI CFO module.

## Stack

- Web: Next.js
- Mobile: React Native CLI, iOS first and Android-compatible
- Backend: NestJS
- DB: PostgreSQL with Prisma schema
- AI: LangChain + LangGraph with Qwen API for pre-production, Gemini-ready env placeholders for production
- OCR: Qwen OpenAI-compatible structured extraction in pre-production, Gemini Vision-ready for production
- Auth: JWT with Google OAuth placeholders
- Notifications: Firebase Cloud Messaging placeholders
- Charts: Recharts on web

## Local Setup

```bash
npm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Never commit `.env` files. Only `.env.example` files belong in git.

Pre-production LLM defaults:

- Primary model: `qwen3.6-flash-2026-04-16`
- Fallback model: `qwen3.6-flash`
- Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- Key env name: `QWEN_API_KEY`

## Product Focus

The main product is a personal AI Financial Digital Twin: Spending DNA, campaign readiness, what-if simulations, Emotional Delay, action center, receipt scanning, subscription leakage detection and explainable agent answers.

The KOBI features live separately under the business module: AI CFO Lite, cash flow projection, collection score and corporate decision simulation.
