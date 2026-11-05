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

Checked **2026-11-05**, using Yahoo rows through 2026-11-04 and the CBSL-sourced Macro Lab series last published 2026-11-04. Macro Lab's public series page exposes all dated points in its page data. The audit compares raw stored Yahoo closes with the published CBSL values before applying the three recent overrides.

| Comparison | Count |
| --- | ---: |
| Yahoo `LKR=X` rows | 3,082 |
| Dates present in both series | 2,853 |
| Matched dates differing by more than Rs 0.05 | **2,758** |
| Matched dates within Rs 0.05 | 95 |
| Yahoo dates without a dated CBSL observation | 229 |
| CBSL dates without a Yahoo row | 676 |

The mismatch threshold is **absolute difference greater than Rs 0.05 per USD** (five paisa), above the CBSL series' two-decimal display precision. At stricter cent-level comparison, 2,844 matched dates differ after rounding both series to two decimals. This is a source discrepancy count, not a count of proven Yahoo bad prints: Yahoo's `LKR=X` market quote and CBSL's indicative spot series are distinct published series. We therefore cannot claim that Yahoo was right on the other dates, or that every difference should be replaced blindly. Only 2-4 Nov 2026 have explicit overrides in the live derived series; the remaining history is still Yahoo-sourced and not CBSL-verified.

The reference series is attributed to CBSL's Economic Data Library and CBSL exchange-rate lookup pages. Macro Lab documents that its combined source series agree on 1,376 of 1,381 dates where both CBSL sources overlap; those source-to-source discrepancies are separate from the Yahoo comparison above. Macro Lab charts/text are CC BY 4.0 and its page specifies citing CBSL via Macro Lab; it says the underlying figures belong to the publishing agencies. CBSL reuse terms for the underlying values have not been independently verified. See [Macro Lab's series and licensing notes](https://macrolab.lk/data/series/LK.EXT.FX.USD.SPOT.D/) and [About/data use](https://macrolab.lk/about/).

The comparison is reproducible with `.venv/Scripts/python.exe src/audit_fx_history.py`; it fetches Macro Lab's public series page and compares the full embedded date/value series with stored Yahoo rows. The summary used by Data Health is `web/public/data/fx_audit.json`.
