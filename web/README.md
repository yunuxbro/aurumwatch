# AurumWatch web app

Run from this directory with `npm run dev`, or from the project root with
`npm run dev`.

## MongoDB account setup

Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB`, and
`AUTH_SECRET`. To enable Google sign-in, create an OAuth 2.0 Client ID for a
Web application in Google Cloud Console and add `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` to `.env.local`. The redirect
URI must exactly match the authorized redirect URI in Google Cloud Console; for
local development use `http://localhost:3000/api/auth/google/callback`.
Use an Atlas database user with a strong password, allow the
development machine or deployment host in Atlas Network Access, and keep the
connection string and session secret server-side. No database schema script is
required; the app creates the email index on first registration.

The account system stores password hashes and uses HTTP-only session cookies.
Google identities are verified from Google's signed ID token before being
matched to an account by email or used to create a new account.
GridFS holds private profile photos, CAD models, CSV originals, and generated
PDFs. Account file routes verify ownership before serving a file.

Pettah shop quotes require a verified dated shop quote. The automatic market
benchmark is not presented as a shop retail price. See the project
[README](../README.md) for market-data and daily-refresh details.
