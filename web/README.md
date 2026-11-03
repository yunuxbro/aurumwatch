# AurumWatch web app

Run from this directory with `npm run dev`, or from the project root with
`npm run dev`.

## MongoDB account setup

Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB`, and
`AUTH_SECRET`. Use an Atlas database user with a strong password, allow the
development machine or deployment host in Atlas Network Access, and keep the
connection string and session secret server-side. No database schema script is
required; the app creates the email index on first registration.

The account system stores password hashes and uses HTTP-only session cookies.
GridFS holds private profile photos, CAD models, CSV originals, and generated
PDFs. Account file routes verify ownership before serving a file.

Pettah shop quotes require a verified dated shop quote. The automatic market
benchmark is not presented as a shop retail price. See the project
[README](../README.md) for market-data and daily-refresh details.
