# AI Property Witch (Portugal)

This is a Node + Playwright + Postgres-ready scaffold for a Portugal-first listing search assistant with a two-stage report flow.

## What works now
- API endpoints for search and approval
- Mock listings so the UI flow works end to end
- Two-stage quick-look and PDF report generation
- Compliance-first diagnostics pipeline scaffold

## Setup
1. `cd server`
2. `cp .env.example .env`
3. `npm install`
4. `npm run dev`

In a second terminal:
1. `cd web`
2. `npm install`
3. `npm run dev`

Open `http://localhost:5173`.

## Notes
- Mock listings are enabled with `MOCK_DATA=1`. Set to `0` once adapters are implemented.
- PDF files are saved to `server/reports` and served at `/reports/...`.
- FX rates are static in `.env` for now. Replace with a live FX provider in production.

## Next steps for real integrations
- Implement site adapters in `server/src/adapters/*.ts` using Playwright or compliant feeds.
- Update `server/src/config/sitePolicies.ts` after verifying each site’s allowed access methods.
- Replace in-memory search store with Postgres.
- Add BYOC session capture flow (interactive browser login) and persist user sessions securely.
