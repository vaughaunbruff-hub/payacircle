# PayaCircle — Railway Production Scaffold

Railway-ready Node.js/Express + Prisma/PostgreSQL application for scheduled savings circles.

## Updated business rules
- Family: minimum 10 members
- Friends: minimum 15 members
- Social Media: minimum 50 members
- Custom: creator chooses the group size (2–1000 in this scaffold)
- Contribution: $5–$100 USD, in $5 increments
- Circle capacity is stored per circle; it is not hard-coded to 100
- Payout positions are scheduled dates, not random draws
- House fee defaults to $100 per circle in the current scaffold and should be confirmed against your final fee policy

## Railway deployment
1. Create a Railway project.
2. Add a PostgreSQL service.
3. Deploy this repository/project as the Node service.
4. Railway supplies `DATABASE_URL` to the app when PostgreSQL is attached.
5. Add these variables in Railway: `NODE_ENV=production`, a long random `JWT_SECRET`, `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and later `PAYPAL_WEBHOOK_ID`.
6. Generate a Railway public domain and test `/api/health`.
7. Only after the sandbox flow works, add `payacircle.club` as a custom domain and update Namecheap DNS to the target Railway provides.

## PayPal safety
The PayPal Client Secret must stay in Railway Variables and must never be committed to source control or placed in browser JavaScript. The webhook route in this scaffold remains intentionally disabled as an authoritative payment source until PayPal signature verification is implemented. Do not take live money yet.

Before live launch, complete webhook signature verification, email verification, password reset, CSRF/session hardening, monitoring, backups, reconciliation, dispute/refund workflows, payout controls, and legal/regulatory review.

## Railway start configuration
`railway.json` uses `npm run start` and `/api/health` as the health check. `nixpacks.toml` installs dependencies, generates Prisma Client, then runs `prisma db push` before starting the app.

## Local
Node 20+ is recommended. Run `npm install`, `npx prisma generate`, `npx prisma db push`, `npm run db:seed`, then `npm start`.
