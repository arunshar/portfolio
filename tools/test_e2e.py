#!/usr/bin/env python3
"""
test_e2e.py - live end-to-end production test of the rendered homepage.

Renders the LIVE site with headless Chrome (so the client-side renderPublications
actually runs), then asserts the DOM matches publications.js and every thumbnail
loads over HTTP. Complements qa_check.py (link audit) and test_site.py (offline).

Run:  python3 tools/test_e2e.py [BASE_URL]
"""

import json
import ssl
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse

import lxml.html

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://arunshar.github.io/portfolio/"
if not BASE.endswith("/"):
    BASE += "/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CTX = ssl.create_default_context()
UA = {"User-Agent": "Mozilla/5.0 (portfolio-e2e)"}
checks, failures = [], []


def ok(name, cond, detail=""):
    checks.append(name)
    if not cond:
        failures.append(f"{name}: {detail}")
    mark = "PASS" if cond else "FAIL"
    print(f"  [{mark}] {name}" + (f"  -> {detail}" if (detail and not cond) else ""))
    return cond


def http(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=25, context=CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:  # type: ignore
        return e.code, b""
    except Exception as e:
        return None, str(e).encode()


def expected_from_pubs():
    st, body = http(urljoin(BASE, "assets/publications.js"))
    assert st == 200, f"publications.js HTTP {st}"
    txt = body.decode("utf-8", "replace")
    arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
    return arr


def render_dom():
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
           "--virtual-time-budget=20000", "--run-all-compositor-stages-before-draw",
           "--dump-dom", BASE]
    out = subprocess.run(cmd, capture_output=True, timeout=120).stdout.decode("utf-8", "replace")
    return out


def main():
    print(f"E2E against {BASE}\n")
    pubs = expected_from_pubs()
    exp_imgs = {e["id"]: e["image"] for e in pubs}
    print(f"publications.js: {len(pubs)} entries\n")

    print("--- top-level resources ---")
    for path in ["", "assets/academic.css", "assets/main.js", "assets/publications.js"]:
        st, _ = http(urljoin(BASE, path))
        ok(f"GET /{path or '(index)'} 200", st == 200, f"HTTP {st}")

    print("\n--- rendered DOM (headless Chrome) ---")
    dom = render_dom()
    ok("DOM rendered (non-trivial length)", len(dom) > 5000, f"len={len(dom)}")
    doc = lxml.html.fromstring(dom)
    entries = doc.xpath("//article[contains(concat(' ',normalize-space(@class),' '),' pub-entry ')]")
    ok("22 .pub-entry articles rendered", len(entries) == len(pubs), f"found {len(entries)}")
    thumbs = doc.xpath("//a[contains(concat(' ',normalize-space(@class),' '),' pub-thumb ')]/img/@src")
    ok("22 .pub-thumb images rendered", len(thumbs) == len(pubs), f"found {len(thumbs)}")

    dom_srcs = set(thumbs)
    exp_srcs = set(exp_imgs.values())
    ok("rendered thumb srcs == publications.js images", dom_srcs == exp_srcs,
       f"missing={sorted(exp_srcs - dom_srcs)} extra={sorted(dom_srcs - exp_srcs)}")

    anchors = doc.xpath("//article[starts-with(@id,'pub-')]/@id")
    ok("every entry has a pub-<id> anchor", len(set(anchors)) == len(pubs), f"found {len(set(anchors))}")
    strongs = doc.xpath("//article//strong[normalize-space(text())='Arun Sharma']")
    ok("'Arun Sharma' bolded in every entry", len(strongs) >= len(pubs), f"found {len(strongs)}")

    print("\n--- every thumbnail loads (live HTTP) ---")
    def chk(src):
        return src, http(urljoin(BASE, src))[0]
    with ThreadPoolExecutor(max_workers=10) as ex:
        statuses = dict(ex.map(chk, sorted(exp_srcs)))
    bad = {s: c for s, c in statuses.items() if c != 200}
    ok(f"all {len(exp_srcs)} thumbnails HTTP 200", not bad, f"non-200: {bad}")

    print(f"\nRESULT: {len(checks)-len(failures)}/{len(checks)} checks passed")
    if failures:
        print("FAILURES:")
        for f in failures:
            print("  - " + f)
        sys.exit(1)
    print("E2E PASS")


if __name__ == "__main__":
    main()
