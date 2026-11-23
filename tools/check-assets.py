"""Check that every asset referenced by the page exists, and list unused files.
Usage: python tools/check-assets.py
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
norm = lambda p: p.replace(os.sep, "/")

html = open("index.html", encoding="utf-8").read()
js = open("assets/js/main.js", encoding="utf-8").read()
refs = set(re.findall(r"(assets/[\w/.\-]+\.(?:webp|jpg|png|svg|css|js))", html + js))
missing = sorted(r for r in refs if not os.path.exists(r))
files = {norm(p) for p in glob.glob("assets/**/*.*", recursive=True)}
unused = sorted(files - refs)

build = open("tools/build-images.py", encoding="utf-8").read()
sources = set(re.findall(r'"((?:Images|Aerial & Adventure Activities)/[^"]+)"', build))
originals = sorted(norm(p) for p in glob.glob("Images/*") + glob.glob("Aerial & Adventure Activities/*"))

print(f"Referenced assets: {len(refs)}  missing: {len(missing)}")
for m in missing:
    print("  MISSING", m)
print(f"Asset files not referenced by the page: {len(unused)}")
for u in unused:
    print("  unused", u)
print(f"Original photos used: {len([o for o in originals if o in sources])} of {len(originals)}")
for o in originals:
    if o not in sources:
        print("  not used", o)
raise SystemExit(1 if missing else 0)
