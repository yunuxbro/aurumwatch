# Final notes — ModelX 2.0

## Pitch lead: Best Data Vision

Lead with the data-quality finding: the full matched-history comparison found a 1.32% median absolute Yahoo/CBSL level gap (2.82% at p95), only 0.338 daily log-return correlation, and 282 dates with return differences above 100 bps. Four dates overlap the existing spike flags. This shows the series are not interchangeable and gives four dates to review; it does not prove a provider is wrong on every discrepant date.


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
- Full FX audit (5 Nov 2026, 2,853 matched dates): median absolute level gap
  1.317%, p95 2.816%, maximum 11.974%; daily log-return correlation 0.338.
  There are 282 dates with absolute daily log-return differences over 100 bps;
  four overlap the 12 existing spike flags (10-11 and 16 Mar 2022; 22 Mar 2023).
  The series are not interchangeable; this comparison identifies review dates,
  not which provider is wrong. Only 2-4 Nov 2026 have CBSL overrides.
- After the 1 Nov submission, compared raw Yahoo, Yahoo with the documented
  reversal filter, and CBSL-primary/Yahoo-gap-fill FX, plus an unfiltered
  reviewed-Yahoo control, on 2,971 common daily return dates. The filter
  identified 75 Yahoo observations (the 7 Mar–30 Apr
  2022 float window was excluded). Filtered Yahoo narrowed the proposed
  model's 95% width from 13.90% to 13.14% at 7 days and 19.84% to 18.70% at
  14 days; coverage moved closer to the 5% target at both horizons and
  pinball loss was slightly lower. This filter is now used for risk and
  backtest inputs; market history and attribution remain unfiltered.
- Yahoo Finance through `yfinance` is an undocumented data path with uncertain
  automation and redistribution rights. A licensed market-data source is
  needed before production redistribution.
- Dealer listings are published dealer observations, not verified Pettah
  shop reports. Pettah press reports remain sparse and are never filled in.
- The business-day freshness check excludes weekends but not Sri Lankan public
  holidays. Missing market observations remain visible and are not estimated.
- The risk simulation and ridge forecast are experimental. Historical
  resampling and a no-change comparison do not establish future performance.
- On the selected filtered FX input, the 7-day outside-95% rates are 4.0%
  model, 5.1% fixed volatility, and 6.0% EWMA-normal; widths are 13.1%, 11.0%,
  and 11.9%. At 14 days, outside-95% rates are 4.5%, 7.4%, and 7.4%; widths
  are 18.7%, 15.6%, and 17.0%. The selected input sensitivity improves width
  and calibration relative to raw Yahoo, but the model is not proven better
  than the baselines. In the Jan-Mar 2026 slice, 7-day miss counts are 1/9
  model, 2/9 fixed, and 1/9 EWMA; widths are 23.3%, 12.0%, and 21.1%. At 14
  days, all have 0/4 misses; model width is 32.4% vs 17.0% fixed and 29.8%
  EWMA. Nine and four windows are too few to prove a general advantage. Safe
  panel answer: "It widens when volatility rises, which fixed volatility does
  not. Nine windows is too few to prove a general advantage, and we say that
  on the page."
- CBSL published Rs 332.60 on 2-3 Nov and Rs 332.64 on 4 Nov. Yahoo printed
  Rs 322.44 and Rs 322.54 on 2-3 Nov; its 4 Nov close Rs 332.623 is about
  Rs 0.02 below CBSL. Candles now use the same reviewed rates as benchmark

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
   Gold, FX, and the dealer premium residual sum exactly to the dealer log move.
   The premium level is ln(dealer) - ln(world equivalent). Yahoo printed Rs
   322.44 and Rs 322.54 on 2-3 Nov; CBSL published Rs 332.60 on both dates
   and Rs 332.64 on 4 Nov. Derived returns use reviewed rates. Data Health
   reports the full-history matched-date discrepancy count and tolerance.
8. **Are the data sources licensed for production?**
   Not established for every source. Yahoo automation/redistribution and CBSL
   reuse terms need review. AllRatesToday endpoint response and Terms conflict
   on keyless public display. Publisher and dealer rights need agreements.
   See DATA_SOURCES.md.
9. **What is the difference between dealer and Pettah data?**
   Dealer data are dated prices published by named dealers. Pettah data are
   separate dated press reports. A dealer listing is never presented as a
   Pettah quote.

10. **What would you do with more time?**
    Secure licensed gold and FX feeds, automate and document the CBSL import,
    agree data rights with dealers and publishers, use a Sri Lanka holiday
    calendar, and extend rolling evaluation before changing the forecasting
    model.


## Pettah source check (5 Nov 2026)

Searches of Ada Derana and The Morning found no qualifying Oct-Nov 2026 Pettah gold price article. The archive remains at 14 rows, last dated 6 May 2026. No quote has been inferred or invented.
