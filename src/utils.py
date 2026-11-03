import hashlib, pathlib

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"

def save_raw(content: bytes, name: str):
    path = DATA_DIR / "raw" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return str(path), hashlib.sha256(content).hexdigest()