# Data sources, terms, and production alternatives

Checked on **2026-11-05**. This is an engineering inventory, not legal advice.
The project uses dated prices for a student competition demo. A public or
commercial production service should obtain data rights from the relevant
provider before redistribution.

| Source | Licence / terms note | robots.txt checked (yes/no, date) | Used for | Production alternative |
| --- | --- | --- | --- | --- |
| [Yahoo Finance GC=F and LKR=X](https://finance.yahoo.com/) | Retrieved through `yfinance`; this is not an official Yahoo API. Yahoo terms restrict automated collection and commercial reuse without permission. Treat inputs as demo-only; do not assume redistribution rights. | No — attempted 2026-11-04; network access unavailable then. | Running sources today: `GC=F` gold futures closes (proxy, not spot) and `LKR=X` daily USD/LKR closes. The full Yahoo history was compared against the CBSL indicative series on 2026-11-05; see the audit below. | A licensed market-data vendor with historical gold and FX redistribution rights. |
| [Central Bank of Sri Lanka (CBSL)](https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates) | Official USD/LKR indicative spot series sourced from CBSL Economic Data Library, with dates absent there supplemented from CBSL exchange-rate lookup pages by Macro Lab. Macro Lab's charts/text are CC BY 4.0; underlying values belong to CBSL. CBSL reuse terms were not independently verified. [Series, source notes and licence](https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/). | Checked via Macro Lab 2026-11-05; direct CBSL page access was unavailable here. | Full-history cross-check for Yahoo `LKR=X`. The comparison measures published values; Yahoo `LKR=X` and CBSL indicative spot are distinct rate series, so a difference does not by itself establish a bad print. Three CBSL overrides are applied on 2-4 Nov 2026 only. | CBSL-approved machine-readable feed or licensed FX provider. |
| [CBSL indicative gold table via AllRatesToday](https://allratestoday.com/central-bank-rates-api/cbsl/) | Public JSON endpoint serving CBSL-published daily tables. The endpoint response says public pages may show rates with a visible link, while the provider Terms of Service say public display of the keyless endpoint requires a paid plan. Obtain written clarification or a paid plan before treating deployed public display as licensed. Provider disclaims accuracy/timeliness and prohibits redistribution without permission. See [Terms](https://allratestoday.com/terms/) and [endpoint response](https://allratestoday.com/api/open/central-bank/cbsl). | Checked 2026-11-05: endpoint returned `available`, rate date 2026-11-04, with XAU/LKR and USD/LKR fields. App caches for one hour and shows a refresh error while retaining any last successful quote. Karat conversions are derived, not shop rates. | Direct CBSL machine-readable feed or a licensed market-data vendor. |
| [Ada Derana](https://www.adaderana.lk/) | News text and article content remain publisher material. This project records only dated price facts and a source URL; it does not republish article text. Terms should be checked before automated collection or reuse. | No — attempted 2026-11-04; network access unavailable here. | Historical Pettah press observations, when a report provides a dated quote. | Publisher permission or a verified direct quote supplied by a participating shop. |
| [The Morning](https://www.themorning.lk/) | News text and article content remain publisher material. This project records only dated price facts and a source URL; it does not republish article text. Terms should be checked before automated collection or reuse. | No — attempted 2026-11-04; network access unavailable here. | Historical Pettah press observations, when a report provides a dated quote. | Publisher permission or a verified direct quote supplied by a participating shop. |
| [Published dealer sites](https://lankabizz.net/) | The app stores dated published rates, source URLs, and publisher names. No general redistribution licence is recorded; obtain permission or an agreement before public production use. Current values are dealer listings, not Pettah observations. | No — attempted 2026-11-04; network access unavailable here. | Dated local dealer listings used as the current local reference and for dealer attribution. | Direct written data-sharing agreements with dealers, including display and retention rights. |
| [GoldAPI.io](https://www.goldapi.io/kb/tos) | Optional API service; access and display rights depend on the plan and its terms. API credentials must remain server-side. Check current plan limits and data-provider rights before relying on it in production. | No — attempted 2026-11-04; network access unavailable here. | Optional live market quote and WebSocket features; not the historical Python pipeline source. | A paid provider contract covering the required real-time use, caching, and end-user display. |

Robots.txt requests could not be completed because this environment has no
outbound network access. “No” means the file contents were not verified; it
does not mean crawling is allowed or disallowed. The project should not infer
permission from robots.txt alone.


## Full-history FX audit status

Checked **2026-11-05**, using Yahoo rows through 2026-11-04 and the CBSL-sourced Macro Lab series last published 2026-11-04. The audit compares the raw Yahoo and CBSL series on their 2,853 common dates and computes daily log returns on those matched observations.

| Diagnostic | Result |
| --- | ---: |
| Absolute level gap, median | 1.317% |
| Absolute level gap, 95th percentile | 2.816% |
| Absolute level gap, maximum | 11.974% |
| Matched dates with level gap above 1% | 1,909 / 2,853 |
| Correlation of daily log returns | 0.338 |
| Dates with absolute daily log-return difference above 100 bps | 282 |
| Those dates overlapping the 12 existing spike flags | 4 |

The four overlap dates are **2022-03-10, 2022-03-11, 2022-03-16, and 2023-03-22**. The discrepancy list, including both daily returns, absolute difference in basis points, and spike overlap, is exposed in Data Health and downloadable as `web/public/data/fx_return_discrepancies.csv`. This comparison says the two series do not track closely enough to treat as interchangeable. It identifies dates to review, but does not alone prove which provider is wrong. The live derived series applies CBSL overrides only on 2-4 Nov 2026; the remaining history is Yahoo-sourced, not CBSL-verified.

The CBSL reference is attributed to its Economic Data Library and exchange-rate lookup pages, compiled by Macro Lab. Macro Lab says its combined CBSL sources agree on 1,376 of 1,381 common dates; those are source-to-source discrepancies, separate from this Yahoo comparison. Macro Lab charts/text are CC BY 4.0, but its page says underlying figures belong to the publishing agencies. CBSL reuse terms for those values have not been independently verified. See [Macro Lab's series and licensing notes](https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/) and [About/data use](https://macrolab.lk/about/).

Re-run with `.venv/Scripts/python.exe src/audit_fx_history.py`. It fetches Macro Lab's public series page and compares it with the stored Yahoo rows. The summary and full mismatch list used by Data Health are in `web/public/data/fx_audit.json` and `web/public/data/fx_return_discrepancies.csv`.
