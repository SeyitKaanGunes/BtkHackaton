# Production Runbook

This is the minimal production checklist for the current Supabase-only setup.

## Deploy Order

1. Set API env from `.env.production.example`.
2. Generate Prisma Client:

```bash
npm run db:generate
```

3. Apply committed migrations:

```bash
npm run db:migrate:deploy
```

4. Deploy API and verify:

```bash
curl https://<api-domain>/health
curl https://<api-domain>/ready
```

5. Deploy web with:

```bash
NEXT_PUBLIC_API_URL=https://<api-domain>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-web-client-id>
```

## Existing Supabase Database From `db push`

The canonical path is now Prisma migrations. If a database already has the schema from an earlier `db push`, choose one explicit recovery path:

- Preferred for empty/non-critical data: reset the Supabase database, then run `npm run db:migrate:deploy`.
- If the schema must be kept: verify the live schema matches `apps/api/prisma/schema.prisma`, then mark the initial migration as applied:

```bash
npx prisma migrate resolve --applied 20260513120000_init --schema apps/api/prisma/schema.prisma
npm run db:migrate:status
```

Do not run `prisma db push` against production.

## Google OAuth

Use a Google OAuth Web Client ID for both API and web.

Google Cloud Console settings:

- OAuth consent screen app name: `FinTwin`
- Authorized domains: production web domain, for example `fintwin.example.com`
- Authorized JavaScript origins:
  - `http://localhost:3000`
  - `https://<web-domain>`
- Authorized redirect URIs:
  - `http://localhost:3000/login/google`
  - `https://<web-domain>/login/google`

Environment mapping:

- API: `GOOGLE_OAUTH_CLIENT_ID=<web-client-id>`
- Web: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same-web-client-id>`

After changing OAuth settings, wait a few minutes before retesting because Google settings can propagate slowly.

## Reminder And FCM Decision

Current canonical behavior:

- Subscription reminders create dated in-app `ActionItem` records.
- Action Center is the source of truth for reminders.
- FCM token registration is accepted and stored, but push delivery is not active until a Firebase service account and scheduled worker are added.

Do not present push notifications as active product behavior until the worker exists. A minimal future worker should:

1. Query pending `calendar_bill` actions where `dueAt <= now`.
2. Send one FCM notification per active user token.
3. Mark delivery metadata, or fail visibly in logs.
4. Avoid retrying indefinitely without a retry limit.

## Backup And Restore

Supabase dashboard path:

1. Project settings
2. Database
3. Backups

Manual backup with a direct/session-pooler connection:

```bash
pg_dump "$DIRECT_URL" --format=custom --file=fintwin-$(date +%Y%m%d).dump
```

Restore into a clean target database:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DIRECT_URL" fintwin-YYYYMMDD.dump
npm run db:migrate:status
```

Test restore before relying on a backup. A backup that has never been restored is not proven.

## User Data Export

Use the user id from the `User` table and export related rows:

```sql
select * from "User" where id = '<user-id>';
select * from "Account" where "userId" = '<user-id>';
select * from "Transaction" where "userId" = '<user-id>';
select * from "Budget" where "userId" = '<user-id>';
select * from "Goal" where "userId" = '<user-id>';
select * from "Subscription" where "userId" = '<user-id>';
select * from "ActionItem" where "userId" = '<user-id>';
select * from "Document" where "userId" = '<user-id>';
select * from "Simulation" where "userId" = '<user-id>';
select * from "AgentConversation" where "userId" = '<user-id>';
select * from "InvestmentHolding" where "userId" = '<user-id>';
select * from "FcmToken" where "userId" = '<user-id>';
select * from "Business" where "ownerId" = '<user-id>';
```

Business child rows need the exported business ids:

```sql
select * from "BusinessCustomer" where "businessId" in ('<business-id>');
select * from "BusinessCashEvent" where "businessId" in ('<business-id>');
```

## User Data Deletion

Deletion must run inside a transaction and remove child rows before `User`:

```sql
begin;
delete from "BusinessCashEvent" where "businessId" in (select id from "Business" where "ownerId" = '<user-id>');
delete from "BusinessCustomer" where "businessId" in (select id from "Business" where "ownerId" = '<user-id>');
delete from "Business" where "ownerId" = '<user-id>';
delete from "FcmToken" where "userId" = '<user-id>';
delete from "InvestmentHolding" where "userId" = '<user-id>';
delete from "AgentConversation" where "userId" = '<user-id>';
delete from "Simulation" where "userId" = '<user-id>';
delete from "Document" where "userId" = '<user-id>';
delete from "ActionItem" where "userId" = '<user-id>';
delete from "Subscription" where "userId" = '<user-id>';
delete from "Goal" where "userId" = '<user-id>';
delete from "Budget" where "userId" = '<user-id>';
delete from "Transaction" where "userId" = '<user-id>';
delete from "Account" where "userId" = '<user-id>';
delete from "User" where id = '<user-id>';
commit;
```

Run a backup before deletion.
