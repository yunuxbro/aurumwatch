import hashlib, pathlib

def save_raw(content: bytes, name: str):
    path = pathlib.Path("data/raw") / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    return str(path), hashlib.sha256(content).hexdigest()