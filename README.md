# FINSHADOW

AI-powered Financial Digital Twin platform for personal finance first, with a separate KOBI/AI CFO module.

## Stack

- Web: Next.js
- Mobile: Expo React Native, iOS first and Android-compatible
- Backend: NestJS
- DB: PostgreSQL with Prisma schema
- AI: LangChain + LangGraph with Gemini API
- OCR: Gemini Vision structured output
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

## Product Focus

The main product is a personal AI Financial Digital Twin: Spending DNA, campaign readiness, what-if simulations, Emotional Delay, action center, receipt scanning, subscription leakage detection and explainable agent answers.

The KOBI features live separately under the business module: AI CFO Lite, cash flow projection, collection score and corporate decision simulation.
