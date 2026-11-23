"""Build the production upload folder `dist/` with the live domain filled in.

Usage:  python tools/build-dist.py --domain https://www.example.com

Copies only what the live site needs (no original photos, TXT sources, tests, tools, node_modules,
screenshots or docs), replaces every YOUR-DOMAIN placeholder (canonical, og:url, og:image, JSON-LD,
robots.txt, sitemap.xml), sets the sitemap date, and refuses to finish if any placeholder remains.
"""
import argparse
import datetime
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

INCLUDE = [
    "index.html", ".htaccess", "robots.txt", "sitemap.xml", "composer.json", ".env.example",
    "assets", "api", "includes", "storage/.htaccess",
]
TEXT_EXT = {".html", ".txt", ".xml", ".php", ".js", ".css", ".json", ".example", ".htaccess", ""}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain", required=True, help="Live site origin, e.g. https://www.hotelnepalbhumi.com")
    args = ap.parse_args()
    domain = args.domain.rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9.-]+\.[a-z]{2,}", domain, re.I):
        sys.exit("--domain must look like https://www.example.com (https, no path)")

    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    for item in INCLUDE:
        src = os.path.join(ROOT, item)
        dst = os.path.join(DIST, item)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    today = datetime.date.today().isoformat()
    leftovers = []
    for folder, _, files in os.walk(DIST):
        for name in files:
            path = os.path.join(folder, name)
            if os.path.splitext(name)[1] not in TEXT_EXT and not name.startswith("."):
                continue
            text = open(path, encoding="utf-8").read()
            new = text.replace("https://YOUR-DOMAIN", domain)
            if name == "sitemap.xml":
                new = re.sub(r"<lastmod>[^<]*</lastmod>", f"<lastmod>{today}</lastmod>", new)
                new = re.sub(r"\s*<!-- Replace YOUR-DOMAIN[^>]*-->", "", new)
            if name == "robots.txt":
                new = new.replace("# Replace YOUR-DOMAIN with the live domain before launch\n", "")
            if name == "index.html":
                new = re.sub(r"\s*<!-- YOUR-DOMAIN is replaced by[^>]*-->", "", new)
            if new != text:
                open(path, "w", encoding="utf-8", newline="\n").write(new)
            if "YOUR-DOMAIN" in new:
                leftovers.append(os.path.relpath(path, DIST))

    if leftovers:
        sys.exit("Placeholder YOUR-DOMAIN still present in: " + ", ".join(leftovers))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(DIST) for f in fs)
    count = sum(len(fs) for _, _, fs in os.walk(DIST))
    print(f"dist/ ready for {domain}: {count} files, {size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
