from db import get_conn

with get_conn() as c:
    for t in ["world_gold", "usdlkr", "pettah"]:
        n, a, b = c.execute(f"SELECT COUNT(*), MIN(date), MAX(date) FROM {t}").fetchone()
        print(f"{t:12} rows={n:6}  from={a}  to={b}")
        