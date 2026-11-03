import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(scriptDir, "..");
const appDir = path.resolve(webDir, "..");
const workspaceDir = path.resolve(appDir, "..");
const outputPath = path.join(workspaceDir, "AurumWatch-Project-Guide.pdf");

async function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const [refresh, backtest, market, history, dealerFeed, mlForecast, webPackage, requirementsText] = await Promise.all([
  readJson(path.join(webDir, "public", "data", "refresh.json")),
  readJson(path.join(webDir, "public", "data", "backtest.json"), []),
  readJson(path.join(webDir, "public", "data", "market_reference.json")),
  readJson(path.join(webDir, "public", "data", "history.json"), []),
  readJson(path.join(webDir, "public", "data", "dealer_quotes.json")),
  readJson(path.join(webDir, "public", "data", "ml_forecast.json"), { status: "unavailable" }),
  readJson(path.join(webDir, "package.json")),
  fs.readFile(path.join(appDir, "requirements.txt"), "utf8"),
]);

const pdf = new jsPDF({ unit: "mm", format: "a4" });
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const margin = 17;
const textWidth = pageWidth - margin * 2;
let cursorY = 22;

function startPage(title, subtitle = "") {
  if (pdf.getNumberOfPages() > 0) pdf.addPage();
  cursorY = 20;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(54, 43, 26);
  pdf.text(title, margin, cursorY);
  cursorY += 8;
  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(104, 101, 94);
    pdf.text(pdf.splitTextToSize(subtitle, textWidth), margin, cursorY);
    cursorY += 9;
  }
}

function ensureSpace(height) {
  if (cursorY + height <= pageHeight - 17) return;
  pdf.addPage();
  cursorY = 20;
}

function section(title) {
  ensureSpace(13);
  cursorY += 3;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(116, 79, 24);
  pdf.text(title, margin, cursorY);
  cursorY += 6;
}

function paragraph(text, fontSize = 9.5) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(49, 53, 56);
  const lines = pdf.splitTextToSize(text, textWidth);
  const lineHeight = fontSize * 0.47;
  ensureSpace(lines.length * lineHeight + 3);
  pdf.text(lines, margin, cursorY);
  cursorY += lines.length * lineHeight + 3;
}

function bullet(text) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.2);
  pdf.setTextColor(49, 53, 56);
  const lines = pdf.splitTextToSize(`- ${text}`, textWidth - 3);
  const lineHeight = 4.4;
  ensureSpace(lines.length * lineHeight + 2);
  pdf.text(lines, margin + 2, cursorY);
  cursorY += lines.length * lineHeight + 2;
}

function reportPrice(value) {
  return Number.isFinite(value) && value > 0
    ? `Rs ${Math.round(value).toLocaleString("en-US")}`
    : "Unavailable";
}

const generated = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeZone: "Asia/Colombo",
}).format(new Date());
const dataStatus = refresh.data || {};
const pettah = dataStatus.pettah || {};
const gold = dataStatus.world_gold || {};
const fx = dataStatus.usdlkr || {};
const dealers = dataStatus.dealer_quotes || {};
const proposed7 = backtest.find((row) => row.model === "model" && row.horizon === 7);
const proposed14 = backtest.find((row) => row.model === "model" && row.horizon === 14);
const backtestSummary = [proposed7, proposed14]
  .filter(Boolean)
  .map((row) => (
    `${row.horizon}-day: ${row.n} windows, ${Number.isFinite(row.outside_95)
      ? `${(row.outside_95 * 100).toFixed(1)}% outside the 95% interval`
      : "95% interval result unavailable"}`
  ))
  .join("; ");
const mlTest = mlForecast.test_metrics;
const mlSummary = mlForecast.status === "available" && mlTest
  ? `Latest ${mlForecast.market_as_of_date} model holdout (${mlForecast.evaluation.test_start_date} to ${mlForecast.evaluation.test_end_date}): ridge MAE ${mlTest.ridge.mae_bps.toFixed(1)} bps versus no-change ${mlTest.no_change_baseline.mae_bps.toFixed(1)} bps; ridge ${mlTest.ridge_beats_baseline_mae ? "beat" : "did not beat"} the baseline.`
  : "The model is currently unavailable; see Data Health for the refresh error.";
const pythonLibraries = requirementsText
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const frontendLibraries = Object.keys(webPackage.dependencies || {});

