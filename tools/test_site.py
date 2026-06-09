#!/usr/bin/env python3
"""
test_site.py - offline unit + smoke tests for the portfolio site.

Validates the publication data model, every publication thumbnail asset, the
homepage wiring, and the render contract in main.js. Network-free; for the live
end-to-end production test see test_e2e.py / qa_check.py.

Run:  python3 tools/test_site.py            (verbose unittest)
      python3 tools/test_site.py -q         (quiet)
"""

import json
import os
import re
import unittest

from PIL import Image, ImageStat

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBS_JS = os.path.join(ROOT, "assets", "publications.js")
FIG_DIR = os.path.join(ROOT, "assets", "figures")
INDEX = os.path.join(ROOT, "index.html")
MAIN_JS = os.path.join(ROOT, "assets", "main.js")

# The 16 figures added in this session (the rest were pre-existing).
ADDED_IDS = [
    "pidiff", "gcdm", "pggenfm", "smhybrid", "supercol", "mbor", "kicdpm",
    "intexpl", "extreme-parkour", "diffcls", "sear", "leap", "swim",
    "crossmodal_2023", "legmanip", "vision-loco",
]
PREEXISTING_IDS = ["ftbsc_kgml", "statcol", "fdrcol", "vrb", "flavr", "alan"]
EXPECTED_TOTAL = 22


def load_pubs():
    txt = open(PUBS_JS, encoding="utf-8").read()
    arr = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
    return txt, arr


PUBS_TXT, PUBS = load_pubs()
BY_ID = {e.get("id"): e for e in PUBS}


class TestPublicationsData(unittest.TestCase):
    """Unit tests on the publications.js data model."""

    def test_parses_as_json_array(self):
        self.assertIsInstance(PUBS, list)
        self.assertGreater(len(PUBS), 0)

    def test_prefix_preserved(self):
        self.assertIn("window.LEGACY_PUBLICATIONS =", PUBS_TXT[:120])
        self.assertTrue(PUBS_TXT.rstrip().endswith("];"))

    def test_entry_count_is_22(self):
        self.assertEqual(len(PUBS), EXPECTED_TOTAL)

    def test_ids_unique_and_nonempty(self):
        ids = [e.get("id") for e in PUBS]
        self.assertTrue(all(ids), "every entry must have a non-empty id")
        self.assertEqual(len(ids), len(set(ids)), "ids must be unique (also used as DOM anchors)")

    def test_required_fields_present(self):
        for e in PUBS:
            with self.subTest(id=e.get("id")):
                for f in ("id", "title", "authors", "venue", "bibtex"):
                    self.assertTrue(str(e.get(f, "")).strip(), f"{f} missing/empty")

    def test_author_includes_arun(self):
        for e in PUBS:
            with self.subTest(id=e.get("id")):
                self.assertIn("Arun Sharma", e.get("authors", ""),
                              "author string must contain 'Arun Sharma' (it gets bolded)")

    def test_titleurl_is_http(self):
        for e in PUBS:
            with self.subTest(id=e.get("id")):
                url = e.get("titleUrl", "")
                self.assertRegex(url, r"^https?://", "titleUrl should be an absolute http(s) URL")

    def test_links_well_formed(self):
        for e in PUBS:
            for lk in e.get("links", []):
                with self.subTest(id=e.get("id"), label=lk.get("label")):
                    self.assertTrue(str(lk.get("label", "")).strip(), "link label empty")
                    self.assertRegex(lk.get("href", ""), r"^https?://", "link href not http(s)")

    def test_every_entry_has_image(self):
        missing = [e["id"] for e in PUBS if not e.get("image")]
        self.assertEqual(missing, [], f"entries missing image: {missing}")

    def test_image_paths_canonical(self):
        for e in PUBS:
            with self.subTest(id=e["id"]):
                self.assertEqual(e.get("image"), f"assets/figures/pub-{e['id']}.png")

    def test_added_and_preexisting_account_for_all(self):
        ids = {e["id"] for e in PUBS}
        self.assertEqual(ids, set(ADDED_IDS) | set(PREEXISTING_IDS))


