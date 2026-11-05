# Final notes — ModelX 2.0

## Changes since the 1 November submission

The repository does not contain a tag, commit, or archived copy identified as
the 1 November submission. The available baseline is commit `0000412`, dated
4 November 2026, so an exact before-and-after comparison with the submitted
artifact cannot be verified. Relative to that checked-out baseline, this
revision adds:

- Dated dealer price attribution, with the historical press-based Pettah
  breakdown retained under its own label.
- Source and terms notes, visible feed provenance, and explicit Yahoo `GC=F`
  futures proxy and `LKR=X` FX source labels.
- Pettah report age, explicit no-data business days in candle history, and a
  stated gap length for the market close comparison.
- The stock risk range at the top of Overview, and the ridge forecast and
  expanded backtest results under Data Health.
- Weekday-based freshness rules and tests, dependency and README cleanup, and
  an AI-use disclosure.

## Known limitations and checks

- `npm run refresh` was attempted from a fresh local Git clone. It stopped at
  world-gold ingestion because this environment blocks outbound network
  requests to Stooq and Yahoo Finance. The repository's configured fallback
  could not obtain a fresh response. This was an environment limitation; a
  current end-to-end refresh with reachable feeds remains unverified.
- `npm run dev` reached “Ready” from the fresh clone after installing web
  dependencies from the local npm cache. The production build and lint also
  passed in the working checkout.
- `robots.txt` contents could not be retrieved in this environment. The source
  inventory records these checks as not completed, not as permission to
  collect data.
- The CBSL CSV must be supplied locally as `data/raw/cbsl_usdlkr.csv`; the
  repository does not automate its download or establish its reuse licence.
- Yahoo Finance through `yfinance` is an undocumented data path with uncertain
  automation and redistribution rights. A licensed market-data source is
  needed before production redistribution.
- Dealer listings are published dealer observations, not verified Pettah
  shop reports. Pettah press reports remain sparse and are never filled in.
- The business-day freshness check excludes weekends but not Sri Lankan public
  holidays. Missing market observations remain visible and are not estimated.
- The risk simulation and ridge forecast are experimental. Historical
  resampling and a no-change comparison do not establish future performance.
- On the 7-day holdout, outside-95% rates are 3.7% for the model, 4.0% for
  fixed volatility, and 5.7% for EWMA-normal. Pinball loss rounds to 0.0033
  for all three. Mean 95% widths are 13.9%, 11.8%, and 12.7%, respectively.
  The model adds joint gold/FX resampling and current-volatility scaling, but
  these results do not prove it is better.
- The 2–4 November Yahoo USD/LKR closes were checked against CBSL: the 2nd
  and 3rd were both Rs 332.60 and the 4th was Rs 332.64. Yahoo printed
  Rs 322.44 and Rs 322.54 on the 2nd and 3rd, so derived market returns use
  the CBSL cross-check values on those dates. The 4th Yahoo close is retained.

## Likely panel questions

1. **What market data sources are running?**
   Yahoo Finance `LKR=X` provides daily USD/LKR closes and `GC=F` provides gold
   futures closes. `GC=F` is a futures proxy, not spot. CBSL is a cross-check,
   not a configured feed.

2. **Why is Pettah data stale?**
   The stored reports are dated news observations, not a dependable daily
   series. The last report is shown with its date and age; dealer listings are
   the current local reference. No gap is filled.

3. **Why bootstrap instead of GARCH or an LSTM?**
   Resampling historical paired market returns is simple to explain and does
   not add parameters that this limited history may not support. It is a
   transparent baseline choice, not a claim that it is superior.

4. **What if the ridge forecast does not beat the no-change baseline?**
   The current holdout did not show a reliable improvement over no change, so
   the forecast stays experimental and is presented with that result in Data
   Health.

5. **What does 3.7% outside the 95% interval mean?**
   About 3.7% of evaluated 7-day windows fell outside the interval, so observed
   coverage was about 96.3%. That is slightly conservative in this sample; it
   does not prove calibration on future data.

6. **What happens when a feed fails?**
   A required market-feed failure stops the refresh and records the failure;
   the previous JSON snapshot remains. An optional dealer-feed failure is
   recorded as a warning. A stale risk input leads to “Cannot assess.”

7. **How does attribution add up exactly?**
   The dealer log move is split into gold and FX log returns. The dealer
   premium part is the residual, and an assertion checks that the three
   components sum exactly to the dealer move. The premium level is
   `ln(dealer) - ln(world equivalent)`.
   Yahoo printed Rs 322.44 and Rs 322.54 on 2–3 November, while CBSL published
   Rs 332.60 on both dates and Rs 332.64 on 4 November. We use those CBSL
   cross-check values in derived returns; the 4 November Yahoo close is also
   consistent. Attribution uses matched close-to-close dates, while dealer
   prices are dated published listings.

8. **Are the data sources licensed for production?**
   Not established for every source. Yahoo automation and redistribution need
   review, CBSL CSV reuse terms need confirmation, and publisher and dealer
   rights need permission or agreements. `DATA_SOURCES.md` records the gaps.

9. **What is the difference between dealer and Pettah data?**
   Dealer data are dated prices published by named dealers. Pettah data are
   separate dated press reports. A dealer listing is never presented as a
   Pettah quote.

10. **What would you do with more time?**
    Secure licensed gold and FX feeds, automate and document the CBSL import,
    agree data rights with dealers and publishers, use a Sri Lanka holiday
    calendar, and extend rolling evaluation before changing the forecasting
    model.