pdf.setFillColor(250, 247, 239);
pdf.rect(0, 0, pageWidth, pageHeight, "F");
pdf.setDrawColor(186, 143, 65);
pdf.setLineWidth(1.2);
pdf.line(margin, 49, pageWidth - margin, 49);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(28);
pdf.setTextColor(54, 43, 26);
pdf.text("AurumWatch LK", margin, 34);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(15);
pdf.setTextColor(116, 79, 24);
pdf.text("Project Guide", margin, 66);
pdf.setFontSize(11);
pdf.setTextColor(65, 69, 71);
pdf.text("Pages, datasets, technology, and the risk model - in plain language", margin, 75);
pdf.setFontSize(9);
pdf.setTextColor(104, 101, 94);
pdf.text(`Prepared ${generated}`, margin, 85);
pdf.setFont("helvetica", "bold");
pdf.setFontSize(11);
pdf.setTextColor(54, 43, 26);
pdf.text("What this system does", margin, 108);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(10);
pdf.setTextColor(49, 53, 56);
pdf.text(pdf.splitTextToSize(
  "AurumWatch LK is a gold-price and inventory-planning application for Sri Lankan jewellers. It combines public market feeds, dated dealer listings, sparse reported Pettah quotes, CAD-based jewellery weight estimates, and statistical risk ranges. It is a planning aid, not a price guarantee or financial advice.",
  textWidth,
), margin, 116);
pdf.setFillColor(255, 255, 255);
pdf.roundedRect(margin, 151, textWidth, 72, 3, 3, "F");
pdf.setFont("helvetica", "bold");
pdf.setFontSize(11);
pdf.setTextColor(116, 79, 24);
pdf.text("Current data snapshot", margin + 6, 162);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(9);
pdf.setTextColor(49, 53, 56);
pdf.text(`World gold: ${gold.latest_date || "unavailable"} (${gold.rows ?? 0} stored daily observations)`, margin + 6, 172);
pdf.text(`USD/LKR: ${fx.latest_date || "unavailable"} (${fx.rows ?? 0} stored daily observations)`, margin + 6, 180);
pdf.text(`Pettah reports: ${pettah.rows ?? history.length} observations; latest ${pettah.latest_date || history.at(-1)?.date || "unavailable"}`, margin + 6, 188);
pdf.text(`Dealer feed: ${dealers.rows ?? dealerFeed.rows?.length ?? 0} latest-batch observations; latest rate ${dealers.latest_date || "unavailable"}`, margin + 6, 196);
pdf.text(
  `World-derived 22K estimate: ${reportPrice(market.lkr_per_8g_22k)} / 8 g on ${market.gold_date || "date unavailable"}`,
  margin + 6,
  204,
);
pdf.text(
  `Dealer guide: ${reportPrice(market.dealer_reference?.price_lkr_per_8g)} / 8 g on ${market.dealer_reference?.rate_date || "date unavailable"} (not a Pettah quote)`,
  margin + 6,
  212,
);
pdf.setFontSize(8);
pdf.setTextColor(104, 101, 94);
pdf.text("Market inputs are refreshed separately; a market proxy is never labelled as a Pettah shop quote.", margin, 233);

startPage("1. Pages and what they show", "The main navigation routes in the AurumWatch web app.");
section("Overview - /");
paragraph("A quick daily brief: the best available dated price basis, latest source dates, toggleable 22K/24K daily history and optional live candles, an evidence-based market snapshot, an experimental supervised gold/FX benchmark forecast with its holdout comparison, and an inventory exposure widget. Pettah reports and published dealer observations keep separate dates and source labels.");
section("What Changed - /changes");
paragraph("The sparse Pettah news archive remains separate, while the daily synthetic benchmark lets the user switch between 22K and 24K OHLC candles with dated Pettah and published dealer observations marked by source. A private GoldAPI WebSocket key enables 1-minute through 4-hour candles from streamed XAU/USD and USD/LKR updates; a REST key instead enables periodic XAU/LKR quotes with 1D, 1W, 1M, 3M, 6M, and 1Y chart ranges. REST historical ranges use the app's daily gold/FX benchmark with the newest candle updated by the latest provider quote; these historical candles are not GoldAPI history. Neither mode fabricates movement. Dealer rates are never relabeled as Pettah offers.");
section("Gold Prices - /prices");
paragraph("A searchable and filterable table of published dealer/feed observations. Each row keeps the institution, karat, buying/selling/listed type, amount and unit, rate date, observation time, and source link. Old records are visibly aged rather than made current by a new fetch.");
section("Design Studio - /design");
paragraph("Imports supported CAD/design files locally in the browser, estimates weight from selected closed 3D meshes or manual inputs, compares current shop prices, allocates metal/making/stone costs, and exports a PDF cost report with the design preview and a benchmark chart matching the selected karat. Five additional Sri Lankan jewellers are listed for dated manual quote comparison; no rate is invented when a shop does not publish one.");
section("Stock Risk - /risk");
paragraph("Displays backend 7- and 14-day historical risk ranges and probabilities, plus assumptions and an editable stock exposure calculator. A selected current published shop quote can be used as the calculator baseline; the quote and date remain visible.");
section("Data Health - /health");
paragraph("Shows the last refresh outcome, latest dates and row counts, source inventory, quality checks, and walk-forward backtest metrics. This is the place to see when a source is stale or a refresh failed.");
section("Sign in and Account - /login and /account");
paragraph("The sign-in page creates or accesses a private account. The account page manages profile/theme settings and, when database configuration is available, private projects, uploaded datasets, and saved PDF reports.");

