import sys, requests, urllib.robotparser as rp
from urllib.parse import urlparse
from db import init_db, log_raw
from utils import save_raw

HEADERS = {"User-Agent": "ModelX-student-project"}

def allowed(url):
    p = urlparse(url)
    robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
    r = requests.get(robots_url, headers=HEADERS, timeout=30)
    if r.status_code == 404:
        return True                      # no robots.txt = no restrictions
    r.raise_for_status()
    parser = rp.RobotFileParser()
    parser.parse(r.text.splitlines())
    return parser.can_fetch("*", url)

def main(url):
    init_db()
    if not allowed(url):
        print("robots.txt blocks this URL -> enter numbers manually"); return
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    name = "pettah_" + url.rstrip("/").split("/")[-1][:60] + ".html"
    path, sha = save_raw(r.content, name)
    log_raw(path, sha, url)
    print("Saved", path)

if __name__ == "__main__":
    main(sys.argv[1])