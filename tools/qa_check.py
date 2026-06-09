#!/usr/bin/env python3
"""
qa_check.py - HTTP audit of the portfolio site.

Crawls the homepage + every project page, extracts every <a href>, <img src>,
<link href>, <script src>, plus the JS-rendered publication links (from
publications.js), checks the HTTP status of every internal + external URL, and
verifies in-page anchor targets exist.

Usage: python3 tools/qa_check.py [BASE_URL]
  default BASE_URL = https://arunshar.github.io/portfolio/
"""

import json
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

import lxml.html

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://arunshar.github.io/portfolio/")
if not BASE.endswith("/"):
    BASE += "/"
SLUGS = ["geosam-3d", "sat-splat-distort", "physflow-earth", "trajprompt",
         "darkvessel-stack", "pin-service", "mapfix-spatial", "pi-grpo", "geotrace-agent"]
PAGES = [BASE] + [urljoin(BASE, f"projects/{s}/") for s in SLUGS]
HOST = urlparse(BASE).netloc
CTX = ssl.create_default_context()
UA = {"User-Agent": "Mozilla/5.0 (portfolio-qa)"}


def fetch(url, method="GET", timeout=25):
    try:
        req = urllib.request.Request(url, method=method, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, (r.read() if method == "GET" else b"")
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return None, str(e).encode()


def main():
    print(f"BASE = {BASE}\n")
    url_pages = {}        # absolute url -> set(pages where referenced)
    anchor_issues = []    # (page, '#id') where target id missing
    page_status = {}

    for pg in PAGES:
        st, body = fetch(pg)
        page_status[pg] = st
        if st != 200 or not body:
            continue
        doc = lxml.html.fromstring(body.decode("utf-8", "replace"))
        ids = set(doc.xpath("//*/@id"))
        for el in doc.xpath("//a[@href] | //img[@src] | //link[@href] | //script[@src]"):
            rel = (el.get("rel") or "").lower()
            if el.tag == "link" and rel in ("preconnect", "dns-prefetch"):
                continue  # connection hints, not fetchable resources
            u = el.get("href") or el.get("src")
            if not u:
                continue
            if u.startswith("#"):
                if len(u) > 1 and u[1:] not in ids:
                    anchor_issues.append((pg, u))
                continue
            if u.startswith(("mailto:", "javascript:", "tel:", "data:")):
                continue
            url_pages.setdefault(urljoin(pg, u), set()).add(pg)

    # JS-rendered publication links (homepage renders these from publications.js)
    pst, pbody = fetch(urljoin(BASE, "assets/publications.js"))
    pubs_n = 0
    if pst == 200 and pbody:
        txt = pbody.decode("utf-8", "replace")
        try:
            arr = json.loads(txt[txt.find("["):txt.rfind("]") + 1])
            pubs_n = len(arr)
            for e in arr:
                if e.get("titleUrl"):
                    url_pages.setdefault(e["titleUrl"], set()).add(BASE + " (pub titleUrl)")
                for lk in e.get("links", []):
                    if lk.get("href"):
                        url_pages.setdefault(lk["href"], set()).add(BASE + " (pub link)")
        except Exception as ex:
            print(f"!! could not parse publications.js: {ex}")

    # check every unique url (threaded)
    def check(u):
        return u, fetch(u, method="GET")[0]
    results = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        for u, st in ex.map(check, sorted(url_pages)):
            results[u] = st

    internal_fail, external_fail, blocked, okc = [], [], [], 0
    BOT_OK = {403, 405, 429, 999, 406}     # reachable but bot-blocked
    REDIR = {301, 302, 303, 307, 308}
    for u in sorted(results):
        st = results[u]
        internal = urlparse(u).netloc == HOST
        srcs = sorted(url_pages[u])
        where = srcs[0].replace(BASE, "/")
        if st == 200 or st in REDIR:
            okc += 1
        elif st in BOT_OK:
            blocked.append((u, st))
        else:
            (internal_fail if internal else external_fail).append((u, st, where))

    # ---- report ----
    print("=== PAGES ===")
    for pg in PAGES:
        print(f"  {page_status[pg]}  {pg.replace(BASE,'/') or '/'}")
    print(f"\npublications.js entries: {pubs_n}")
    print(f"unique URLs checked: {len(results)}  | ok/redirect: {okc}  | "
          f"bot-blocked(reachable): {len(blocked)}")

    print(f"\n=== ANCHOR ISSUES ({len(anchor_issues)}) ===")
    for pg, a in anchor_issues:
        print(f"  MISSING TARGET {a}  on {pg.replace(BASE,'/')}")
    if not anchor_issues:
        print("  none - all in-page anchors resolve")

    print(f"\n=== INTERNAL FAILURES ({len(internal_fail)}) ===")
    for u, st, where in internal_fail:
        print(f"  {st}  {u}   (from {where})")
    if not internal_fail:
        print("  none - all internal links/assets 200")

    print(f"\n=== EXTERNAL FAILURES ({len(external_fail)}) ===")
    for u, st, where in external_fail:
        print(f"  {st}  {u}   (from {where})")
    if not external_fail:
        print("  none - all external links resolve (or bot-blocked)")

    print(f"\n=== BOT-BLOCKED (reachable, not a defect) ({len(blocked)}) ===")
    for u, st in blocked:
        print(f"  {st}  {u}")

    bad = (len(internal_fail) + len(external_fail) + len(anchor_issues)
           + sum(1 for p in PAGES if page_status[p] != 200))
    print(f"\nRESULT: {'PASS - no defects' if bad == 0 else f'{bad} issue(s) to review'}")


if __name__ == "__main__":
    main()