class TestFigureAssetsSmoke(unittest.TestCase):
    """Smoke test thumbnails.

    Universal VALIDITY checks run on all 22 (present, valid PNG, sane, not blank).
    The stricter thumbnail-IDEAL spec (downscaled, landscape, lean file) runs only
    on the 16 figures added this session; the 6 pre-existing ones predate it.
    """

    def _validity(self, eid):
        path = os.path.join(ROOT, BY_ID[eid]["image"])
        self.assertTrue(os.path.exists(path), f"{path} does not exist")
        self.assertGreater(os.path.getsize(path), 1500, "file suspiciously tiny")
        self.assertLess(os.path.getsize(path), 2_000_000, "file unexpectedly large (>2MB)")
        # integrity: verify() then reopen (verify() leaves the file unusable)
        Image.open(path).verify()
        im = Image.open(path).convert("RGB")
        w, h = im.size
        self.assertGreaterEqual(w, 200, "width too small for a 200px-wide thumb box")
        self.assertGreaterEqual(h, 90, "height too small")
        self.assertLessEqual(max(w, h), 2200, "image absurdly large")
        # not blank: enough non-near-white content
        small = im.resize((120, 120))
        px = list(small.getdata())
        non_white = sum(1 for r, g, b in px if not (r > 245 and g > 245 and b > 245))
        frac = non_white / len(px)
        self.assertGreater(frac, 0.02, f"image looks blank (only {frac:.1%} non-white)")
        # some tonal variation (catches a flat color fill)
        stdev = sum(ImageStat.Stat(im).stddev) / 3
        self.assertGreater(stdev, 5, "image has almost no variation (flat fill?)")

    def _ideal_thumb(self, eid):
        path = os.path.join(ROOT, BY_ID[eid]["image"])
        self.assertLess(os.path.getsize(path), 800_000, "added thumb should be lean (<800KB)")
        w, h = Image.open(path).size
        self.assertLessEqual(max(w, h), 1400, "added thumb should be downscaled to <=1400px")
        self.assertGreaterEqual(w / h, 1.0, "added thumb should be landscape (200x120 cover crop)")
        self.assertLessEqual(w / h, 4.0, "added thumb too wide; cover crop would lose most content")

    def test_all_22_thumbnails_valid(self):
        for eid in BY_ID:
            with self.subTest(id=eid):
                self._validity(eid)

    def test_each_added_figure_individually(self):
        # explicit per-feature smoke for the 16 added this session
        for eid in ADDED_IDS:
            with self.subTest(added=eid):
                self.assertIn(eid, BY_ID, "added id not in publications.js")
                self._validity(eid)
                self._ideal_thumb(eid)

    def test_added_thumbs_landscape_and_lean(self):
        # 200x120 cover crop favours landscape; the 16 added were cropped for it.
        for eid in ADDED_IDS:
            w, h = Image.open(os.path.join(ROOT, BY_ID[eid]["image"])).size
            with self.subTest(id=eid, ratio=round(w / h, 2)):
                self._ideal_thumb(eid)

    def test_no_orphan_pub_figures(self):
        referenced = {os.path.basename(e["image"]) for e in PUBS}
        on_disk = {f for f in os.listdir(FIG_DIR) if re.fullmatch(r"pub-.+\.png", f)}
        orphans = on_disk - referenced
        self.assertEqual(orphans, set(), f"unreferenced pub-*.png files: {sorted(orphans)}")
        missing = referenced - on_disk
        self.assertEqual(missing, set(), f"referenced but missing on disk: {sorted(missing)}")


class TestHomepageWiring(unittest.TestCase):
    """Unit tests on index.html + main.js render contract."""

    def setUp(self):
        self.index = open(INDEX, encoding="utf-8").read()
        self.mainjs = open(MAIN_JS, encoding="utf-8").read()

    def test_assets_cache_busted_consistently(self):
        vers = set(re.findall(r"assets/(?:academic\.css|main\.js|publications\.js)\?v=([0-9a-z]+)",
                              self.index))
        self.assertEqual(len(vers), 1, f"asset versions should match, found {vers}")
        self.assertRegex(vers.pop(), r"^20\d{6}[a-z]$", "version not in YYYYMMDDx form")

    def test_publication_list_container_exists(self):
        self.assertIn('id="publication-list"', self.index)

    def test_render_handles_image_thumbnail(self):
        self.assertIn("renderPublications", self.mainjs)
        self.assertIn("has-thumb", self.mainjs)
        self.assertIn("p.image", self.mainjs)
        self.assertIn("pub-thumb", self.mainjs)

    def test_render_bolds_arun(self):
        self.assertIn('"Arun Sharma", "<strong>Arun Sharma</strong>"', self.mainjs)


if __name__ == "__main__":
    unittest.main(verbosity=2)
