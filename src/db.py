import sqlite3, datetime as dt

DB_PATH = "data/aurum.db"

def get_conn():
    return sqlite3.connect(DB_PATH)

def init_db():
    with get_conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS world_gold(
            date TEXT PRIMARY KEY, usd_oz REAL, source TEXT);
        CREATE TABLE IF NOT EXISTS usdlkr(
            date TEXT PRIMARY KEY, lkr_per_usd REAL, source TEXT);
        CREATE TABLE IF NOT EXISTS pettah(
            date TEXT, karat INTEGER, lkr_per_8g REAL,
            outlet TEXT, url TEXT,
            PRIMARY KEY(date, karat, outlet));
        CREATE TABLE IF NOT EXISTS raw_files(
            path TEXT, sha256 TEXT, source TEXT, fetched_at TEXT);
        """)

def log_raw(path, sha, source):
    with get_conn() as c:
        c.execute("INSERT INTO raw_files VALUES (?,?,?,?)",
                  (path, sha, source, dt.datetime.now().isoformat()))