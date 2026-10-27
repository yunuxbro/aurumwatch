import argparse, json, pathlib
from clean import pettah_joined
from decompose import decompose
from risk import stock_risk
from anomaly import flag_premium_jumps
from quality import report

OUT = pathlib.Path("web/public/data")

def _fallback(o):
    return o.item() if hasattr(o, "item") else str(o)

def write(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(json.dumps(obj, indent=2, default=_fallback))
    print("wrote", name)

def rows(df):
    df = df.copy()
    for c in df.columns:
        if str(df[c].dtype).startswith("datetime"):
            df[c] = df[c].dt.strftime("%Y-%m-%d")
    return df.astype(object).where(df.notna(), None).to_dict(orient="records")

def main(price=None):
    j = pettah_joined(22)
    write("history", rows(j[["date", "local", "local_equiv", "premium", "lag_days"]]))
    write("moves", rows(decompose(22)))
    write("anomalies", rows(flag_premium_jumps(22)))
    write("risk", {"h7": stock_risk(7, price), "h14": stock_risk(14, price)})
    write("health", report())

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--price", type=float, default=None)
    main(ap.parse_args().price)