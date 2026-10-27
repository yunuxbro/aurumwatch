import csv
from db import get_conn, init_db

init_db()
with open("data/pettah_quotes.csv", newline="") as f:
    rows = [(r["date"], int(r["karat"]), float(r["lkr_per_8g"]), r["outlet"], r["url"])
            for r in csv.DictReader(f)]
with get_conn() as c:
    c.executemany("INSERT OR REPLACE INTO pettah VALUES (?,?,?,?,?)", rows)
print("Loaded", len(rows), "Pettah quotes")