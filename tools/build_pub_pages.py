#!/usr/bin/env python3
"""Generate per-project pages for the publication reference-implementation repos.

These pages are NOT full-paper LaTeX renders (the papers are published elsewhere
and linked by DOI). Each is a code-reference landing page for a reference
implementation: paper metadata + algorithm + the measured synthetic demo + how to
run it + the code repo. Built from tools/project_template.html and the metadata
already in assets/publications.js, so no LaTeX toolchain is needed.

Covers every first-author publication that has a runnable reference (plus the
Kriging-informed paper, on which Arun is a co-author, by request). The COVID-19
mobility paper (id "alan") is intentionally excluded. Short-paper summaries (vrb,
flavr) get a "page" link to their full version's page rather than a duplicate page.

Run from the repo root:  python3 tools/build_pub_pages.py   (idempotent).
"""
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANON = "https://arunshar.github.io/portfolio/projects/{slug}/"
AFFIL = "University of Minnesota, Twin Cities"

GH_SVG = (
    '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" '
    'focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 '
    "6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 "
    "1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 "
    "0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 "
    "3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 "
    "1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 "
    '2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>'
)

# pub-id -> page slug, code_repo (github), blurb, algorithm, measured result.
# code_repo differs from slug where the code was folded into a larger repo.
PUBS = {
    "intexpl": {
        "slug": "stagd-trajectory-gap", "code_repo": "stagd-trajectory-gap", "pkg": "stagd",
        "blurb": "Space-time prism + Abnormal Gap Measure for detecting abnormal trajectory gaps.",
        "algo": "A trajectory gap between two reported positions is bounded by a space-time prism: the locations reachable in the gap duration at the maximum speed, which projects to a 2D geo-ellipse with foci at the endpoints, semi-major axis a = v_max * dt / 2, and semi-minor axis b = sqrt(a^2 - c^2) where c is half the endpoint distance. The Abnormal Gap Measure (AGM) is the fraction of signal-covered grid cells inside this prism; a gap whose prism sweeps a large, well-covered region yet did not report is flagged as abnormal.",
        "result": "On two gaps sharing the same endpoints (10 km apart), a normal gap (dt = 1.5 h) yields a tight prism while an abnormal gap (dt = 8 h) yields a prism 37.9x larger that sweeps 469 signal-covered cells versus 14. The test asserts the abnormal prism area and covered-cell count both exceed the normal gap's.",
    },
    "sear": {
        "slug": "tgard-rendezvous", "code_repo": "tgard-rendezvous", "pkg": "tgard",
        "blurb": "TGARD reachable-set intersection for a tighter bound on possible-rendezvous areas.",
        "algo": "Given two trajectory gaps on a road network, the nodes where the two objects could possibly have met are bounded by the intersection of their reachable sets. TGARD computes each reachable set with a budget test on shortest-path distances (dist(start, v) + dist(v, end) <= time * speed) and intersects them, a far tighter bound than the naive axis-aligned bounding box of the gap endpoints.",
        "result": "On a grid network, TGARD returns 9 candidate rendezvous nodes versus 24 for the naive bounding box, and the TGARD set is a strict subset of the box. The test asserts the strict reduction and the subset relation.",
    },
    "leap": {
        "slug": "tss-rendezvous-region", "code_repo": "tss-rendezvous-region", "pkg": "tss",
        "blurb": "Space-time-prism intersection (TSS) for the possible rendezvous region between two gaps.",
        "algo": "The possible-rendezvous region for two trajectory gaps is the intersection of their space-time prisms. Each gap's prism projects to a geo-ellipse; the TSS intersection is the set of cells inside both ellipses, giving a region strictly smaller than either prism while remaining non-empty when a rendezvous is feasible.",
        "result": "Two gaps produce prisms of 266 and 258 cells; their intersection (the rendezvous region) is 224 cells, non-empty and strictly smaller than both. The test asserts 0 < region < min(prism1, prism2).",
    },
    "vision-loco": {
        "slug": "webglobe-raster", "code_repo": "webglobe-raster", "pkg": "webglobe",
        "blurb": "Tiled map-reduce raster aggregation for cloud-scale climate data (WebGlobe).",
        "algo": "WebGlobe aggregates large climate rasters with a tiled map-reduce: the raster is partitioned into tiles, per-tile partial aggregates (sum, count, max) are precomputed, and a bounding-box query combines only the relevant tiles. The framework's correctness invariant is that this tiled aggregation equals the direct full-array aggregation.",
        "result": "On a 180x360 global raster partitioned into a 6x8 tile grid, the tiled mean and max match the direct reference to ~3e-8 (the expected float64 accumulation-order difference). The test asserts agreement within a 1e-6 tolerance across several seeds and a non-tile-aligned bounding box.",
    },
    "legmanip": {
        "slug": "stdm-survey-toolkit", "code_repo": "stdm-survey-toolkit", "pkg": "stdm",
        "blurb": "Moran's I and spatial-outlier detection, representative tasks from the STDM survey.",
        "algo": "Two representative spatiotemporal-data-mining tasks from the survey: spatial autocorrelation via Moran's I (positive when nearby locations carry similar values) and spatial-outlier detection (a location whose value deviates sharply from its neighbors).",
        "result": "Moran's I is 0.934 on a spatially-autocorrelated field versus 0.043 on a random field, and a planted spatial outlier is flagged. The test asserts the clustered field's Moran's I clears 0.2 and exceeds the random field's, and that the outlier is detected.",
    },
    "pidiff": {
        "slug": "pi-dpm-trajectory-anomaly", "code_repo": "pi-grpo",
        "blurb": "Physics-informed conditional diffusion that scores trajectory anomalies via reconstruction + kinematic residuals.",
        "algo": "Pi-DPM is a conditional diffusion model over trajectories whose anomaly score combines the diffusion reconstruction residual with a scale-free kinematic-smoothness residual derived from a single-axle kinematic-bicycle prior. A trajectory the model reconstructs poorly, or that violates the physical motion envelope, receives a high anomaly score, flagging GPS spoofing or denial-based deception.",
        "result": "On synthetic trajectories with planted teleport, excess-speed and freeze anomalies, the reference implementation reaches AUROC 0.988 / AP 0.992 on CPU, cleanly separating the three anomaly families from normal tracks. The model lives in the pi-grpo repository (app/components/pidpm/) and feeds its physics-aware reward.",
    },
    "pggenfm": {
        "slug": "physics-guided-genfm", "code_repo": "physflow-earth",
        "blurb": "Physics-guided projection of generated samples to cut constraint violation in generative foundation models.",
        "algo": "A physics-guided generation step projects generated samples toward the physically-feasible manifold using the model's own physics residuals, lowering the constraint-violation of the output without retraining the base generator.",
        "result": "On the reference task the physics-guided projection reduces the mean physics-violation from 0.268 to 0.029, an 89.3% reduction. Implemented in the physflow-earth repository (src/physflow/pggenfm/).",
    },
    "kicdpm": {
        "slug": "kriging-informed-diffusion", "code_repo": "physflow-earth",
        "blurb": "Kriging-informed conditional diffusion for regional sea-level data downscaling.",
        "algo": "Ordinary kriging with an exponential variogram produces a geostatistical base field from the coarse observations; a conditional diffusion model then refines that base with a learned high-frequency residual, combining a calibrated spatial prior with generative detail for x4 downscaling.",
        "result": "The reference implementation trains the conditional denoiser cleanly and downscales x4. On the small, deliberately smooth synthetic field used here Ki-CDPM does not beat bilinear on pixel-RMSE (the well-known perception-distortion tradeoff); the deliverable is a correct, runnable implementation of the algorithm with honestly reported numbers. Implemented in the physflow-earth repository (src/physflow/kicdpm/).",
    },
}

