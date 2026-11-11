# EventFlow — CFM Eventos

EventFlow is an operations management, temporal inventory allocation, digital quote approval, and financial ledger platform built for **CFM Eventos** (event production, furniture/AV rental, staging, and styling in Portugal).

## Architecture
- **Framework**: Next.js 15 (App Router, Server Actions, Server Components)
- **Database**: Turso (distributed libSQL / SQLite at edge)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS v4 & Lucide Icons
- **Deployment**: Vercel
- **Integrations**: Calendly Webhooks, Public Digital Proposal Approval (`/proposta/[token]`)

## Services
- `web`: Full-stack Next.js web application deployed to Vercel (`apps/eventflow/web`).
