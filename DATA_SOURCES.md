# Data sources, terms, and production alternatives

Checked on **2026-11-04**. This is an engineering inventory, not legal advice.
The project uses dated prices for a student competition demo. A public or
commercial production service should obtain data rights from the relevant
provider before redistribution.

| Source | Licence / terms note | robots.txt checked (yes/no, date) | Used for | Production alternative |
| --- | --- | --- | --- | --- |
| [Yahoo Finance GC=F and LKR=X](https://finance.yahoo.com/) | Retrieved through `yfinance`; this is not an official Yahoo API. Yahoo terms restrict automated collection and commercial reuse without permission. Treat the current fallback as demo-only; do not assume redistribution rights. | No — attempted 2026-11-04; network access unavailable here. | Fallback daily gold futures and USD/LKR history. `GC=F` is a futures proxy, not spot. | A licensed market-data vendor with historical gold and FX redistribution rights. |
| [Central Bank of Sri Lanka (CBSL) CSV](https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates) | Official CBSL statistics; the downloaded CSV has no reuse licence recorded in this repository. Confirm reuse and attribution terms with CBSL for production. The configured file is `data/raw/cbsl_usdlkr.csv` with `Date` and `Rate` columns. | No — attempted 2026-11-04; network access unavailable here. | Preferred USD/LKR history when the configured CSV exists; otherwise Yahoo `LKR=X` is used and the selected source is shown in Data Health. | CBSL-approved machine-readable feed or a licensed FX provider, retaining the rate definition and dates. |
| [Ada Derana](https://www.adaderana.lk/) | News text and article content remain publisher material. This project records only dated price facts and a source URL; it does not republish article text. Terms should be checked before automated collection or reuse. | No — attempted 2026-11-04; network access unavailable here. | Historical Pettah press observations, when a report provides a dated quote. | Publisher permission or a verified direct quote supplied by a participating shop. |
| [The Morning](https://www.themorning.lk/) | News text and article content remain publisher material. This project records only dated price facts and a source URL; it does not republish article text. Terms should be checked before automated collection or reuse. | No — attempted 2026-11-04; network access unavailable here. | Historical Pettah press observations, when a report provides a dated quote. | Publisher permission or a verified direct quote supplied by a participating shop. |
| [Published dealer sites](https://lankabizz.net/) | The app stores dated published rates, source URLs, and publisher names. No general redistribution licence is recorded; obtain permission or an agreement before public production use. Current values are dealer listings, not Pettah observations. | No — attempted 2026-11-04; network access unavailable here. | Dated local dealer listings used as the current local reference and for dealer attribution. | Direct written data-sharing agreements with dealers, including display and retention rights. |
| [GoldAPI.io](https://www.goldapi.io/kb/tos) | Optional API service; access and display rights depend on the plan and its terms. API credentials must remain server-side. Check current plan limits and data-provider rights before relying on it in production. | No — attempted 2026-11-04; network access unavailable here. | Optional live market quote and WebSocket features; not the historical Python pipeline source. | A paid provider contract covering the required real-time use, caching, and end-user display. |

Robots.txt requests could not be completed because this environment has no
outbound network access. “No” means the file contents were not verified; it
does not mean crawling is allowed or disallowed. The project should not infer
permission from robots.txt alone.