startPage("2. Datasets and source boundaries", "Raw observations and derived estimates are deliberately kept distinct.");
section("Stored source datasets");
bullet("Pettah history (data/pettah_quotes.csv and the pettah database table): dated, press-reported 22K sovereign values with publisher/source URLs. The refreshed snapshot contains 14 observations, latest dated 2026-05-06. It is not a continuous shop API and is stale for today's retail price.");
bullet("International gold (world_gold): daily USD per troy ounce. Stooq XAU/USD currently returns an error, so the latest refresh fell back to Yahoo Finance GC=F futures closes. Futures are a market proxy, not a verified spot or Pettah price.");
bullet("Exchange rates (usdlkr): daily USD/LKR observations. This workspace currently uses Yahoo Finance LKR=X; a configured CBSL CSV can be used instead.");
bullet("Dealer quotes (dealer_quotes): published CSV records with institution, karat, side, unit, LKR price, rate date, observation timestamp, and source URL. These are merchant observations, not Pettah-specific quotes.");
bullet("Raw snapshots and provenance are kept under data/raw and in the raw_files database table. Refresh logs and status are kept in data/logs and web/public/data/refresh.json.");
section("Derived datasets");
bullet("Candles: daily synthetic 22K and 24K LKR per 8 g OHLC benchmarks, derived from gold and FX OHLC values. The high/low use conservative non-synchronous envelopes. Pettah news reports and dated dealer rates appear as source-tagged markers; these are not live shop trades.");
bullet("History, local_quotes, moves, anomalies, risk, market_reference, health, backtest, ml_forecast, and dealer_quotes JSON files under web/public/data are generated exports used by the pages.");
bullet("The world-equivalent on an actual Pettah quote date is a comparison estimate. A current daily benchmark does not create missing local retail observations.");
section("How prices are kept current");
paragraph("The daily refresh runs the Pettah CSV loader, international gold and USD/LKR ingestion, dealer quote ingestion, risk backtest, supervised-model training, and JSON export. Both the Pettah archive date and latest local listing date are exposed. A dated dealer listing can provide local context when Pettah reports are absent, while preserving its original source type. The daily market benchmark itself is derived from gold/FX; the model forecasts only that synthetic benchmark.");
paragraph("Chart conversion: WebSocket XAU/USD and USD/LKR prices are converted to LKR per gram and scaled to 8 grams; REST XAU/LKR prices are converted from LKR per troy ounce. 24K uses the full fine-gold benchmark; 22K multiplies it by 22/24. The 22K and 24K charts share price movement by design, but differ in purity-adjusted price levels. Neither is a shop offer or local retail premium.");
paragraph("WebSocket and REST credentials are read only by the server from GOLD_API_WS_KEY and GOLD_API_KEY respectively. REST polling defaults to every three hours, configurable with GOLD_API_POLL_INTERVAL_MS, to help conserve quota; it is not tick-by-tick streaming. Without either credential the application stays on dated daily candles. GoldAPI documents plan-specific request allowances and connection limits; verify current pricing and terms before setting a polling cadence or demonstrating to multiple viewers.");

