import csv, os, sys
from db import get_conn, init_db

date, karat, price, outlet, url = sys.argv[1:6]
init_db()
with get_conn() as c:
    c.execute("INSERT OR REPLACE INTO pettah VALUES (?,?,?,?,?)",
              (date, int(karat), float(price), outlet, url))

path = "data/pettah_quotes.csv"
rows = []
if os.path.exists(path):
    with open(path, newline="") as f:
        rows = [r for r in csv.DictReader(f)
                if not (r["date"] == date and r["karat"] == str(int(karat)) and r["outlet"] == outlet)]
rows.append({"date": date, "karat": str(int(karat)), "lkr_per_8g": str(float(price)),
             "outlet": outlet, "url": url})
rows.sort(key=lambda r: (r["date"], r["karat"]))
with open(path, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["date", "karat", "lkr_per_8g", "outlet", "url"])
    w.writeheader()
    w.writerows(rows)
print("Added", date, karat, price)