#!/usr/bin/env python3
"""
render_tikz.py - render each tikzpicture in a paper to a clean, cropped SVG using
pdflatex (the same engine that builds the paper PDF) plus dvisvgm with fonts traced
to paths. This avoids the text-overflow / box-overlap that tex4ht's DVI->SVG path
introduces from font substitution: the figures come out exactly as in the paper PDF,
auto-cropped to the picture bounding box (no page-size tightness).

Used by build_site.py to replace make4ht's figure SVGs. Can also run standalone:
  python3 tools/render_tikz.py <paper.tex> <out_dir>
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

# Spread node POSITIONS apart (boxes/text keep their size) to undo the tight
# absolute-coordinate layouts in the source TikZ that overlap. Harmless to
# relative/positioning diagrams (node distance is unaffected by scale).
SCALE = 1.8


def _inject_scale(pic):
    marker = r"\begin{tikzpicture}"
    after = pic[len(marker):]
    if after.lstrip().startswith("["):
        idx = pic.index("[", len(marker))
        return pic[:idx + 1] + f"scale={SCALE}," + pic[idx + 1:]
    return marker + f"[scale={SCALE}]" + after


def _extract_block(text, macro):
    """Return list of full '\\macro{...}' strings with balanced braces."""
    out = []
    for m in re.finditer(r"\\" + macro + r"\s*\{", text):
        i = m.end() - 1
        depth = 0
        for j in range(i, len(text)):
            c = text[j]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    out.append(text[m.start():j + 1])
                    break
    return out


def _preamble_bits(tex):
    """Collect the figure-relevant preamble pieces from the paper source."""
    pre = tex.split(r"\begin{document}")[0]
    # drop the heavy \makeatletter...\makeatother block (NeurIPS title machinery)
    pre = re.sub(r"\\makeatletter.*?\\makeatother", "", pre, flags=re.S)
    bits = []
    bits += re.findall(r"\\usetikzlibrary\{[^}]*\}", pre)
    bits += _extract_block(pre, "tikzset")
    bits += re.findall(r"\\definecolor\{[^}]*\}\{[^}]*\}\{[^}]*\}", pre)
    bits += re.findall(r"\\newcommand\*?\{\\[A-Za-z]+\}(?:\[[0-9]\])?\{[^\n]*\}", pre)
    return "\n".join(bits)


def _tikz_pictures(tex):
    body = tex.split(r"\begin{document}", 1)[-1]
    return re.findall(r"\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}", body, flags=re.S)


STANDALONE = r"""\documentclass[border=6pt]{standalone}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{mathtools}
\usepackage{xcolor}
\usepackage{tikz}
%(bits)s
\begin{document}
%(pic)s
\end{document}
"""


def render_all(tex_path, out_dir, names=None):
    """Render each tikzpicture to out_dir. If names is given (ordered list of target
    svg filenames), write to those names; otherwise fig1.svg, fig2.svg, ...
    Returns the list of written svg Paths (in document order). Empty list on failure
    so the caller can fall back to the make4ht figures."""
    tex = Path(tex_path).read_text(errors="ignore")
    bits = _preamble_bits(tex)
    pics = _tikz_pictures(tex)
    if not pics:
        return []
    # only remap onto existing figure names when the counts line up 1:1,
    # otherwise bail so the caller keeps make4ht's figures (safe fallback)
    if names is not None and len(pics) != len(names):
        sys.stderr.write(
            f"  [render_tikz] {len(pics)} tikz vs {len(names)} svgs; skipping\n")
        return []
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    work = out_dir / "_tikz"
    if work.exists():
        shutil.rmtree(work)
    work.mkdir()
    written = []
    for i, pic in enumerate(pics):
        stem = f"fig{i+1}"
        (work / f"{stem}.tex").write_text(
            STANDALONE % {"bits": bits, "pic": _inject_scale(pic)})
        r = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", f"{stem}.tex"],
            cwd=str(work), capture_output=True, text=True)
        pdf = work / f"{stem}.pdf"
        if r.returncode != 0 or not pdf.exists():
            sys.stderr.write(f"  [render_tikz] pdflatex failed on {stem}\n")
            return []  # bail -> caller keeps make4ht svgs
        target = (out_dir / names[i]) if (names and i < len(names)) else (out_dir / f"{stem}.svg")
        # poppler's pdftocairo does vector PDF->SVG (this dvisvgm lacks PDF support)
        sv = subprocess.run(
            ["pdftocairo", "-svg", str(pdf), str(target)],
            cwd=str(work), capture_output=True, text=True)
        if sv.returncode != 0 or not target.exists():
            sys.stderr.write(f"  [render_tikz] pdftocairo failed on {stem}: {sv.stderr[-300:]}\n")
            return []
        written.append(target)
    shutil.rmtree(work, ignore_errors=True)
    return written


if __name__ == "__main__":
    outs = render_all(sys.argv[1], sys.argv[2])
    print(f"rendered {len(outs)} figures: {[p.name for p in outs]}")
