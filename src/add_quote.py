import sys
from db import get_conn, init_db

date, karat, price, outlet, url = sys.argv[1:6]
init_db()
with get_conn() as c:
    c.execute("INSERT OR REPLACE INTO pettah VALUES (?,?,?,?,?)",
              (date, int(karat), float(price), outlet, url))
print("Added", date, karat, price)
