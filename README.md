# arunshar.github.io/portfolio

Academic homepage and per-project paper pages for Arun Sharma, served via GitHub Pages
at https://arunshar.github.io/portfolio/.

## Layout

- `index.html` - homepage (academic style: bio, news, selected projects, publications, teaching, links).
- `assets/` - `academic.css` (homepage), `paper.css` + `paper.js` (project pages), `main.js`, `publications.js`, the profile photo, and `papers/<slug>.pdf` (project PDFs).
- `projects/<slug>/` - one page per selected project: the full paper rendered to HTML
  (`index.html`), `figures/*.svg`, and a Markdown copy (`paper.md`). `projects/manifest.json`
  records the entries shown on the homepage.
- `data/` - CV, research/teaching/diversity statements, thesis PDFs, bio.
- `tools/` - the static generator that builds the project pages.

## Rebuilding the project pages

Project pages are generated from each project's LaTeX paper with `make4ht` (TeX-native
HTML: TikZ figures become SVG, math renders via MathJax, tables and citations are
preserved), then wrapped in `tools/project_template.html`.

Requirements: `make4ht` / `dvisvgm` / `bibtex` (TeX Live), `pandoc`, and Python with `lxml`.
Project metadata and links live in `tools/projects.json`.

```bash
python3 tools/build_site.py            # rebuild all project pages + splice homepage entries
python3 tools/build_site.py <slug> ... # rebuild specific projects
python3 tools/build_site.py --splice-only   # refresh homepage Selected Projects from manifest
```

The build reads paper sources from the sibling project repos (each `<slug>` also has its
own GitHub repo and Hugging Face Space); those source trees are not committed here.
