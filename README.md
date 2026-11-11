# GTK BusinessOS

GTK BusinessOS is a multi-tenant business operations platform for Zimbabwean
businesses. It brings sales, inventory, purchasing, finance, payroll, and
business reporting into one application.

## Features

- **Sales:** quotations, invoices, customer payments, balances, and PDF
  downloads. Accepted quotations can be converted into invoices.
- **Customers and inventory:** customer histories, stock movements, product
  costs, stock valuation, and low-stock visibility.
- **Purchasing and finance:** suppliers, purchase orders and bills, payables,
  financial accounts and transfers, expenses, and reconciliation workflows.
- **Payroll:** employee records, effective-dated salary components and
  statutory rules, payroll runs and approvals, audited corrections, payslips,
  and payroll reports. Payroll rates are not preloaded; configure applicable
  rates from verified current guidance before approving a run.
- **Reports and dashboard:** sales, collections, expenses, profitability,
  debtors, inventory, and payroll summaries.
- **Roles and audit trail:** business-scoped access for owners, administrators,
  managers, salespeople, cashiers, inventory officers, finance staff, payroll
  administrators, and employees. Access is checked on the server.
- **Multi-currency records:** transactions retain their original currency and
  exchange-rate details so historical amounts are not recalculated using
  today's rates.
- **Business Copilot:** ask questions about business data using the Anthropic
  API. This feature requires an `ANTHROPIC_API_KEY`.
- **Installable web app:** includes a web manifest and icon. Offline use is not
  currently supported.
- **Trial and plans:** supports a 30-day trial and plan information. Subscription
  payments are not connected to a payment processor.

## Technology

- Next.js 14 App Router and React 18
- TypeScript and Tailwind CSS
- PostgreSQL with Prisma ORM
- NextAuth credentials authentication
- PDF generation with `pdf-lib`

## Requirements

- Node.js 20.9 or newer
- npm
- A PostgreSQL database

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` (for example, run `Copy-Item .env.example .env`
   in PowerShell or `cp .env.example .env` in a POSIX shell) and set the values
   for your environment.

3. Apply the database migrations. To optionally load local demo data, first
   set `SEED_OWNER_PASSWORD` in `.env` to a development-only password, then run:

   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

   The seed creates an **Example Hardware** business with fictional demo
   records and the login `owner@example.test`. The seed refuses to run when
   `NODE_ENV` is `production`; never use demo data or credentials in production.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the application. |
| `DIRECT_URL` | Direct PostgreSQL connection used by Prisma migrations when a pooled URL is configured. |
| `NEXTAUTH_SECRET` | Secret used to sign authentication tokens. Use a unique random value outside local development. |
| `NEXTAUTH_URL` | Application URL, such as `http://localhost:3000` locally. |
| `DEFAULT_BASE_CURRENCY` | Base currency assigned to new businesses; defaults to `USD` in the example file. |
| `SEED_OWNER_PASSWORD` | Development-only password required by the optional demo seed. |
| `ANTHROPIC_API_KEY` | Optional API key for the Business Copilot. |

Keep real credentials in your local environment or hosting provider's secret
manager. Do not commit `.env` files or production credentials.

### Database and payroll setup

Prisma models and committed migrations are in `prisma/`. For subsequent schema
changes, create and review a migration locally with `npx prisma migrate dev`.
For deployment, apply committed migrations with:

```bash
npx prisma migrate deploy
```

Before using payroll, assign payroll roles in **Settings → Users**, add
employees and salary components, and configure effective-dated statutory
rules for the relevant currencies. Payroll approval is blocked until applicable
statutory rules are configured. The application does not provide or infer tax
rates or contribution percentages.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run the Next.js ESLint checks. |
| `npm test` | Run the unit tests. |
| `npx prisma generate` | Generate the Prisma client. |
| `npm run db:seed` | Add the local demo business and sample records. |

## Project layout

```text
prisma/
  migrations/       Database migration history
  schema.prisma     Data model
  seed.ts           Local demo data
public/             Static assets and web app manifest
src/
  app/              App Router pages, API routes, and feature actions
  components/       Shared UI components
  lib/              Shared utilities, permissions, and domain logic
  server/           Server-side services
```

Feature-specific pages and actions stay close to their route under `src/app`.
Reusable UI and domain utilities belong in `src/components` and `src/lib`.
The app's route structure follows Next.js App Router conventions; avoid moving
route files outside `src/app` without updating their routing behavior.

## Roles

| Role | Access summary |
| --- | --- |
| Owner / Administrator | Full business access, including business and user settings. |
| Manager | Day-to-day operations, reports, and payroll summaries; no user or business settings. |
| Salesperson | Customers, quotations, invoices, payments, and dashboard. |
| Cashier | Customers, invoices, payments, and dashboard. |
| Inventory Officer | Inventory, purchases, suppliers, and dashboard. |
| Finance | Expenses, accounts, payables, reports, and detailed payroll reports. |
| Payroll Administrator | Employee records, salary components, statutory rules, payroll runs, adjustments, and payslips. |
| Employee | Payslips for the employee record linked to their login. |

Page layouts, server actions, and APIs enforce permissions against the active
business membership. Middleware protects authenticated routes, while
business-scoped database queries enforce tenant isolation. Never trust a
`businessId` supplied by a client; derive it from the authenticated session on
the server.

## Deployment

The project can be deployed to Vercel or another Node.js host:

1. Configure the production PostgreSQL database and set the environment
   variables listed above in the hosting provider.
2. Deploy the application. The `postinstall` script generates the Prisma
   client, and `npm run build` creates the production build.
3. Apply migrations against the production database with
   `npx prisma migrate deploy`.

Do not run the demo seed against production unless you explicitly want the
sample business data there. Configure a production `NEXTAUTH_SECRET`, and
provide an Anthropic API key only if the Copilot should be enabled.

## Current limitations

- Subscription billing is informational; no card or mobile-money processor is
  connected.
- The installable web app requires an internet connection; there is no offline
  service worker.
- WhatsApp payment reminders are not implemented.
