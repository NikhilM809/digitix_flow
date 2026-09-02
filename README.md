# Digitix Flow

Project management, employee time tracking, sales reporting, and monthly billing for Digitix Labs.

## Run locally

```bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo logins

Password for all accounts: `Digitix@123`

| Role | Email |
| --- | --- |
| Admin | admin@digitix.local |
| Senior Manager | asha@digitix.local |
| Manager | arjun@digitix.local |
| Employee | john@digitix.local |

## What this version covers

- Roles: Admin, Senior Manager, Manager, Employee (UI + API)
- Admin and Senior Manager can create projects and manage people (including Excel import)
- Project lifecycle: Bid → Need to Start → Script WIP → Changes → Live → Close
- Tasks, assignments, self-assignment
- Hours by Initial Scripting / Changes / Live
- Overdue, ETA approaching, and hours-over-estimate alerts
- Admin-only financials, sales charts, and billing PDFs
- Light / dark mode

SQLite is used for local development (`prisma/dev.db`). Switch the Prisma datasource to PostgreSQL when you are ready to deploy.
