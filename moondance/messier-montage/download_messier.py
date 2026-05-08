#!/usr/bin/env python3
"""Download a thumbnail for every Messier object (M1-M110) from Wikipedia's
'List of Messier objects' page into the same folder as this script. Then
normalize all to .jpg via macOS sips."""

import os
import re
import subprocess
import sys
import time
import urllib.request

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
LIST_URL = "https://en.wikipedia.org/wiki/List_of_Messier_objects"
TARGET_PX = 800  # upgrade Wikipedia thumb size
USER_AGENT = "MoondanceMontage/1.0 (https://sidestepstudio.com/moondance/; bizpfw@gmail.com)"
THROTTLE_SECS = 1.2  # respect Wikimedia's 1 req/sec guideline

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=30).read()

def main():
    print("Fetching Wikipedia list page...")
    html = fetch(LIST_URL).decode("utf-8")

    table_match = re.search(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>',
        html, re.DOTALL,
    )
    if not table_match:
        sys.exit("Could not find catalog table.")
    table = table_match.group(1)
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL)

    found = {}
    for row in rows:
        m = re.search(r'<th[^>]*scope="row"[^>]*>.*?>M(\d+)</a>', row, re.DOTALL)
        if not m:
            continue
        num = int(m.group(1))
        if num < 1 or num > 110:
            continue
        img = re.search(r'<img[^>]*src="(//upload\.wikimedia\.org/wikipedia/commons/thumb/[^"]+)"', row)
        if not img:
            continue
        src = "https:" + img.group(1)
        # Upgrade thumb size: .../<n>px-<file> -> .../800px-<file>
        src = re.sub(r'/(\d+)px-([^/]+)$', f'/{TARGET_PX}px-\\2', src)
        found[num] = src

    print(f"Found {len(found)} Messier image URLs.")
    if len(found) < 100:
        sys.exit(f"Only found {len(found)} — bailing, scraper likely broken.")

    for num in sorted(found):
        url = found[num]
        ext = url.rsplit(".", 1)[-1].lower().split("?")[0]
        if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
            ext = "jpg"
        raw_path = os.path.join(OUT_DIR, f"M{num:03d}_raw.{ext}")
        out_path = os.path.join(OUT_DIR, f"M{num:03d}.jpg")
        if os.path.exists(out_path):
            continue
        try:
            data = fetch(url)
            with open(raw_path, "wb") as f:
                f.write(data)
            # Normalize to JPG via sips (built into macOS)
            if ext == "jpg" or ext == "jpeg":
                os.replace(raw_path, out_path)
            else:
                subprocess.run(
                    ["sips", "-s", "format", "jpeg", raw_path, "--out", out_path],
                    check=True, capture_output=True,
                )
                os.remove(raw_path)
            print(f"  M{num:03d}: {len(data)//1024} KB")
            time.sleep(THROTTLE_SECS)
        except Exception as e:
            print(f"  M{num:03d}: FAILED {e}", file=sys.stderr)
            time.sleep(THROTTLE_SECS * 3)  # back off on errors

    # Manifest for the HTML page
    files = sorted(
        f for f in os.listdir(OUT_DIR)
        if re.match(r'M\d{3}\.jpg$', f)
    )
    print(f"\nWrote {len(files)} images to {OUT_DIR}")

if __name__ == "__main__":
    main()
