# AurumWatch web app

Run from this directory with `npm run dev`, or from the project root with
`npm run dev`.

## Deploy on Vercel

Import the `aurumwatch` repository, then set the Vercel project's Root
Directory to `web`. Vercel will build and deploy the Next.js app from that
folder; the sibling Python `src` and `scripts` directories are not part of the
Vercel build. The market data files already in `web/public/data` are served by
the app. The Python daily refresh still needs to run separately to update
those files. Add these variables under Project
Settings → Environment Variables for the Production environment:

- `MONGODB_URI`
- `MONGODB_DB`
- `AUTH_SECRET` (a unique random value of at least 32 characters)
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `GOOGLE_REDIRECT_URI`

Set `GOOGLE_REDIRECT_URI` to the exact production URL, for example
`https://your-domain.example/api/auth/google/callback`. Add that same URL as an
authorized redirect URI for the Google OAuth Web client. Use your assigned
`*.vercel.app` domain if you do not have a custom domain yet. Google requires
the callback URL to match exactly, including HTTPS and path. Keep the Google
client secret and database URI server-side; do not use `NEXT_PUBLIC_` names.

Vercel does not automatically receive values from your local `.env.local`.
After adding or changing environment variables, redeploy so the new deployment
uses them. Vercel Preview URLs are different from the Production domain. The
callback defaults to the current deployment URL when `GOOGLE_REDIRECT_URI` is
not set, but Google will accept it only if that exact Preview callback is also
registered. For reliable Google sign-in previews, use a stable preview domain
and register its callback, or test Google sign-in on Production.

Configure MongoDB Atlas Network Access so the deployed Vercel functions can
reach the database.

## MongoDB account setup

Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB`, and
`AUTH_SECRET`. To enable Google sign-in, create an OAuth 2.0 Client ID for a
Web application in Google Cloud Console and add the client ID and secret as
`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`) in `.env.local`. Set `GOOGLE_REDIRECT_URI` to the same
callback URL registered in Google Cloud. The redirect
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
