export const revalidate = 3600;

const CBSL_JSON_URL = "https://allratestoday.com/api/open/central-bank/cbsl";
const OUNCE_TO_GRAMS = 31.1034768;

export async function GET() {
  try {
    const response = await fetch(CBSL_JSON_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`CBSL rate service returned ${response.status}.`);

    const table = await response.json();
    const gold = table.rates?.find((rate) => rate.base === "XAU" && rate.quote === "LKR" && rate.type === "indicative");
    const usd = table.rates?.find((rate) => rate.base === "USD" && rate.quote === "LKR" && rate.type === "indicative");
    const goldLkrPerTroyOunce = Number(gold?.value);
    const usdLkr = Number(usd?.value);
    if (!table.rate_date || !Number.isFinite(goldLkrPerTroyOunce) || goldLkrPerTroyOunce <= 0) {
      throw new Error("The CBSL table did not include a valid LKR gold rate.");
    }

    const lkrPer8g24k = goldLkrPerTroyOunce * 8 / OUNCE_TO_GRAMS;
    return Response.json({
      status: "available",
      source: "CBSL indicative gold rate",
      source_url: "https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates",
      attribution_url: table.attribution?.url || "https://allratestoday.com/central-bank-rates-api/cbsl/",
      rate_date: table.rate_date,
      gold_lkr_per_troy_ounce: goldLkrPerTroyOunce,
      usd_lkr: Number.isFinite(usdLkr) ? usdLkr : null,
      lkr_per_8g: {
        "24k": lkrPer8g24k,
        "22k": lkrPer8g24k * 22 / 24,
        "18k": lkrPer8g24k * 18 / 24,
      },
    }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" },
    });
  } catch (error) {
    return Response.json({
      status: "unavailable",
      message: error instanceof Error ? error.message : "CBSL gold data is unavailable.",
    }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
