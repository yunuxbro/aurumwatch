import pathlib, sqlite3, datetime as dt

DB_PATH = pathlib.Path(__file__).resolve().parent.parent / "data" / "aurum.db"

def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
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
        CREATE TABLE IF NOT EXISTS dealer_quotes(
            institution TEXT NOT NULL,
            institution_type TEXT NOT NULL,
            commodity TEXT NOT NULL,
            karat INTEGER NOT NULL,
            side TEXT NOT NULL,
            unit TEXT NOT NULL,
            unit_label TEXT NOT NULL,
            price_lkr REAL NOT NULL,
            currency TEXT NOT NULL,
            rate_date TEXT NOT NULL,
            observed_at TEXT NOT NULL,
            source_url TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            PRIMARY KEY(institution, karat, side, unit, rate_date, source_url));
        CREATE TABLE IF NOT EXISTS raw_files(
            path TEXT, sha256 TEXT, source TEXT, fetched_at TEXT);
        """)

def log_raw(path, sha, source):
    with get_conn() as c:
        c.execute("INSERT INTO raw_files VALUES (?,?,?,?)",
                  (path, sha, source, dt.datetime.now().isoformat()))