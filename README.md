# cv-portfolio

Five projects converting "Spatial AI PhD" into "Computer Vision / Remote Sensing / 3D / Generative AI applied scientist." Each ships to Hugging Face (Space + model card) and GitHub. Workshop papers in parallel; CVPR / NeurIPS upgrade path in 2027.

Open [`index.html`](index.html) for the polished portfolio site.

| Project | Pitch | HF Space | GitHub | Math tests | Smoke tests | Gradio launches |
| --- | --- | --- | --- | --- | --- | --- |
| [sat-splat-distort](sat-splat-distort/) | Distortion-aware 3D Gaussian Splatting for satellite RPC, pushbroom, fisheye, 360 | spaces/Arun0808/sat-splat-distort | arunshar/sat-splat-distort | 7/7 | 13/13 | HTTP 200 |
| [physflow-earth](physflow-earth/) | Physics-informed rectified flow for Sentinel-2 SR + ERA5/CHIRPS climate downscaling | spaces/Arun0808/physflow-earth | arunshar/physflow-earth | 8/8 | 12/12 | HTTP 200 |
| [geosam-3d](geosam-3d/) | Promptable 3D scene segmentation from monocular video with heat-method geodesic propagation | spaces/Arun0808/geosam-3d | arunshar/geosam-3d | 4/4 | 11/11 | HTTP 200 |
| [trajprompt](trajprompt/) | Open-vocabulary maritime intelligence: SAM 2 + Prithvi-2 + TGARD | spaces/Arun0808/trajprompt | arunshar/trajprompt | 6/6 | 12/12 | HTTP 200 |
| [darkvessel-stack](darkvessel-stack/) | Multi-modal remote sensing for dark vessel detection: Sentinel-1 SAR + Sentinel-2 + AIS through Prithvi-2 / Clay / SatMAE++ / DOFA / SatlasNet / RemoteCLIP, with TGARD + Pi-DPM anomaly reasoning | spaces/Arun0808/darkvessel-stack | arunshar/darkvessel-stack | 15/15 | (scaffold) | (scaffold) |

Current local verification: **88 pytest cases passing** across the five projects; the original four Gradio apps boot and serve HTTP 200, darkvessel-stack ships as a scaffold for the xView3 leaderboard run.

## Additional projects linked from the portfolio site

These have their own GitHub repos and HF Spaces, but live outside the cv-portfolio test harness above. They appear as project cards on [`index.html`](index.html).

| Project | Pitch | HF Space | GitHub |
| --- | --- | --- | --- |
| pin-service | Production-grade gRPC microservice for AV ride-hail pickup/drop-off pin selection (H3 + HD-map + ML scoring + congestion control + OTel + Prometheus). 20 unit tests passing. | spaces/Arun0808/pin-service | arunshar/pin-service |
| pi-grpo | Physics-informed RL with Group Relative Policy Optimization for trajectory generation and reasoning. Shared PPO, DPO, and GRPO trainers over a hybrid kinematic-bicycle + Pi-DPM reward. | spaces/Arun0808/pi-grpo | arunshar/pi-grpo |
| geotrace-agent | Production multi-agent framework for spatiotemporal reasoning with Hägerstrand space-time prisms, MCP tools, and JSON-RPC A2A messaging. | spaces/Arun0808/geotrace-agent | arunshar/geotrace-agent |
| mapfix-spatial | Distortion-aware interactive geospatial correction MVP, with a deterministic fallback engine and optional GPT analysis backend. | spaces/Arun0808/mapfix-spatial | arunshar/mapfix-spatial |

## Reusable test scripts

- [`launch_smoke.py`](launch_smoke.py): boots a Gradio app on a free local port, polls for HTTP 200, asserts Gradio HTML in body. Run as `python launch_smoke.py <repo_root> <app_relpath>`.
- [`req_resolve.py`](req_resolve.py): dry-run resolves `space/requirements.txt` (skipping the post-push `git+` ref). Run as `python req_resolve.py <repo>/space/requirements.txt`.

## Sequencing (12 weeks + RS sprint)

| Weeks | Project | Output |
| --- | --- | --- |
| 1-3 | sat-splat-distort | HF Space + GitHub + EarthVision draft |
| 4-6 | physflow-earth | HF Space + Diffusers model + Climate Change AI workshop draft |
| 7-9 | geosam-3d | HF Space + GitHub + 3DV workshop draft |
| 10-12 | trajprompt | HF Space + GitHub + EarthVision / D&B draft |
| 13-16 | darkvessel-stack | HF Space + GitHub + xView3 leaderboard submission + EarthVision draft |

## Per-project quickstart

```bash
cd <project>
uv venv --python 3.11 .venv
source .venv/bin/activate
uv pip install -e ".[dev,space]"
pytest
```

## Compute plan

- UMN MSI / Polaris HPC for training (sat-splat 80 A100h, physflow 480 A100h, geosam-3d 120 A100h, trajprompt 50 A100h).
- Cloud (Lambda / Modal) for HF Space inference. Per-Space cap ~30-50 USD/month.
- Total cloud cap across all four: 500 USD.

## Workshop submission targets

- NeurIPS 2026 Climate Change AI: physflow-earth.
- NeurIPS 2026 Datasets and Benchmarks: trajprompt curated AIS-text pairs dataset.
- CVPR 2027 EarthVision: sat-splat-distort + trajprompt + darkvessel-stack.
- ICCV 2027 / CVPR 2027 4DV-W: geosam-3d.
- Allen AI xView3-SAR leaderboard: darkvessel-stack.