startPage("3. The ML / risk part, simply explained", "What is fitted, what is simulated, and what is not in this project.");
section("Supervised market model");
paragraph("The refresh fits a standardized ridge regression using NumPy and pandas (no scikit-learn dependency). It predicts the forward 7 joined-market-observation log return of the synthetic 22K LKR/8g benchmark derived from world gold and USD/LKR. Causal features include lagged returns, rolling means, and rolling volatility for gold, FX, and the combined benchmark. The output is not a Pettah or shop-price forecast.");
bullet("Data is split chronologically 70% / 15% / 15%. Standardization is fit only on training rows; ridge alpha is selected on the validation rows. A 7-observation label embargo prevents target windows from crossing split boundaries.");
bullet("The selected model is evaluated once on a held-out test period against a no-change (zero-return) baseline. MAE, RMSE, directional accuracy, and a paired moving-block bootstrap confidence interval for the MAE difference are reported. The model is refit on available labeled history only after holdout evaluation.");
paragraph(`${mlSummary} The overview and Data Health pages show the current forecast, validation method, and actual test metrics. A forecast whose market date does not match the latest gold and FX dates is marked stale.`, 9);
bullet("Fourteen sparse Pettah observations remain far too few to train or validate a local retail-price model. Fresh dealer observations are direct references, not model labels.");
section("How the risk ranges are produced");
bullet("The Python risk engine reads historical daily gold and USD/LKR returns and computes exponentially weighted moving variances (EWMA, lambda 0.94) separately for both series.");
bullet("It standardizes historical returns by their estimated volatility, resamples historical gold/FX moves together to preserve their observed same-day relationship, and simulates 10,000 possible return paths for a selected 7- or 14-day horizon.");
bullet("The output is a distribution of scenario values: percentile ranges, estimated chances of falls larger than 5% or 10%, and a historical premium-stress indicator. It is an uncertainty range, not a directional point forecast.");
bullet("The interactive Exposure Simulator also includes fixed 7-/14-day scenario multipliers in the frontend. Those constants are illustrative assumptions, not parameters trained from user data.");
section("How it is checked");
paragraph(`A walk-forward backtest compares the resampling approach with fixed-volatility and normal/EWMA baselines. It uses non-overlapping forecast windows, scores interval coverage with Kupiec tests, and reports pinball loss. Latest proposed-model results: ${backtestSummary || "not available"}. The nominal target is 5% outside a 95% interval; backtesting is a diagnostic, not proof future ranges are calibrated.`);
section("Interpretability and SHAP");
paragraph("SHAP is not used. The supervised model is a linear ridge regressor, so the Data Health page shows its largest standardized coefficients directly. These describe model weights, not causal effects. The overview's gold, FX, and local-premium breakdown is an accounting identity on observed Pettah quote dates, not a SHAP explanation or a causal claim.");
section("Important limits");
paragraph("Market-source delays, futures-vs-spot differences, sparse reported local quotes, retail premiums, workmanship, taxes, and individual shop rates all add uncertainty. Always check the displayed rate date and source. No output is a guaranteed offer or financial advice.");

startPage("4. Technology used", "Libraries and frameworks identified in the project manifests.");
section("Data and Python pipeline");
paragraph(`Python requirements: ${pythonLibraries.join(", ")}.`);
bullet("pandas and NumPy clean, join, transform, and simulate time-series data, and implement feature preparation and standardized ridge regression; SciPy supplies statistical distributions and backtest tests.");
bullet("requests and yfinance collect the public feeds; BeautifulSoup is included for HTML/source processing; SQLite stores normalized observations and provenance.");
bullet("pytest runs the Python validation and regression tests. Streamlit is listed in requirements for project tooling/legacy use; the current multi-page web UI is Next.js.");
section("Web application");
paragraph(`Frontend dependencies: ${frontendLibraries.join(", ")}.`);
bullet("Next.js and React implement the pages and interactive UI; Three.js, OCCT Import JS, rhino3dm, and dxf-parser support 3D/CAD preview and import.");
bullet("jsPDF generates client-side design reports; Papa Parse validates/imports account CSV files; MongoDB stores optional private account data; jose and bcryptjs support sessions and password hashing.");
bullet("Node's built-in test runner and ESLint validate the web project. No additional ML explainability package such as SHAP is used.");
section("Project locations");
bullet("aurumwatch/src: ingestion, SQLite schema, cleaning, analysis, risk simulation, backtest, and export pipeline.");
bullet("aurumwatch/data: the database, curated Pettah CSV, raw source snapshots, and daily refresh log.");
bullet("aurumwatch/web/src/app: Next.js pages and API routes; aurumwatch/web/src/components: charts, CAD studio, pricing table, and simulator.");
bullet("aurumwatch/web/public/data: generated JSON inputs consumed by the pages.");
section("Re-running refresh and this guide");
paragraph("From the AurumWatch project folder, run npm run refresh to collect and re-export the configured feeds. From the web folder, run npm run project-guide to rebuild this PDF in the ModelX workspace folder. Check the Data Health page after refresh; it reports upstream failures and stale sources.");

for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
  pdf.setPage(page);
  pdf.setDrawColor(220, 216, 205);
  pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 118, 112);
  pdf.text("AurumWatch LK | Project guide", margin, pageHeight - 7);
  pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 7, { align: "right" });
}

await fs.writeFile(outputPath, Buffer.from(pdf.output("arraybuffer")));
console.log(`Created ${outputPath}`);