# Page-generation order (full pages).
ORDER = ["intexpl", "sear", "leap", "vision-loco", "legmanip", "pidiff", "pggenfm", "kicdpm"]

# Short-paper summaries: point their "page" link to the full version's page, no duplicate page.
SHORT_OF = {"vrb": "stagd-trajectory-gap", "flavr": "tss-rendezvous-region"}


def load_pubs():
    p = os.path.join(ROOT, "assets", "publications.js")
    src = open(p).read()
    i, j = src.index("["), src.rindex("]")
    return p, src[:i], json.loads(src[i:j + 1]), src[j + 1:]


def body_html(meta, pub):
    repo = meta["code_repo"]
    abstract = html.escape(pub.get("abstract", "").strip())
    run = "pip install -e .\npytest"
    if meta.get("pkg"):
        run += f"\npython -m {meta['pkg']}.demo"
    return f"""<section id="abstract" class="abstract-block">
  <h2>Abstract</h2>
  <p>{abstract}</p>
</section>

<section id="algorithm">
  <h2>Algorithm</h2>
  <p>{html.escape(meta['algo'])}</p>
</section>

<section id="reference-implementation">
  <h2>Reference implementation</h2>
  <p>This page accompanies the open-source reference implementation at
    <a href="https://github.com/arunshar/{repo}" target="_blank" rel="noopener">github.com/arunshar/{repo}</a>,
    a faithful reimplementation of the paper's core algorithm on synthetic data, runnable end to end.</p>
  <p><strong>Measured (synthetic).</strong> {html.escape(meta['result'])}</p>
  <pre><code>{html.escape(run)}</code></pre>
</section>

<section id="scope">
  <h2>Scope</h2>
  <p>The numbers above are measured on synthetic, structured inputs that exercise the algorithm; they are
    not a reproduction of the paper's datasets or reported results. See the published paper (linked above)
    for the full method, datasets, and evaluation.</p>
</section>"""


