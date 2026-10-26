import os, warnings
warnings.filterwarnings("ignore")
import pandas as pd
from db import get_conn, init_db, log_raw
from utils import save_raw

FILE = "data/raw/cbsl_usdlkr.csv"
DATE_COL = "Date"    # only used if you add the CBSL file later
RATE_COL = "Rate"

def from_cbsl():
    raw = open(FILE, "rb").read()
    path, sha = save_raw(raw, "cbsl_usdlkr_snapshot.csv")
    log_raw(path, sha, "CBSL manual download")
    df = pd.read_csv(FILE)
    df[DATE_COL] = pd.to_datetime(df[DATE_COL]).dt.strftime("%Y-%m-%d")
    return [(r[DATE_COL], float(r[RATE_COL]), "CBSL") for _, r in df.iterrows()]

def from_yfinance():
    import yfinance as yf
    df = yf.download("LKR=X", start="2015-01-01", progress=False)
    path, sha = save_raw(df.to_csv().encode(), "usdlkr_yfinance.csv")
    log_raw(path, sha, "yfinance LKR=X (market rate, fallback)")
    close = df["Close"].squeeze()
    return [(str(d.date()), float(v), "yfinance LKR=X") for d, v in close.items()]

def main():
    init_db()
    rows = from_cbsl() if os.path.exists(FILE) else from_yfinance()
    with get_conn() as c:
        c.executemany("INSERT OR REPLACE INTO usdlkr VALUES (?,?,?)", rows)
    print("Saved", len(rows), "rows")

if __name__ == "__main__":
    main()