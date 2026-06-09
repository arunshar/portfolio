#!/usr/bin/env python3
"""
build_site.py - generate Pathak-style per-project pages from LaTeX papers.

For each project in tools/projects.json:
  1. copy <source>/main.tex + refs.bib into a temp build dir
  2. make4ht (pass 1) -> bibtex -> make4ht (pass 2)
     (TeX-native HTML: compiles the real doc, TikZ -> SVG via dvisvgm,
      math -> MathJax, tables, resolved natbib citations + references)
  3. sanitize the generated HTML (drop the tex4ht title block, remap heading
     levels, rewrite figure src, copy SVGs)
  4. wrap it in tools/project_template.html (title, authors, venue, button
     row, teaser, in-page TOC, full paper body, BibTeX block)
  5. emit a Markdown copy via pandoc (from the clean HTML, never raw tex)
  6. write projects/<slug>/{index.html, paper.gen.css, figures/*.svg, paper.md}

Also writes projects/manifest.json (used to build the homepage entries).

Usage:
  python3 tools/build_site.py                # build all projects
  python3 tools/build_site.py geosam-3d ...  # build only the named slugs
Requires: make4ht, bibtex, pandoc on PATH; python lxml.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import lxml.html
from lxml import etree

from render_tikz import render_all

ROOT = Path(__file__).resolve().parent.parent          # cv-portfolio/
TOOLS = ROOT / "tools"
BUILD = TOOLS / "_build"
OUT = ROOT / "projects"
TEMPLATE = (TOOLS / "project_template.html").read_text()
CFG = json.loads((TOOLS / "projects.json").read_text())

MK4_FILTER = "html5+dvisvgm_hashes"
MK4_OPTS = "mathjax"

# inline brand icons (currentColor so they take link colour / hover)
ICON_GH = (
    '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" '
    'focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 '
    '2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49'
    '-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23'
    '.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0'
    '-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 '
    '8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51'
    '.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 '
    '1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>'
)
ICON_HF = '<span class="ico hf-ico" aria-hidden="true">\U0001F917</span>'


def run(cmd, cwd, check=True, quiet=True):
    """Run a command, return CompletedProcess. Raise on failure when check."""
    res = subprocess.run(
        cmd, cwd=str(cwd), capture_output=True, text=True
    )
    if res.returncode != 0 and check:
        sys.stderr.write(f"\n[FAIL] {' '.join(cmd)} (cwd={cwd})\n")
        sys.stderr.write(res.stdout[-2000:] + "\n" + res.stderr[-2000:] + "\n")
        raise RuntimeError(f"command failed: {' '.join(cmd)}")
    if not quiet:
        sys.stdout.write(res.stdout)
    return res


def compile_paper(slug, source, texfile="main.tex"):
    """Copy paper sources to a temp dir, run make4ht x2 + bibtex.

    Copies the whole source dir so .sty / .bib / \\input files travel with it.
    Returns (build_dir, html_path, stem). texfile is the source .tex name
    (the external repos use names other than main.tex).
    """
    src = ROOT / source
    tex = src / texfile
    if not tex.exists():
        raise FileNotFoundError(f"missing paper source: {tex}")
    stem = Path(texfile).stem
    bdir = BUILD / slug
    html = bdir / f"{stem}.html"
    # cache: skip the (slow) make4ht compile when the paper sources are unchanged
    src_mtime = max((f.stat().st_mtime for f in src.iterdir() if f.is_file()), default=0)
    if html.exists() and html.stat().st_mtime >= src_mtime:
        print(f"  [{slug}] make4ht cache hit (paper unchanged)", flush=True)
        return bdir, html, stem
    if bdir.exists():
        shutil.rmtree(bdir)
    bdir.mkdir(parents=True)
    for item in src.iterdir():
        if item.is_file():
            shutil.copy(item, bdir / item.name)
        elif item.is_dir():
            shutil.copytree(item, bdir / item.name)

    mk4 = ["make4ht", "-f", MK4_FILTER, "-u", texfile, MK4_OPTS]
    print(f"  [{slug}] make4ht pass 1 ...", flush=True)
    run(mk4, bdir)
    print(f"  [{slug}] bibtex ...", flush=True)
    run(["bibtex", stem], bdir, check=False)  # no-op/ warning if inline bib
    print(f"  [{slug}] make4ht pass 2 ...", flush=True)
    run(mk4, bdir)
    html = bdir / f"{stem}.html"
    if not html.exists():
        raise RuntimeError(f"make4ht produced no HTML for {slug}")
    return bdir, html, stem


def clean_text(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def sanitize(html_path, fig_out):
    """Return (title, body_inner_html, toc) and copy referenced SVGs to fig_out.

    - drop the tex4ht <div class="maketitle"> (we render our own header)
    - remap heading levels down one (section h3 -> h2, etc.) so the page
      hierarchy is title=h1, sections=h2
    - rewrite <img src="main-*.svg"> to figures/ and copy the SVGs
    """
    root = lxml.html.parse(str(html_path)).getroot()
    body = root.find(".//body")

    # title from the tex4ht maketitle block (real \title), then remove block
    title = ""
    for mt in body.xpath(".//div[@class='maketitle']"):
        h = mt.find(".//h1")
        if h is not None and not title:
            title = clean_text(h.text_content())
        mt.getparent().remove(mt)
    # strip the standalone NeurIPS notice figure if it leaked outside maketitle
    for fig in body.xpath(".//figure[@class='float']"):
        if "Conference on Neural Information" in fig.text_content():
            fig.getparent().remove(fig)

    # remap heading levels (collect first so each shifts exactly once)
    for h in list(body.xpath(".//h3 | .//h4 | .//h5 | .//h6")):
        lvl = int(h.tag[1])
        h.tag = f"h{min(lvl - 1, 6)}"

    # figures: copy svg + rewrite src, record order for the teaser
    fig_out.mkdir(parents=True, exist_ok=True)
    svgs = []
    bdir = html_path.parent
    for img in body.xpath(".//img[@src]"):
        src = img.get("src")
        if src.lower().endswith(".svg"):
            srcfile = bdir / src
            if srcfile.exists():
                shutil.copy(srcfile, fig_out / Path(src).name)
                svgs.append(Path(src).name)
            img.set("src", f"figures/{Path(src).name}")
            img.set("loading", "lazy")
            if not img.get("alt") or img.get("alt") == "[Picture]":
                img.set("alt", "Figure")

    # in-page table of contents from top-level section headings (now h2 with id)
    toc = []
    for h2 in body.xpath(".//h2[@id]"):
        label = clean_text(re.sub(r"^\s*\d+(\.\d+)*\s*", "", h2.text_content()))
        if label and label.lower() not in ("abstract",):
            toc.append((h2.get("id"), label))

    inner = "".join(
        lxml.html.tostring(c, encoding="unicode") for c in body
    )
    return title, inner, toc, svgs


def gen_bibtex(title, slug, site_base, author):
    key = "sharma2026" + re.sub(r"[^a-z0-9]", "", slug.lower())
    return (
        f"@misc{{{key},\n"
        f"  title        = {{{title}}},\n"
        f"  author       = {{{author}}},\n"
        f"  year         = {{2026}},\n"
        f"  note         = {{Project page / preprint}},\n"
        f"  howpublished = {{\\url{{{site_base}/projects/{slug}/}}}}\n"
        f"}}"
    )


def buttons_html(slug, links):
    out = []
    if links.get("pdf"):
        out.append(f'<a class="btn" href="{links["pdf"]}">PDF</a>')
    if links.get("arxiv"):
        out.append(f'<a class="btn" href="{links["arxiv"]}" target="_blank" rel="noopener">arXiv</a>')
    if links.get("github"):
        out.append(f'<a class="btn btn-icon" href="{links["github"]}" target="_blank" '
                   f'rel="noopener" title="Code on GitHub" aria-label="Code on GitHub">{ICON_GH}</a>')
    if links.get("demo"):
        out.append(f'<a class="btn btn-icon" href="{links["demo"]}" target="_blank" '
                   f'rel="noopener" title="Demo on Hugging Face" aria-label="Demo on Hugging Face">{ICON_HF}</a>')
    if links.get("markdown"):
        out.append(f'<a class="btn" href="{links["markdown"]}">Markdown</a>')
    out.append('<a class="btn" href="#bibtex">BibTeX</a>')
    return "\n      ".join(out)


def toc_html(toc):
    if len(toc) < 3:
        return ""
    items = "\n".join(f'      <li><a href="#{i}">{lbl}</a></li>' for i, lbl in toc)
    return f'<nav class="toc" aria-label="Contents">\n    <h2>Contents</h2>\n    <ol>\n{items}\n    </ol>\n  </nav>'


def teaser_html(svgs, title):
    if not svgs:
        return ""
    return (
        f'<figure class="teaser">\n'
        f'    <img src="figures/{svgs[0]}" alt="{title} overview" loading="lazy">\n'
        f'  </figure>'
    )


def fill(template, mapping):
    out = template
    for k, v in mapping.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def build_project(p, cfg):
    slug = p["slug"]
    site_base = cfg["site_base"]
    author = cfg["author"]
    affil = cfg["affiliation"]
    out_dir = OUT / slug
    fig_dir = out_dir / "figures"

    out_dir.mkdir(parents=True, exist_ok=True)
    bdir, html, stem = compile_paper(slug, p["source"], p.get("texfile", "main.tex"))
    title, body, toc, svgs = sanitize(html, fig_dir)
    title = title or slug

    # replace make4ht's figure SVGs with clean pdflatex-rendered, scale-spread
    # ones (fixes the tight/overlapping TikZ boxes); falls back to make4ht on any issue
    if svgs:
        src_tex = ROOT / p["source"] / p.get("texfile", "main.tex")
        try:
            rendered = render_all(src_tex, fig_dir, names=svgs)
            print(f"  [{slug}] tikz: "
                  + (f"replaced {len(rendered)} figs (pdflatex+scale)" if rendered
                     else "kept make4ht figs"), flush=True)
        except Exception as e:
            sys.stderr.write(f"  [{slug}] tikz render error: {e}\n")

    # markdown copy from the sanitized body (clean: no title block / rules)
    md_ok = False
    try:
        res = subprocess.run(
            ["pandoc", "-f", "html", "-t", "gfm", "--wrap=none"],
            input=body, capture_output=True, text=True)
        if res.returncode == 0:
            header = f"# {title}\n\n{author}, {affil}\n\n_{p.get('venue','')}_\n\n"
            (out_dir / "paper.md").write_text(header + res.stdout)
            md_ok = True
        else:
            sys.stderr.write(f"  [{slug}] pandoc rc={res.returncode}: {res.stderr[-300:]}\n")
    except Exception as e:
        sys.stderr.write(f"  [{slug}] pandoc markdown skipped: {e}\n")

    # generated css for tex4ht font/structure classes
    gen_css = bdir / f"{stem}.css"
    if gen_css.exists():
        shutil.copy(gen_css, out_dir / "paper.gen.css")

    links = {
        "pdf": f"../../assets/papers/{slug}.pdf",
        "github": p.get("github", f"https://github.com/{cfg['github_user']}/{slug}"),
        "demo": p.get("demo", f"https://huggingface.co/spaces/{cfg['hf_user']}/{slug}"),
        "arxiv": p.get("arxiv"),
        "markdown": "paper.md" if md_ok else None,
    }
    page = fill(TEMPLATE, {
        "TITLE": title,
        "BLURB": p.get("blurb", title),
        "AUTHOR": author,
        "AFFILIATION": affil,
        "VENUE": p.get("venue", ""),
        "BUTTONS": buttons_html(slug, links),
        "TEASER": teaser_html(svgs, title),
        "TOC": toc_html(toc),
        "BODY": body,
        "BIBTEX": gen_bibtex(title, slug, site_base, author),
    })
    (out_dir / "index.html").write_text(page)
    print(f"  [{slug}] wrote {out_dir/'index.html'} "
          f"({len(svgs)} figs, {len(toc)} toc, md={md_ok})", flush=True)
    # root-relative fields for the homepage entry splice
    return {
        "slug": slug, "title": title, "venue": p.get("venue", ""),
        "blurb": p.get("blurb", ""),
        "teaser": f"projects/{slug}/figures/{svgs[0]}" if svgs else "",
        "page": f"projects/{slug}/",
        "pdf": f"assets/papers/{slug}.pdf",
        "github": links["github"], "demo": links["demo"],
        "markdown": f"projects/{slug}/paper.md" if md_ok else "",
    }


def render_entries(manifest):
    """Build the homepage 'Selected Projects' entries (Pathak-style list)."""
    out = []
    for m in manifest:
        thumb = ""
        if m.get("teaser"):
            thumb = (f'<a class="proj-thumb" href="{m["page"]}">'
                     f'<img src="{m["teaser"]}" alt="" loading="lazy"></a>')
        links = [f'<a href="{m["page"]}">webpage</a>']
        if m.get("pdf"):
            links.append(f'<a href="{m["pdf"]}">PDF</a>')
        if m.get("github"):
            links.append(f'<a class="ico-link" href="{m["github"]}" target="_blank" '
                         f'rel="noopener" title="Code on GitHub" aria-label="Code on GitHub">{ICON_GH}</a>')
        if m.get("demo"):
            links.append(f'<a class="ico-link" href="{m["demo"]}" target="_blank" '
                         f'rel="noopener" title="Hugging Face" aria-label="Hugging Face">{ICON_HF}</a>')
        out.append(
            '      <article class="proj-entry">\n'
            f'        {thumb}\n'
            '        <div class="proj-meta">\n'
            f'          <h3><a href="{m["page"]}">{m["title"]}</a></h3>\n'
            f'          <p class="proj-venue">{m["venue"]}</p>\n'
            f'          <p class="proj-blurb">{m["blurb"]}</p>\n'
            f'          <p class="proj-links">{" &middot; ".join(links)}</p>\n'
            '        </div>\n'
            '      </article>'
        )
    return "\n".join(out)


def splice_homepage(ordered):
    """Inject the Selected Projects entries into index.html between markers."""
    index = ROOT / "index.html"
    if not index.exists():
        return
    doc = index.read_text()
    s, e = "<!--PROJECTS:START-->", "<!--PROJECTS:END-->"
    if s in doc and e in doc:
        entries = render_entries(ordered)
        doc = doc.split(s)[0] + s + "\n" + entries + "\n      " + e + doc.split(e)[1]
        index.write_text(doc)
        print(f"spliced {len(ordered)} project entries into index.html")
    else:
        print("note: index.html has no PROJECTS markers; splice skipped")


def main():
    args = sys.argv[1:]
    if args and args[0] == "--splice-only":
        mpath = OUT / "manifest.json"
        ordered = json.loads(mpath.read_text()) if mpath.exists() else []
        splice_homepage(ordered)
        return
    only = set(args)
    projects = [p for p in CFG["projects"] if not only or p["slug"] in only]
    OUT.mkdir(exist_ok=True)
    manifest = []
    failed = []
    for p in projects:
        src = ROOT / p["source"] / p.get("texfile", "main.tex")
        if not src.exists():
            print(f"  [{p['slug']}] SKIP - no source at {src}", flush=True)
            failed.append(p["slug"])
            continue
        print(f"building {p['slug']} ...", flush=True)
        try:
            manifest.append(build_project(p, CFG))
        except Exception as e:
            sys.stderr.write(f"  [{p['slug']}] ERROR: {e}\n")
            failed.append(p["slug"])
    # merge into existing manifest so partial builds don't lose entries
    mpath = OUT / "manifest.json"
    existing = {}
    if mpath.exists():
        existing = {m["slug"]: m for m in json.loads(mpath.read_text())}
    for m in manifest:
        existing[m["slug"]] = m
    ordered = [existing[p["slug"]] for p in CFG["projects"] if p["slug"] in existing]
    mpath.write_text(json.dumps(ordered, indent=2))
    splice_homepage(ordered)
    print(f"\nDone. built={len(manifest)} failed={failed or 'none'}")
    print(f"manifest: {mpath}")


if __name__ == "__main__":
    main()