def toc_html():
    items = [("abstract", "Abstract"), ("algorithm", "Algorithm"),
             ("reference-implementation", "Reference implementation"),
             ("scope", "Scope"), ("bibtex", "BibTeX")]
    lis = "".join(f'<li><a href="#{a}">{t}</a></li>' for a, t in items)
    return f'<nav class="toc" aria-label="Contents"><h2>Contents</h2><ul>{lis}</ul></nav>'


def buttons_html(pub, repo):
    parts = []
    if pub.get("titleUrl"):
        parts.append(f'<a class="btn" href="{html.escape(pub["titleUrl"])}" target="_blank" rel="noopener">Paper</a>')
    parts.append(
        f'<a class="btn btn-icon" href="https://github.com/arunshar/{repo}" target="_blank" '
        f'rel="noopener" title="Code on GitHub" aria-label="Code on GitHub">{GH_SVG}</a>')
    parts.append('<a class="btn" href="#bibtex">BibTeX</a>')
    return "\n      ".join(parts)


def add_link(pub, label, href):
    links = pub.setdefault("links", [])
    if not any(l.get("href") == href for l in links):
        links.append({"label": label, "href": href})


def main():
    pjs_path, prefix, pubs, suffix = load_pubs()
    by_id = {p["id"]: p for p in pubs}
    tmpl = open(os.path.join(ROOT, "tools", "project_template.html")).read()

    manifest_path = os.path.join(ROOT, "projects", "manifest.json")
    manifest = json.load(open(manifest_path))
    have = {m.get("slug") for m in manifest}

    for pid in ORDER:
        meta, pub = PUBS[pid], by_id[pid]
        slug, repo = meta["slug"], meta["code_repo"]
        teaser = ""
        if os.path.exists(os.path.join(ROOT, "assets", "figures", f"pub-{pid}.png")):
            teaser = (f'<figure class="teaser"><img src="../../assets/figures/pub-{pid}.png" '
                      f'alt="{html.escape(pub["title"])} figure" loading="lazy"></figure>')
        page = (tmpl
                .replace("{{TITLE}}", html.escape(pub["title"]))
                .replace("{{BLURB}}", html.escape(meta["blurb"]))
                .replace("{{CANONICAL}}", CANON.format(slug=slug))
                .replace("{{AUTHOR}}", html.escape(pub.get("authors", "Arun Sharma")))
                .replace("{{AFFILIATION}}", AFFIL)
                .replace("{{VENUE}}", html.escape(pub.get("venue", "")))
                .replace("{{BUTTONS}}", buttons_html(pub, repo))
                .replace("{{TEASER}}", teaser)
                .replace("{{TOC}}", toc_html())
                .replace("{{BODY}}", body_html(meta, pub))
                .replace("{{BIBTEX}}", html.escape(pub.get("bibtex", "").strip()))
                .replace('rendered from the LaTeX source',
                         'a reference-implementation landing page for the linked publication'))
        outdir = os.path.join(ROOT, "projects", slug)
        os.makedirs(outdir, exist_ok=True)
        open(os.path.join(outdir, "index.html"), "w").write(page)

        add_link(pub, "page", f"projects/{slug}/")
        add_link(pub, "code", f"https://github.com/arunshar/{repo}")

        if slug not in have:
            manifest.append({
                "slug": slug, "title": pub["title"], "venue": pub.get("venue", ""),
                "blurb": meta["blurb"], "teaser": f"assets/figures/pub-{pid}.png",
                "page": f"projects/{slug}/", "pdf": pub.get("titleUrl", ""),
                "github": f"https://github.com/arunshar/{repo}", "kind": "publication-reference",
            })
            have.add(slug)

    # short-paper summaries: link to the full version's page (no duplicate page)
    for pid, target_slug in SHORT_OF.items():
        if pid in by_id:
            add_link(by_id[pid], "page", f"projects/{target_slug}/")

    open(pjs_path, "w").write(prefix + json.dumps(pubs, indent=2, ensure_ascii=False) + suffix)
    json.dump(manifest, open(manifest_path, "w"), indent=2, ensure_ascii=False)
    print("pages:", [PUBS[p]["slug"] for p in ORDER])
    print("short-paper links:", SHORT_OF)


if __name__ == "__main__":
    main()
