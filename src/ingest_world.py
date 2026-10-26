import io, requests, pandas as pd
from db import get_conn, init_db, log_raw
from utils import save_raw

STOOQ = "https://stooq.com/q/d/l/?s=xauusd&i=d"

def from_stooq():
    r = requests.get(STOOQ, timeout=30)
    r.raise_for_status()
    if not r.text.startswith("Date"):
        raise ValueError("Stooq did not return CSV: " + r.text[:80])
    path, sha = save_raw(r.content, "world_gold_stooq.csv")
    log_raw(path, sha, "stooq")
    df = pd.read_csv(io.BytesIO(r.content))
    return [(row.Date, float(row.Close), "stooq") for row in df.itertuples()]

def from_yfinance():
    import yfinance as yf
    df = yf.download("GC=F", start="2015-01-01", progress=False)
    csv = df.to_csv().encode()
    path, sha = save_raw(csv, "world_gold_yfinance.csv")
    log_raw(path, sha, "yfinance GC=F (futures proxy)")
    close = df["Close"].squeeze()
    return [(str(d.date()), float(v), "yfinance GC=F") for d, v in close.items()]

def main():
    init_db()
    try:
        rows = from_stooq()
    except Exception as e:
        print("Stooq failed:", e, "-> using yfinance")
        rows = from_yfinance()
    with get_conn() as c:
        c.executemany("INSERT OR REPLACE INTO world_gold VALUES (?,?,?)", rows)
    print("Saved", len(rows), "rows")

if __name__ == "__main__":
    main()