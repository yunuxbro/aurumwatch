import csv, pathlib
from db import get_conn, init_db

init_db()
data_file = pathlib.Path(__file__).resolve().parent.parent / "data" / "pettah_quotes.csv"
with open(data_file, newline="") as f:
    rows = [(r["date"], int(r["karat"]), float(r["lkr_per_8g"]), r["outlet"], r["url"])
            for r in csv.DictReader(f)]
with get_conn() as c:
    c.executemany("INSERT OR REPLACE INTO pettah VALUES (?,?,?,?,?)", rows)
print("Loaded", len(rows), "Pettah quotes")