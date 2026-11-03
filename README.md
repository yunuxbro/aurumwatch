# AurumWatch LK
Daily gold buying and pricing risk monitor for small Sri Lankan jewellers. ModelX 2.0.

## Setup
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

## Load data
python src/ingest_world.py
python src/ingest_fx.py
python src/check_data.py

## Run the web app
From the `aurumwatch` project directory:

```powershell
npm run dev
```

The web app is in `web/`; the root npm scripts forward to it. You can also run npm commands directly from `web/`.

## Jewellery design studio
The studio accepts STL, OBJ, 3MF, GLB/glTF, Rhino 3DM, STEP/STP, IGES/IGS, and DXF files.
Files are parsed locally in the browser; the CAD file is not sent to a server. DXF
is a 2D preview only. STL, OBJ, 3MF, and Rhino files require the correct model
units to be selected. glTF uses metres and STEP/IGES are converted to millimetres.
Rhino 3DM files must contain embedded mesh geometry; B-rep-only 3DM files need
to be exported as a mesh (for example STL or 3MF) before they can be previewed.

Gold weight is estimated only from closed, manifold 3D mesh parts selected as
gold. Open or unsupported surfaces are excluded; their weight must be entered
manually. Gold density is an editable approximation and should be replaced with
the jeweller's actual alloy density. Gemstones and other non-gold parts must be
excluded from the gold-part selection. These limits mean the estimate is for
planning, not a casting or manufacturing weight certificate.

The studio and Stock Risk page show daily world-gold and USD/LKR values with
LKR benchmarks for 24K, 22K, and 18K. When fresh 22K selling/listed dealer
rates are available, the app uses their per-institution median as a dated Sri
Lankan market reference. It is not represented as a Pettah quote. If the dealer
feed is missing or older than seven days, the app falls back to a clearly
labeled world-gold/FX metal benchmark. Both exclude unquoted workmanship,
stones, and taxes.

The overview's daily candlesticks toggle between synthetic 22K and 24K OHLC in
LKR/8g, derived from saved gold and USD/LKR OHLC data. Their high/low values
are conservative non-synchronous envelopes, not observed local shop trading
ranges or live ticks. Dated Pettah news quotes and published Sri Lankan dealer
listings are overlaid as distinct local-price markers; when no Pettah report exists for
a date and karat, the dealer listing is used as a clearly labeled local
reference, never relabeled as Pettah. The market-history page reports both the
latest Pettah-news date and latest local-reference date/source. The daily
refresh trains an experimental standardized ridge-regression
model to forecast the next seven joined gold/FX market observations for this
synthetic 22K benchmark. It uses causal return lags and rolling statistics,
chronological train/validation/holdout splits, and a no-change baseline. Its
forecast and holdout metrics appear on Overview and Data Health; the latest
holdout did not beat the baseline, so it is not presented as a proven
improvement. It does not forecast Pettah or shop prices: the available dated
Pettah history is too sparse and old to train a reliable local model. Fresh
dealer quotes are direct references, not training labels.

The What Changed page preserves the sparse Pettah-news archive and overlays
dated local quotes on the daily gold/FX-derived market history. When Pettah
reports are missing for a date and karat, a dated seller/listed
median is shown with its dealer source, not relabeled as a Pettah shop quote.
The latest Pettah report date and latest local quote date/source are both
visible in the app.

The Design Studio can generate a downloadable PDF cost report with the jewelry
preview, market sources and dates, gold allocation, budget breakdown, and a
recent benchmark chart for the selected karat. Design Studio and Stock Risk can also use and compare
fresh 22K per-8g selling/listed rates from the public dealer feed. Selecting
a shop uses that dated rate as the estimate baseline; the PDF includes the
selected shop and the current comparison set with source links. These are
published dealer observations, not verified Pettah offers. Rates older than
seven days are excluded, even when the feed was fetched recently. The report
is a pro-forma estimate, not an invoice.

Five additional jewellers are listed in the Design Studio for manual quote
comparison: Vogue, Swarnamahal, Mallika Hemachandra, Raja, and Imeeshi Jewellery.
The directory does not imply a current price; a rate is used only when it has a
verified date and is entered or collected from a source.

