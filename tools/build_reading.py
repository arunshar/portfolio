#!/usr/bin/env python3
"""
build_reading.py - render the Reading Resources section + a notes page per document.

Input : reading/notes.json  (array of records produced by the reading-notes workflow)
Output: reading/<slug>/index.html  (one notes page per record, from tools/reading_template.html)
        reading/manifest.json
        index.html  (splices the homepage entries between <!--READING:START/END-->)

Run: python3 tools/build_reading.py
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTES = os.path.join(ROOT, "reading", "notes.json")
TEMPLATE = os.path.join(ROOT, "tools", "reading_template.html")
INDEX = os.path.join(ROOT, "index.html")


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")
    return re.sub(r"-{2,}", "-", s) or "item"


def stars(rating):
    try:
        r = float(rating)
    except Exception:
        r = 0.0
    r = max(0.0, min(5.0, r))
    full = int(r)
    half = 1 if (r - full) >= 0.5 else 0
    empty = 5 - full - half
    return "★" * full + ("½" if half else "") + "☆" * empty


def fmt_rating(rating):
    try:
        r = float(rating)
    except Exception:
        return "?"
    return f"{r:g}"


def version_label(rec):
    m = re.search(r"v(\d+)", str(rec.get("slug", "")) + " " + str(rec.get("source_url", "")))
    return f"v{m.group(1)}" if m else "alt"


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", str(t).lower())


def render_page(rec, tmpl):
    summary = str(rec.get("summary", "")).strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", summary) if p.strip()] or [summary]
    summary_html = "\n".join("    <p>" + esc(p) + "</p>" for p in paras)
    key = "\n".join("      <li>" + esc(x) + "</li>" for x in rec.get("key_ideas", []))
    take = "\n".join("      <li>" + esc(x) + "</li>" for x in rec.get("takeaways", []))
    topics = "".join('<span class="tag">' + esc(t) + "</span>" for t in rec.get("topics", []))
    repl = {
        "TITLE": esc(rec.get("title", "")),
        "SLUG": esc(rec["slug"]),
        "AUTHORS": esc(rec.get("authors", "")),
        "VENUE": esc(rec.get("venue", "")),
        "YEAR": esc(rec.get("year", "")),
        "RATING": esc(fmt_rating(rec.get("rating"))),
        "STARS": stars(rec.get("rating")),
        "SOURCE_URL": esc(rec.get("source_url", "#")),
        "WHY": esc(rec.get("why_it_matters", "")),
        "SUMMARY_HTML": summary_html,
        "KEY_IDEAS": key,
        "TAKEAWAYS": take,
        "TOPICS": topics,
    }
    out = tmpl
    for k, v in repl.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def homepage_entry(group):
    # group: list of records sharing a title (>=1). primary = highest rating, prefer later version.
    g = sorted(group, key=lambda r: (-float(r.get("rating", 0)), version_label(r)))
    primary = g[0]
    links = '<a href="reading/%s/">notes</a>' % esc(primary["slug"])
    for other in g[1:]:
        links += ' &middot; <a href="reading/%s/">notes (%s)</a>' % (esc(other["slug"]), esc(version_label(other)))
    links += ' &middot; <a href="%s" target="_blank" rel="noopener">source</a>' % esc(primary.get("source_url", "#"))
    rstars = stars(primary.get("rating"))
    rnum = fmt_rating(primary.get("rating"))
    return (
        '      <article class="reading-entry">\n'
        '        <h3><a href="reading/%s/">%s</a></h3>\n'
        '        <p class="reading-meta">%s &middot; <span class="rtype">%s</span> &middot; '
        '<span class="rating" title="%s/5">%s<span class="num">%s/5</span></span></p>\n'
        '        <p class="reading-take">%s</p>\n'
        '        <p class="reading-links">%s</p>\n'
        '      </article>'
        % (
            esc(primary["slug"]), esc(primary.get("title", "")),
            esc(primary.get("authors", "")), esc(primary.get("venue", "")),
            esc(rnum), rstars, esc(rnum),
            esc(primary.get("one_liner", "")),
            links,
        )
    )


def main():
    recs = json.load(open(NOTES, encoding="utf-8"))
    tmpl = open(TEMPLATE, encoding="utf-8").read()

    # assign unique slugs
    seen = {}
    for r in recs:
        s = slugify(r.get("slug") or r.get("title", "item"))
        if s in seen:
            seen[s] += 1
            s = f"{s}-{seen[s]}"
        else:
            seen[s] = 1
        r["slug"] = s

    # render pages
    for r in recs:
        d = os.path.join(ROOT, "reading", r["slug"])
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(render_page(r, tmpl))

    # group by title (merge versions), sort groups by primary rating desc then title
    groups = {}
    for r in recs:
        groups.setdefault(norm_title(r.get("title", r["slug"])), []).append(r)
    ordered = sorted(
        groups.values(),
        key=lambda g: (-max(float(x.get("rating", 0)) for x in g), str(g[0].get("title", "")).lower()),
    )
    entries = "\n".join(homepage_entry(g) for g in ordered)

    # splice into index.html
    idx = open(INDEX, encoding="utf-8").read()
    block = "<!--READING:START-->\n" + entries + "\n      <!--READING:END-->"
    idx2 = re.sub(r"<!--READING:START-->.*?<!--READING:END-->", lambda m: block, idx, flags=re.S)
    open(INDEX, "w", encoding="utf-8").write(idx2)

    # manifest
    man = [
        {k: r.get(k) for k in ("slug", "title", "authors", "venue", "year", "type", "source_url", "rating", "one_liner", "topics")}
        for r in recs
    ]
    json.dump(man, open(os.path.join(ROOT, "reading", "manifest.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print(f"rendered {len(recs)} notes pages; {len(ordered)} homepage entries spliced")
    for r in recs:
        print(f"  reading/{r['slug']}/  <- {r.get('title','')[:60]}")


if __name__ == "__main__":
    main()
