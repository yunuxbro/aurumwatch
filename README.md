# AurumWatch LK

AurumWatch LK is a gold market and inventory risk monitor for small jewellery
businesses in Sri Lanka. It combines a Python market-data and modelling
pipeline with a Next.js dashboard and jewellery design studio.

The deployed web app is available at [aurumwatchlk.vercel.app](https://aurumwatchlk.vercel.app).

## What it does

- Tracks world gold and USD/LKR data and calculates 24K, 22K, and 18K metal
  benchmarks in LKR per 8 g.
- Shows dated local dealer listings and verified Pettah news quotes as separate
  sources, with freshness and data-quality details.
- Summarizes inventory exposure and historical market moves. The risk view
  reports ranges and scenarios; it does not issue buy or sell instructions.
- Imports jewellery models, estimates gold weight for selected closed,
  manifold mesh parts, and creates downloadable PDF cost reports.
- Supports private accounts for saved designs, validated CSV datasets, profile
  settings, and reports.
- Optionally uses GoldAPI for periodic quotes or WebSocket streaming.

## Project layout

```text
src/                  Python ingestion, validation, analytics, and modelling
tests/                Python tests
data/                 Local source data, quote records, and refresh logs
web/                  Next.js app, API routes, assets, and Node.js tests
scripts/              Local refresh utilities; scheduled refresh runs in GitHub Actions
```

## Architecture

The market data path is **Python pipeline -> SQLite -> JSON exports -> Next.js**.
Python ingesters validate dated source observations and store them in SQLite.
The analytics and export steps write JSON snapshots to `web/public/data`, which
the Next.js pages read. The browser does not fill missing market observations.

## Run locally

### Requirements

- Python and pip
- Node.js and npm
- MongoDB Atlas credentials only if you want to use saved accounts

### Install dependencies

From the repository root, create the Python environment and install the
project requirements:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Install the web app dependencies:

```powershell
npm --prefix web ci
```

### Start the web app

From the repository root:

```powershell
npm run dev
```

The app runs locally at `http://localhost:3000`. The repository-level npm
scripts forward web commands to `web/`.

### Load and refresh market data

The repository includes generated market data in `web/public/data`, so the
web app can display the saved snapshot without first running the full refresh.
To fetch source data and validate the local dataset:

```powershell
python src/ingest_world.py
python src/ingest_fx.py
python src/check_data.py
```

To run the complete daily refresh, including reports and the experimental
forecast:

```powershell
npm run refresh
```

The refresh writes the public JSON files consumed by the web app. The current
refresh uses Yahoo Finance `GC=F` futures closes for gold (a proxy, not spot)
and Yahoo Finance `LKR=X` daily closes for USD/LKR. A successful commit to the
default branch triggers the Vercel deployment.
Derived USD/LKR returns cross-check 2–4 November 2026 against CBSL; see
[`DATA_SOURCES.md`](DATA_SOURCES.md) and the visible attribution note.
Risk and backtest calculations use the aligned full daily close tables. The
chart uses a separate OHLC export with fewer dates; missing chart candles do
not mean those closes are missing from the risk engine.
Dealer listings are collected separately; a dealer feed failure is reported
in Data Health without blocking the other exports. Review
[`DATA_SOURCES.md`](DATA_SOURCES.md) for terms notes and production alternatives.

GitHub Actions runs the refresh at 12:00 Colombo time on weekdays. Use
`workflow_dispatch` in the Actions tab for a manual run before a presentation.
Changes to `data/pettah_quotes.csv` also trigger an immediate export refresh.
The workflow commits refreshed JSON exports, which triggers Vercel's Git
deployment. The Market history chart refreshes from those deployed exports
while open; new Pettah markers appear after a dated report is added to that
source file. The former Windows Task Scheduler script remains available for
local runs.

To install a local Windows refresh instead:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install_daily_refresh.ps1
```

The default local schedule is 07:00. Set a different time with
`-At "08:30"`. The task runs while your Windows user is signed in, starts
appends logs to `data/logs/daily-refresh.log`.

### Configure saved accounts and Google sign-in

Create `web/.env.local` with the server-side settings below. Never commit this
file or expose secret values using a `NEXT_PUBLIC_` variable.

```dotenv
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB=aurumwatch
AUTH_SECRET=your_random_secret_at_least_32_characters
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

Generate a session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In Google Cloud, create a Web application OAuth client and add
`http://localhost:3000/api/auth/google/callback` as an authorized redirect URI.
The URI must exactly match the one configured for the app. Google sign-in
verifies the ID token and email before creating or matching a MongoDB account.

## Deploy the web app to Vercel

Import this repository in Vercel and set the project's **Root Directory** to
`web`. Vercel builds the Next.js app from that folder; it does not run the
sibling Python refresh scripts.

Add these variables to the Vercel Production environment:

- `MONGODB_URI`
- `MONGODB_DB`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `GOOGLE_REDIRECT_URI`

GoldAPI credentials are optional. Add `GOLD_API_KEY` for REST quotes or
`GOLD_API_WS_KEY` for WebSocket streaming, plus `GOLD_API_POLL_INTERVAL_MS`
if you want to change the REST polling interval.

The production callback for the current domain is:

```text
https://aurumwatchlk.vercel.app/api/auth/google/callback
```

Add the same URL to the Google OAuth client's authorized redirect URIs. After
changing Vercel environment variables, redeploy so the new deployment uses
them. Configure MongoDB Atlas Network Access so Vercel functions can connect.

The GitHub Actions refresh commits updated JSON snapshots; Vercel's Git
integration deploys those changes. Configure GitHub Actions to allow the
workflow to write repository contents.

## Optional GoldAPI live quotes

For REST polling, add a GoldAPI REST key to `web/.env.local`:

```dotenv
GOLD_API_KEY=your_private_rest_key
GOLD_API_POLL_INTERVAL_MS=10800000
```

For WebSocket streaming, use a dedicated WebSocket key instead:

```dotenv
GOLD_API_WS_KEY=your_private_websocket_key
```

Without a provider key, the chart uses the app's dated daily gold/FX history.
REST polling refreshes periodically; WebSocket updates build intraday candles
from provider updates. The app does not fabricate prices between updates.

## Jewellery design studio

The browser-based studio accepts STL, OBJ, 3MF, GLB/glTF, Rhino 3DM, STEP/STP,
IGES/IGS, and DXF files. CAD files are parsed in the browser and are not sent
to a server for preview. DXF is a 2D preview. Rhino 3DM previews require
embedded mesh geometry; B-rep-only files should be exported as a mesh first.

Gold weight estimates include only selected closed, manifold 3D mesh parts.
Open or unsupported surfaces are excluded and must be entered manually.
Density is an editable approximation, so estimates are for planning and are
not manufacturing or casting certificates.

## Data and model limits

- The LKR karat prices are metal benchmarks derived from gold and FX, not shop
  offers; they exclude workmanship, stones, taxes, and retail premiums.
- Dealer listings are dated published observations, not verified Pettah
  quotes. A quote is shown as a Pettah quote only when supported by the dated
  local news archive or a manually verified entry.
- Pettah prices have no dependable public live feed in this project. Add a
  verified quote manually with:

  ```powershell
  .\.venv\Scripts\python.exe src\add_quote.py YYYY-MM-DD 22 350000 "Shop name" "https://source.example/quote"
  ```

- The ridge-regression forecast is experimental. It predicts the synthetic
  gold/FX benchmark, not local shop prices, and is evaluated against a
  no-change baseline. It is not presented as a proven improvement or financial
  advice.
- User-uploaded account records are stored separately from public model data
  and are not used to train the market forecast.

## Checks

Run the Python and web checks from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm run lint
npm --prefix web test
npm run build
```

## Project guide PDF

Generate a plain-language guide to the pages, data, libraries, and models:

```powershell
npm run project-guide
```

## AI-use disclosure

AI-assisted coding tools helped inspect and edit code and documentation for
this competition revision. The author remains responsible for reviewing and
explaining the implementation. No market observations, dealer rates, or
Pettah reports were generated by AI; they come from the dated source records
listed in [`DATA_SOURCES.md`](DATA_SOURCES.md). Model outputs are computed by
the checked-in Python pipeline.

The PDF is written to the parent directory of this repository.