## Automatic market-data refresh
Install the daily Windows Task Scheduler job from the project directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install_daily_refresh.ps1
```

By default, it runs at 07:00 local time. Override the time with `-At "08:30"`.
The job refreshes world gold and USD/LKR from Stooq / Yahoo Finance (and CBSL if
`data/raw/cbsl_usdlkr.csv` is supplied), collects the public dealer CSV,
reruns reports and the supervised benchmark model, and writes status to
`web/public/data/refresh.json` and the derived benchmark to
`web/public/data/market_reference.json`. The model is evaluated on a
chronological holdout against a zero-return baseline before refitting on all
available data. If model training fails, the refresh fails and marks its
forecast unavailable rather than showing an old forecast as current. A
dealer-feed failure is reported in Data health but does not stop the market/FX
refresh or report export. The Gold
prices page defaults to rates no more than seven days old and lets you reveal
older dated listings. It runs while your Windows user is signed in;
missed runs start when available. Run `npm run refresh` to refresh on demand.
Run history is appended to `data/logs/daily-refresh.log`.

To generate the plain-language project, pages, data, libraries, and model guide
PDF in the parent workspace folder, run `npm run project-guide`.

Pettah shop quotes are not available through a dependable public live API.
They must be verified and entered manually before the reports treat them as
local quotes. Add one using:

```powershell
.\.venv\Scripts\python.exe src\add_quote.py YYYY-MM-DD 22 350000 "Shop name" "https://source.example/quote"
```

Replace the example date, price, shop, and source URL with a verified quote.
The jewellery estimator labels its reference date and lets you enter a current
shop quote. Public feeds and model outputs are estimates, not guaranteed market
prices; check the Data health page and source date before relying on them.

The Gold prices page separately displays merchant observations from the
public CSV tracker, including buying/selling side, karat, unit, the
shop's rate date, and the tracker observation time. The tracker does not
identify these quotes as Pettah-specific, so they are not added to Pettah
history or used by the risk model. Old rates remain visibly aged even when
the tracker has just been crawled.

The current feed does not publish an Imeeshi Jewellery quote, and
goldpricesrilanka.com denied automated access when checked. Neither is included
as a current source; do not infer a rate from search snippets. Use the manual
verified-shop quote field when a current rate is confirmed directly with a shop.
The daily tracker refresh makes newly published rates selectable after a
successful collection, while rate-date checks prevent stale observations from
being presented as current.

## Private accounts and saved work
Accounts use MongoDB Atlas for records and GridFS for private profile photos,
CAD files, CSV originals, and PDF reports. Create an Atlas database user and
cluster, copy `web/.env.example` to `web/.env.local`, and configure
`MONGODB_URI`, `MONGODB_DB`, and a unique `AUTH_SECRET` (at least 32 characters).
For local development, allow your current IP in Atlas Network Access; for
deployment, allow the hosting server's outbound IPs. Keep `.env.local` private
and never expose the MongoDB URI or session secret in browser code.
Generate a session secret with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

The sign-up form creates an account immediately using a hashed password and an
HTTP-only session cookie; email confirmation is not configured. Signed-in users
can save shop/profile settings, jewelry projects, validated Pettah/jewelry CSV
datasets, and Design Studio PDFs. MongoDB records and GridFS file access are
restricted to the signed-in account. CSV validation supports Pettah records
(`date,karat,price_lkr_per_8g,shop_name,source_url`) and jewelry design records
(`name,karat,weight_g`, with optional `material,notes`). Only validated rows are
saved; dates, karat, positive price/weight values, source URLs, and row limits
are checked. Rejected row numbers and reasons are retained for review. CSV
uploads are limited to 5 MB and 1,000 records. Uploaded records and designs
stay private and are not used to train models.

To enable current Pettah retail prices, provide a dependable dated source
(such as a participating shop's API/feed or verified daily quotes). No reliable
public Pettah quote feed was available, so the app will not fabricate a quote
or relabel the world-gold market estimate as a shop price.

Signed-in users can save shop/profile settings, jewelry projects, validated
Pettah/jewelry CSV datasets, and Design Studio PDFs. Row-level security and
private storage policies scope the data to its account. CSV validation supports
Pettah records (`date,karat,price_lkr_per_8g,shop_name,source_url`) and jewelry
design records (`name,karat,weight_g`, with optional `material,notes`). Only
validated rows are saved; dates, karat, positive price/weight values, source
URLs, and row limits are checked. Rejected row numbers and reasons are retained
for review. CSV uploads are limited to 5 MB and 1,000 records. Uploaded records
and designs stay private and are not used to train models.
