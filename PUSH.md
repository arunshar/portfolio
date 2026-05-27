# Push checklist

The four repos are initialized locally with passing tests. Run these to publish.

## 1. Create + push GitHub repos (public)

```bash
cd ~/Desktop/cv-portfolio

for proj in sat-splat-distort physflow-earth geosam-3d trajprompt; do
  pushd "$proj" >/dev/null
  desc=$(grep -m1 '^>' README.md | sed 's/^> *//')
  gh repo create "arunshar/$proj" --public --description "$desc" --source=. --push
  popd >/dev/null
done
```

If you'd rather start private and flip public later, swap `--public` for `--private` and run `gh repo edit arunshar/<proj> --visibility public` when you're ready.

## 2. HF Space stubs

Create empty Spaces as scaffolds (Gradio runtime). The scripts in each `space/` dir are ready to run.

```bash
hf auth login   # one-time; `huggingface-cli` is now deprecated, use `hf`

for proj in sat-splat-distort physflow-earth geosam-3d trajprompt; do
  hf_name="Arun0808/${proj}"
  hf repos create "$hf_name" --type space --space-sdk gradio --public --exist-ok
  hf upload "$hf_name" ~/Desktop/cv-portfolio/$proj/space --repo-type space
done
```

## 3. HF model stubs

Empty model cards so the README badges resolve. Replace with real weights after training.

```bash
for slug in \
  "Arun0808/satsplat-distort-dfc2019" \
  "Arun0808/physflow-sentinel2-x4" \
  "Arun0808/physflow-era5-precip" \
  "Arun0808/geosam3d-scannet" \
  "Arun0808/trajprompt-clip-ais"; do
  hf repos create "$slug" --type model --public --exist-ok
done
```

## 4. Verify locally before publishing

Each project has a venv that runs the math tests offline:

```bash
for proj in sat-splat-distort physflow-earth geosam-3d trajprompt; do
  cd ~/Desktop/cv-portfolio/$proj
  source .venv/bin/activate
  pytest -q
  deactivate
done
```

Expected: 7 + 8 + 4 + 6 = 25 passing.
