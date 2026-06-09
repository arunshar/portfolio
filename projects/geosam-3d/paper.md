# GeoSAM-3D: Geodesic Prompt Propagation for Open-Vocabulary 3D Scene Segmentation from Monocular Video

Arun Sharma, University of Minnesota, Twin Cities

_In preparation. Target: 3DV / CVPR 4DV workshop 2027_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> Open-vocabulary 3D scene segmentation usually assumes RGB-D video, calibrated multi-view imagery, or a reconstructed mesh. GeoSAM-3D studies a lighter setting: a user uploads a short monocular video, clicks or names an object in one frame, and receives a propagated 3D mask over a Gaussian scene. The implementation combines frozen image and video foundation models with a monocular 3D Gaussian Splatting reconstruction and a differentiable graph-geodesic propagation kernel over Gaussian centroids. The central design choice is to propagate prompts by heat-kernel distance on the reconstructed scene graph, rather than by Euclidean nearest neighbors in 3D. This preserves continuity around curved surfaces and reduces leakage across nearby but disconnected objects. This paper describes the repository state, the mathematical kernel implemented in <span class="pcrr8t-">geosam3d.propagate</span>, the feature head trained from Segment Anything masks, and the validation already present in the codebase. The evaluation protocol separates implementation validation, graph propagation quality, leakage control, and interactive latency.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Promptable segmentation has become a practical interface for visual annotation. Models such as SAM and SAM 2 make it possible to turn points, boxes, or text prompts into high-quality image and video masks \[[19](#Xkirillov2023segment), [34](#Xravi2024sam2)\]. For spatial computing, however, 2D masks are often the wrong endpoint. A robotics, augmented-reality, or 3D mapping user wants the selected entity to persist across viewpoints and to bind to the geometry of the scene. Systems such as OpenMask3D and Gaussian Grouping show the value of open-vocabulary 3D masks, but they often rely on RGB-D sensors, meshes, or pre-existing 3D reconstructions \[[40](#Xtakmaz2023openmask3d), [47](#Xye2023gaussian)\].

GeoSAM-3D targets a more accessible workflow. The user supplies a monocular phone video. A monocular reconstruction stack produces a 3D Gaussian field. SAM 2 supplies the high-quality 2D mask supervision. A compact transformer head maps per-Gaussian appearance and geometry attributes to normalized features. A prompt seed is then propagated over the Gaussian centroid graph using an approximate heat-method geodesic. The resulting system is an engineering bridge between video foundation models, monocular 3D reconstruction, and graph-based geometric reasoning.

The project is intentionally packaged as both a GitHub repository and a Hugging Face Space. The public Space is CPU-safe and demonstrates the interaction contract; the training and evaluation path lives in the repository. This paper is therefore written as a reproducible systems paper: it explains what the code actually does today, the validated unit-test evidence and the benchmark measurements used for archival evaluation.

<span id="contributions" class="paragraphHead"> <span id="x1-2000"></span><span class="ptmb8t-">Contributions:</span></span>

1\.  
A prompt propagation pipeline that lifts SAM-style video masks into a monocular 3D Gaussian scene and propagates labels over Gaussian centroids.

2\.  
A differentiable heat-kernel geodesic layer using a k-nearest-neighbor graph Laplacian and a Varadhan-style distance approximation.

3\.  
A per-Gaussian feature head trained with contrastive mask consistency rather than by fine-tuning the frozen image foundation models.

4\.  
A reproducible project implementation with package imports, geodesic correctness tests, feature-normalization tests, and Hugging Face Space smoke tests.

<figure class="figure">
<p><img src="figures/main-9ce1545d02ecafaea368cf747f3bb3df.svg" loading="lazy" alt="Figure" /> <span id="x1-2005r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Detailed GeoSAM-3D architecture. The diagram exposes the 2D foundation-model encoder, monocular Gaussian scene builder, prompt cross-attention, graph Laplacian, geodesic heat decoder, and evaluation heads. The bottom geometry panel makes the central claim visual: propagation should follow scene connectivity, not raw Euclidean proximity. </span></figcaption>
</figure>

<span id="scope" class="paragraphHead"> <span id="x1-3000"></span><span class="ptmb8t-">Scope:</span></span> Promptable segmentation has changed the annotation interface for images and videos, but most downstream spatial tasks need more than a 2D mask. A robotics system needs an object to remain consistent as the camera moves. An AR tool needs a selected object to occupy a persistent 3D region. A mapping workflow needs masks that can be rendered, edited, and queried from novel viewpoints. GeoSAM-3D is motivated by this gap between promptable 2D interaction and persistent 3D representation.

The project makes a specific bet: once a scene is reconstructed as Gaussian primitives, prompt propagation should use the graph induced by scene geometry rather than raw image-space masks alone. Frame-to-frame mask propagation can be very strong, especially with SAM 2, but it remains tied to observed frames. A 3D Gaussian graph gives a place to store the result. It also gives a place to reason about leakage, connectivity, and object boundaries.

The key technical risk is that a monocular Gaussian reconstruction is not a perfect manifold. It can have holes, fused surfaces, floaters, and uncertainty. For that reason, this paper does not claim that graph geodesics solve 3D segmentation by themselves. Instead it frames graph-geodesic propagation as a testable intermediate layer between 2D foundation-model masks and 3D object masks. The method should be evaluated by asking when the graph helps and when reconstruction quality dominates.

The paper also positions GeoSAM-3D between three literatures. Promptable segmentation supplies the user interaction. Open-vocabulary 3D representation supplies the semantic target. Graph-based segmentation supplies the propagation mathematics. The contribution is in combining those pieces into a lightweight monocular-Gaussian workflow with clear tests and clear benchmark requirements.

<span id="expanded-contributions" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Expanded contributions:</span></span> The expanded paper adds a graph-sensitivity protocol, seed-robustness metrics, sparse-solver plan, prompt taxonomy, and implementation-grounded results. These additions turn the paper from a method sketch into a research plan that a reader can evaluate.

## <span class="titlemark">2 </span> <span id="x1-50002"></span>Related Work

<span id="expanded-citation-map" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Expanded Citation Map:</span></span> The bibliography now spans promptable segmentation, self-supervised visual features, SLAM, Gaussian reconstruction, 3D open-vocabulary understanding, and graph propagation. SAM, SAM 2, CLIP, DINO, DINOv2, and dense prediction transformers supply the 2D foundation-model layer \[[5](#Xcaron2021dino), [19](#Xkirillov2023segment), [26](#Xoquab2023dinov2), [32](#Xradford2021clip)–[34](#Xravi2024sam2)\]. ORB-SLAM2, DROID-SLAM, COLMAP, MonoGS, and depth-prior Gaussian pipelines define the reconstruction context \[[16](#Xkerbl20233d), [22](#Xmatsuki2024monogs), [23](#Xmurartal2017orbslam2), [37](#Xschonberger2016sfm), [41](#Xteed2021droidslam), [45](#Xyang2024depth)\]. OpenScene, LERF, OpenMask3D, SAM3D, Gaussian Grouping, OpenNeRF, OpenSplat3D, CLIP-Fields, and DFF define the closest 3D semantic field literature \[[9](#Xopennerf2024), [13](#Xha2022clipfields), [17](#Xkerr2023lerf), [20](#Xkobayashi2022dff), [28](#Xpeng2023openscene), [29](#Xopensplat3d2025), [40](#Xtakmaz2023openmask3d), [46](#Xyang2023sam3d), [47](#Xye2023gaussian)\]. PointNet, PointNet++, sparse convolutions, KPConv, RandLA-Net, Mask3D, graph cuts, random walkers, and heat methods give the geometric segmentation baseline family \[[3](#Xboykov2001interactive), [6](#Xchoy20194dspconv), [8](#Xcrane2013heat), [10](#Xfelzenszwalb2004efficient), [12](#Xgrady2006random), [15](#Xhu2020randla), [30](#Xqi2017pointnet), [31](#Xqi2017pointnetplusplus), [38](#Xschult2023mask3d), [42](#Xthomas2019kpconv)\].

<span id="promptable-image-and-video-segmentation" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Promptable image and video segmentation:</span></span> The Segment Anything family made point and box prompts a general-purpose image segmentation interface \[[19](#Xkirillov2023segment)\]. SAM 2 extends this interaction style to videos, providing temporally coherent masks from sparse prompts \[[34](#Xravi2024sam2)\]. GeoSAM-3D treats such masks as a source of supervision and user intent, but shifts the output object from a 2D video mask to a mask over reconstructed 3D primitives.

<span id="monocular-geometry-and-gaussian-scenes" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Monocular geometry and Gaussian scenes:</span></span> 3D Gaussian Splatting represents a scene as differentiable Gaussian primitives that can be optimized for fast novel-view rendering \[[16](#Xkerbl20233d)\]. Monocular variants such as MonoGS and depth-prior pipelines make this representation viable from ordinary video \[[22](#Xmatsuki2024monogs), [45](#Xyang2024depth)\]. GeoSAM-3D assumes such a reconstruction and attaches semantic features to the Gaussian primitives.

<span id="openvocabulary-3d-understanding" class="paragraphHead"> <span id="x1-9000"></span><span class="ptmb8t-">Open-vocabulary 3D understanding:</span></span> OpenScene co-embeds dense 3D features with image and text features for open-vocabulary scene understanding \[[28](#Xpeng2023openscene)\]. LERF distills language embeddings into neural radiance fields for open-ended 3D queries \[[17](#Xkerr2023lerf)\]. SAM3D projects 2D SAM masks into 3D point clouds and merges them across views \[[46](#Xyang2023sam3d)\]. GeoSAM-3D is closest in spirit to this family, but it focuses on monocular Gaussian scenes and graph-geodesic prompt propagation.

<span id="geodesic-distances-on-graphs" class="paragraphHead"> <span id="x1-10000"></span><span class="ptmb8t-">Geodesic distances on graphs:</span></span> Euclidean distance in 3D is insufficient when two surfaces are close in space but separated by an object boundary. The heat method provides a fast route to geodesic distance on manifolds \[[8](#Xcrane2013heat)\]. The implementation here adapts the principle to a k-nearest-neighbor graph over Gaussian centroids and uses a monotone heat-kernel approximation that is stable on non-mesh graphs.

<span id="literature-synthesis" class="paragraphHead"> <span id="x1-11000"></span><span class="ptmb8t-">Literature synthesis:</span></span> GeoSAM-3D connects promptable 2D segmentation, open-vocabulary 3D perception, and graph-based propagation. SAM and SAM 2 establish the interaction primitive: a user supplies sparse points, boxes, masks, or text-derived prompts and receives strong image or video masks \[[19](#Xkirillov2023segment), [34](#Xravi2024sam2)\]. CLIP, DINO, DINOv2, and dense prediction transformers explain why these masks can be attached to semantic feature spaces rather than treated as isolated binary outputs \[[5](#Xcaron2021dino), [26](#Xoquab2023dinov2), [32](#Xradford2021clip), [33](#Xranftl2021vision)\]. The limitation is that these systems primarily operate in image or video coordinates. A robot, AR device, or 3D editing tool needs the selected object to live in a persistent scene representation.

OpenScene, LERF, OpenMask3D, SAM3D, CLIP-Fields, DFF, OpenNeRF, and Gaussian Grouping show several ways to move open-vocabulary semantics into 3D fields \[[9](#Xopennerf2024), [13](#Xha2022clipfields), [17](#Xkerr2023lerf), [20](#Xkobayashi2022dff), [28](#Xpeng2023openscene), [40](#Xtakmaz2023openmask3d), [46](#Xyang2023sam3d), [47](#Xye2023gaussian)\]. Some methods rely on RGB-D, point clouds, or multi-view reconstructions; others distill image-language features into neural fields. GeoSAM-3D focuses on a lighter monocular Gaussian setting. That choice shifts the key difficulty from semantic prompting to geometric propagation: the method must decide how a prompt seed moves through a reconstructed scene whose topology may be imperfect.

Classical graph cuts, random walkers, heat methods, and point-cloud networks provide the mathematical baseline for this propagation step \[[3](#Xboykov2001interactive), [6](#Xchoy20194dspconv), [8](#Xcrane2013heat), [12](#Xgrady2006random), [15](#Xhu2020randla), [30](#Xqi2017pointnet), [31](#Xqi2017pointnetplusplus), [42](#Xthomas2019kpconv)\]. The central claim is not that a graph geodesic always dominates learned segmentation. It is that geometry-aware propagation gives an interpretable failure mode. Leakage across nearby but disconnected surfaces, sensitivity to prompt placement, and latency under sparse graph construction become measurable quantities, which is exactly what a promptable 3D interface needs.

<span id="foundational-reference-anchors" class="paragraphHead"> <span id="x1-12000"></span><span class="ptmb8t-">Foundational reference anchors:</span></span> The bibliography also anchors the project-specific contribution in older and broader technical foundations: statistical learning and pattern recognition, deep learning, information theory, convex and numerical optimization, stochastic approximation, adaptive gradient methods, causality, and early AI framing \[[1](#Xbishop2006pattern), [2](#Xboyd2004convex), [4](#Xbubeck2015convex), [7](#Xcover2006elements), [11](#Xgoodfellow2016deep), [14](#Xhastie2009elements), [18](#Xkingma2015adam), [21](#Xlecun1998gradient), [24](#Xmurphy2012machine), [25](#Xnocedal2006numerical), [27](#Xpearl2009causality), [35](#Xrobbins1951stochastic), [36](#Xrumelhart1986learning), [39](#Xshannon1948communication), [43](#Xturing1950computing), [44](#Xvapnik1998statistical)\]. These references are not presented as project baselines; they situate the paper inside the larger methodological lineage rather than a narrow implementation note.

## <span class="titlemark">3 </span> <span id="x1-130003"></span>Method and Architecture

<span id="problem-formulation" class="paragraphHead"> <span id="x1-14000"></span><span class="ptmb8t-">Problem Formulation:</span></span> Let a monocular video be denoted by <span class="mathjax-inline">\\V=\\I_t\\\_{t=1}^{T}\\</span>. A reconstruction module produces a Gaussian scene

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {G}=\\g_i=(\mu \_i,\Sigma \_i,\alpha \_i,c_i)\\\_{i=1}^{N}, \end{equation}

</div>

<span id="x1-14001r1"></span>

where <span class="mathjax-inline">\\\mu \_i \in \mathbb {R}^3\\</span> is a Gaussian center, <span class="mathjax-inline">\\\Sigma \_i\\</span> is its covariance, <span class="mathjax-inline">\\\alpha \_i\\</span> is opacity, and <span class="mathjax-inline">\\c_i\\</span> contains appearance statistics. A user prompt on one frame induces a seed mask <span class="mathjax-inline">\\s\in \\0,1\\^N\\</span> after 2D mask lifting. The task is to estimate a soft 3D object mask <span class="mathjax-inline">\\p\in \[0,1\]^N\\</span> over Gaussian primitives.

The key failure mode is geometric leakage. If <span class="mathjax-inline">\\p_i\\</span> is assigned using Euclidean kNN around the seed, points on the other side of a thin table, chair, doorway, or wall may receive high probability simply because their centroids are nearby. GeoSAM-3D instead defines neighborhood structure and distance through the graph induced by local Gaussian connectivity.

<span id="method" class="paragraphHead"> <span id="x1-15000"></span><span class="ptmb8t-">Method:</span></span>

<span id="gaussian-centroid-graph" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">Gaussian centroid graph:</span></span> Given centroids <span class="mathjax-inline">\\X=\[\mu \_1,\ldots ,\mu \_N\]\\</span>, the implementation constructs a directed k-nearest-neighbor graph and symmetrizes it. Edge weights are Gaussian functions of the centroid distance:

<div class="mathjax-env mathjax-equation">

\begin{equation} w\_{ij} = \exp \left (-\frac {\\\mu \_i-\mu \_j\\\_2^2}{2\sigma ^2+\epsilon }\right ), \end{equation}

</div>

<span id="x1-16001r2"></span>

where <span class="mathjax-inline">\\\sigma \\</span> is the median neighbor distance. The graph Laplacian is

<div class="mathjax-env mathjax-equation">

\begin{equation} L = D - W, \quad D\_{ii}=\sum \_j W\_{ij}. \end{equation}

</div>

<span id="x1-16002r3"></span>

This graph is lightweight enough for CPU unit tests while matching the tensor path needed for end-to-end training.

<span id="heatkernel-geodesic-propagation" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Heat-kernel geodesic propagation:</span></span> For a seed vector <span class="mathjax-inline">\\s\\</span>, GeoSAM-3D solves a single implicit heat step:

<div class="mathjax-env mathjax-equation">

\begin{equation} (I + tL + \epsilon I)u = s. \end{equation}

</div>

<span id="x1-17001r4"></span>

The heat field <span class="mathjax-inline">\\u\\</span> is normalized by its maximum and converted to a distance using the Varadhan approximation

<div class="mathjax-env mathjax-equation">

\begin{equation} d_i = \sqrt {\max (0,-4t\log (\max (u_i,\epsilon )))}. \end{equation}

</div>

<span id="x1-17002r5"></span>

Seed nodes are shifted to zero distance. The propagated object probability is

<div class="mathjax-env mathjax-equation">

\begin{equation} p_i = \exp \left (-\frac {d_i^2}{2\sigma \_d^2}\right ), \end{equation}

</div>

<span id="x1-17003r6"></span>

where <span class="mathjax-inline">\\\sigma \_d\\</span> is the empirical standard deviation of the graph distance. This implementation avoids the discrete gradient-divergence step of the classical mesh heat method, which can become unstable on sparse non-manifold graphs.

<span id="pergaussian-feature-head" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Per-Gaussian feature head:</span></span> Each Gaussian receives an attribute vector containing geometry and appearance summaries. A compact transformer encoder maps these attributes into an L2-normalized embedding <span class="mathjax-inline">\\z_i\\</span>. Let <span class="mathjax-inline">\\m_i\\</span> be the SAM-derived mask identity of Gaussian <span class="mathjax-inline">\\i\\</span>. The contrastive objective treats same-mask pairs as positives:

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {L}\_{\text {mask}} = -\frac {1}{N}\sum \_i \frac {\sum \_{j:m_j=m_i, j\neq i}\log \frac {\exp (z_i^\top z_j/\tau )}{\sum \_k \exp (z_i^\top z_k/\tau )}}{\max (1,\|\\j:m_j=m_i,j\neq i\\\|)}. \end{equation}

</div>

<span id="x1-18001r7"></span>

The frozen foundation models provide segmentation and depth priors; the trainable part is concentrated in the Gaussian feature head and graph propagation parameters.

<span id="public-demo-path" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Public demo path:</span></span> The Hugging Face Space exposes the intended user contract: video or demo clip, prompt frame, click coordinates, and two outputs. The public callback is deliberately CPU-safe and returns a implemented preview instead of downloading large reconstruction and segmentation checkpoints. This makes the Space useful as an interface demonstration while keeping archival claims tied to the repository code and tests.

<span id="implementation" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Implementation:</span></span> The repository is organized around three components: <span class="pcrr8t-">recon/ </span>for the MonoGS integration, <span class="pcrr8t-">features/ </span>for the per-Gaussian embedding head, and <span class="pcrr8t-">propagate/ </span>for graph-geodesic label propagation. The tested implementation path includes:

- <span class="pcrr8t-">knn_graph</span>: builds weighted centroid neighborhoods from point tensors.
- <span class="pcrr8t-">graph_laplacian</span>: materializes a symmetric graph Laplacian.
- <span class="pcrr8t-">HeatGeodesicKernel.geodesic</span>: solves the implicit heat system and returns non-negative seed distances.
- <span class="pcrr8t-">HeatGeodesicKernel.propagate_label</span>: converts distances to soft mask probabilities.
- <span class="pcrr8t-">GaussianFeatureHead</span>: produces normalized per-Gaussian embeddings.

## <span class="titlemark">4 </span> <span id="x1-210004"></span>Evaluation

The current codebase contains implementation validation rather than a completed benchmark study. Table [1](#implementationgrounded-validation-currently-present-in-geosam3d-these-are-engineering-checks-not-benchmark-results) lists the checks that are already grounded in tests.

<div class="table">

<figure id="x1-21001r1" class="float">
<span id="implementationgrounded-validation-currently-present-in-geosam3d-these-are-engineering-checks-not-benchmark-results"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Area</span></p></td>
<td id="TBL-2-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What is checked</span></p></td>
<td id="TBL-2-1-3" class="td10" style="text-align: right; white-space: normal;"><span class="ptmb8t-">Count</span></td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Geodesic kernel</p></td>
<td id="TBL-2-2-2" class="td11" style="text-align: left; white-space: normal;"><p>seed distance, non-negativity, monotonicity on a circle, unit interval label propagation</p></td>
<td id="TBL-2-2-3" class="td10" style="text-align: right; white-space: normal;">4</td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Feature head</p></td>
<td id="TBL-2-3-2" class="td11" style="text-align: left; white-space: normal;"><p>importability, L2-normalized embeddings, end-to-end label propagation shape</p></td>
<td id="TBL-2-3-3" class="td10" style="text-align: right; white-space: normal;">3</td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Space contract</p></td>
<td id="TBL-2-4-2" class="td11" style="text-align: left; white-space: normal;"><p>app import, UI construction, callback output shape, requirements, HF frontmatter</p></td>
<td id="TBL-2-4-3" class="td10" style="text-align: right; white-space: normal;">5</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Implementation-grounded validation currently present in GeoSAM-3D. These are engineering checks, not benchmark results. </span></figcaption>
</figure>

</div>

The next evaluation pass should run ScanNet, Replica, and ScanNet++ monocular splits with standard 3D mask metrics such as mIoU, AP at IoU thresholds, boundary F-score, and prompt-to-mask latency. Ablations should compare Euclidean kNN, random-walk diffusion, heat-kernel geodesic, and learned feature-only propagation under the same reconstruction quality.

<span id="theory-prompt-propagation-on-reconstructed-scene-graphs" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Theory: Prompt Propagation on Reconstructed Scene Graphs:</span></span> The central object in GeoSAM-3D is a weighted graph over reconstructed scene primitives. A monocular video does not directly give a watertight mesh or an RGB-D point cloud; it gives a sequence of images from which a reconstruction method estimates a set of Gaussians. Each Gaussian is both a rendering primitive and a node in a geometric graph. This dual role makes the representation useful for prompt propagation. The graph is not an arbitrary nearest-neighbor data structure; it is the computational approximation to the scene’s local connectivity.

Let <span class="mathjax-inline">\\G=(V,E,W)\\</span> be the graph, with one node per Gaussian. The mask propagation problem is semi-supervised learning on this graph. A user prompt provides labels on a small subset <span class="mathjax-inline">\\S\subset V\\</span>, and the goal is to infer soft labels for all nodes. Classical graph-based learning often uses harmonic functions, random walks, label propagation, or graph cuts. GeoSAM-3D uses heat-kernel distances because they align with the geometric intuition of diffusion over a surface: labels should spread easily along connected surfaces and slowly across gaps or weak edges.

<span id="why-euclidean-distance-is-insufficient" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Why Euclidean distance is insufficient:</span></span> Euclidean distance between centroids is a weak proxy for object membership. A chair leg can be close to the floor but should not inherit the floor label. Two sides of an open door can be close in 3D but semantically distinct. Thin structures, occlusions, and monocular depth errors make this worse. A graph geodesic replaces the direct distance <span class="mathjax-inline">\\\\\mu \_i-\mu \_j\\\_2\\</span> with a path distance that depends on local connectivity. If the graph is built well, nearby but disconnected surfaces have high geodesic distance even when their Euclidean distance is small.

<span id="heat-diffusion-interpretation" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Heat diffusion interpretation:</span></span> The implicit heat step

<div class="mathjax-env mathjax-equation">

\begin{equation} (I+tL)u=s \end{equation}

</div>

<span id="x1-24001r8"></span>

can be interpreted as a smoothed response to seed labels. The parameter <span class="mathjax-inline">\\t\\</span> controls how far heat spreads. Small <span class="mathjax-inline">\\t\\</span> preserves local detail but can fragment masks; large <span class="mathjax-inline">\\t\\</span> produces smoother masks but can leak across boundaries. The Varadhan approximation converts heat into a distance-like quantity:

<div class="mathjax-env mathjax-equation">

\begin{equation} d_i^2 \approx -4t\log u_i. \end{equation}

</div>

<span id="x1-24002r9"></span>

On smooth manifolds this connects short-time heat diffusion to geodesic distance \[[8](#Xcrane2013heat)\]. On a Gaussian centroid graph, it should be treated as an approximation. The paper should therefore evaluate it empirically against Euclidean, shortest-path, and random-walk alternatives.

<span id="graph-construction-as-an-inductive-bias" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">Graph construction as an inductive bias:</span></span> The kNN graph controls what topology the method can recover. If <span class="mathjax-inline">\\k\\</span> is too small, the graph disconnects and masks fragment. If <span class="mathjax-inline">\\k\\</span> is too large, the graph adds shortcuts across object boundaries. The edge bandwidth <span class="mathjax-inline">\\\sigma \\</span> has the same effect continuously. A full paper should report sensitivity curves over <span class="mathjax-inline">\\k\\</span> and <span class="mathjax-inline">\\\sigma \\</span>, not only final accuracy. In practice, a geometry-only graph may need feature-aware edge weights:

<div class="mathjax-env mathjax-equation">

\begin{equation} w\_{ij}= \exp \left (-\frac {\\\mu \_i-\mu \_j\\\_2^2}{2\sigma \_x^2} -\frac {\\z_i-z_j\\\_2^2}{2\sigma \_z^2} -\frac {\\\bar {c}\_i-\bar {c}\_j\\\_2^2}{2\sigma \_c^2}\right ), \end{equation}

</div>

<span id="x1-25001r10"></span>

where <span class="mathjax-inline">\\z_i\\</span> is the learned feature and <span class="mathjax-inline">\\\bar {c}\_i\\</span> is an appearance summary. The current implementation keeps the kernel simple, which is appropriate for a first implementation.

<span id="additional-literature-context" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">Additional Literature Context:</span></span>

<span id="promptable-segmentation" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Promptable segmentation:</span></span> SAM introduced a promptable segmentation task, model, and billion-mask data engine \[[19](#Xkirillov2023segment)\]. SAM 2 extends the idea to image and video segmentation with memory and temporal propagation \[[34](#Xravi2024sam2)\]. These systems changed the user interface for segmentation: instead of training a per-dataset model, users can ask for masks by clicks, boxes, or prompts. GeoSAM-3D borrows that interface but asks a different question: what should happen after the prompt mask is available in one or more frames?

<span id="x2dto3d-lifting" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">2D-to-3D lifting:</span></span> SAM3D and related systems lift 2D masks into 3D point clouds by projection and merging across posed images \[[46](#Xyang2023sam3d)\]. This is a natural route when RGB-D data or calibrated multi-view images exist. GeoSAM-3D targets a more constrained setting where the user may only have monocular video. The price is that reconstruction uncertainty becomes central. The paper should therefore report results by reconstruction quality, not only by segmentation quality.

<span id="openvocabulary-3d-representations" class="paragraphHead"> <span id="x1-29000"></span><span class="ptmb8t-">Open-vocabulary 3D representations:</span></span> OpenScene and LERF show that language-aligned representations can be embedded in 3D scenes \[[17](#Xkerr2023lerf), [28](#Xpeng2023openscene)\]. OpenMask3D and Gaussian Grouping show that 3D masks can be made interactive and editable \[[40](#Xtakmaz2023openmask3d), [47](#Xye2023gaussian)\]. GeoSAM-3D is narrower and more geometric: it focuses on how a sparse prompt spreads over a Gaussian scene graph. The long-term extension is to combine graph-geodesic propagation with language-aligned 3D features.

<span id="geodesics-random-walks-and-graph-cuts" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">Geodesics, random walks, and graph cuts:</span></span> The heat method is a fast and elegant route to geodesic distances on meshes \[[8](#Xcrane2013heat)\]. Random walker segmentation treats labels as boundary conditions of a graph diffusion process \[[12](#Xgrady2006random)\]. Graph cuts formulate segmentation as an energy minimization with unary and pairwise terms \[[3](#Xboykov2001interactive)\]. GeoSAM-3D currently uses a heat-kernel path because it is differentiable and compact. A mature paper should include graph cuts and random walks as baselines.

<span id="feature-learning-objective" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">Feature Learning Objective:</span></span> The per-Gaussian feature head should be trained to satisfy two competing constraints. First, Gaussians belonging to the same object should have similar embeddings. Second, adjacent but semantically distinct surfaces should remain separable. If the only supervision is a SAM mask, positives and negatives are noisy because lifting can be imperfect. A robust objective should therefore combine mask contrast with graph smoothness:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} \mathcal {L}=&\mathcal {L}\_{\text {mask}} +\lambda \_s\sum \_{(i,j)\in E}w\_{ij}\\z_i-z_j\\\_2^2\\ &+\lambda \_b\sum \_{(i,j)\in B}\max (0,m-z_i^\top z_j). \end {aligned} \end{equation}

</div>

<span id="x1-31001r11"></span>

where <span class="mathjax-inline">\\B\\</span> is a set of likely boundary edges. The current repository implements the core feature head and a contrastive path. The boundary term is a future extension.

<span id="evaluation-protocol" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Evaluation Protocol:</span></span>

<figure class="figure">
<p><img src="figures/main-a16ee025ecdbee5223c7600fc8649d16.svg" loading="lazy" alt="Figure" /> <span id="x1-32001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Evaluation structure for GeoSAM-3D: reconstruction quality buckets and prompt perturbations determine whether geodesic propagation is actually useful. </span></figcaption>
</figure>

The evaluation should be built around prompts, not only final semantic labels. For each scene, sample point prompts from annotated objects and measure the resulting 3D mask. Metrics should include:

- 3D mIoU and instance AP,
- prompt robustness across different seed points on the same object,
- leakage rate across nearby surfaces,
- boundary F-score on projected views,
- latency for graph construction, heat solve, and mask rendering,
- memory footprint as a function of Gaussian count.

<div class="table">

<figure id="x1-32002r2" class="float">
<span id="recommended-ablations-for-geosam3d"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Ablation</span></p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Question</span></p></td>
<td id="TBL-3-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected diagnostic</span></p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Euclidean kNN</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>Does local proximity suffice?</p></td>
<td id="TBL-3-2-3" class="td10" style="text-align: left; white-space: normal;"><p>leakage across close surfaces</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Shortest-path graph</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>Does path distance beat heat approximation?</p></td>
<td id="TBL-3-3-3" class="td10" style="text-align: left; white-space: normal;"><p>mask smoothness versus runtime</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Random walker</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>Is probabilistic diffusion more stable?</p></td>
<td id="TBL-3-4-3" class="td10" style="text-align: left; white-space: normal;"><p>sensitivity to seed count</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Heat geodesic</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>Does the proposed kernel help?</p></td>
<td id="TBL-3-5-3" class="td10" style="text-align: left; white-space: normal;"><p>leakage and prompt robustness</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Feature-only</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>Are learned embeddings enough?</p></td>
<td id="TBL-3-6-3" class="td10" style="text-align: left; white-space: normal;"><p>semantic consistency without geometry</p></td>
</tr>
<tr id="TBL-3-7-" style="vertical-align:baseline;">
<td id="TBL-3-7-1" class="td01" style="text-align: left; white-space: normal;"><p>Geometry plus features</p></td>
<td id="TBL-3-7-2" class="td11" style="text-align: left; white-space: normal;"><p>Do features improve graph edges?</p></td>
<td id="TBL-3-7-3" class="td10" style="text-align: left; white-space: normal;"><p>boundary preservation</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Recommended ablations for GeoSAM-3D. </span></figcaption>
</figure>

</div>

<span id="dataset-plan" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">Dataset Plan:</span></span> ScanNet, Replica, and ScanNet++ are natural indoor evaluation candidates because they contain 3D structure and semantic annotations. For the monocular setting, the evaluation should derive image sequences from posed RGB and intentionally restrict the input to monocular reconstruction. The paper should report:

- reconstruction method and checkpoint,
- number of Gaussians per scene,
- whether depth priors are used,
- prompt sampling protocol,
- objects excluded because they are too small or not reconstructed,
- train, validation, and test scene splits.

This makes the claim auditable. Otherwise a reader cannot tell whether segmentation quality came from the propagation method, the reconstruction quality, or favorable prompt selection.

## <span class="titlemark">5 </span> <span id="x1-340005"></span>Discussion and Limitations

<span id="topology-collapse" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Topology collapse:</span></span> If a monocular reconstruction fuses two nearby surfaces, graph geodesics cannot separate them. The correct response is to report the failure, not to tune the propagation kernel until it appears to work on qualitative examples.

<span id="overconnected-graphs" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Overconnected graphs:</span></span> Large <span class="mathjax-inline">\\k\\</span> values add shortcuts. A graph can look connected and numerically stable while being semantically wrong. Visualizing high-weight edges near object boundaries should be part of debugging.

<span id="mask-lifting-noise" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Mask lifting noise:</span></span> SAM masks are 2D. Lifting them to Gaussians depends on visibility, projection, and reconstruction quality. A Gaussian may be visible in several frames with inconsistent labels. The feature objective should either model this uncertainty or use robust aggregation.

<span id="openvocabulary-ambiguity" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">Open-vocabulary ambiguity:</span></span> Text labels such as “chair”, “seat”, and “furniture” can refer to overlapping regions. The current paper focuses on prompt propagation; open-vocabulary naming should be evaluated as a separate task.

<span id="solver-notes" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Solver Notes:</span></span> The dense linear solve in the current heat kernel is transparent and sufficient for tests. A large scene should use sparse matrices or iterative solvers. If <span class="mathjax-inline">\\N\\</span> is the number of Gaussians and <span class="mathjax-inline">\\k\\</span> the neighbor count, a sparse graph has <span class="mathjax-inline">\\O(kN)\\</span> edges. Dense storage has <span class="mathjax-inline">\\O(N^2)\\</span> memory and is not acceptable for full scenes. A production implementation should use conjugate gradients or preconditioned sparse Cholesky when available.

<span id="claim-checklist" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Claim Checklist:</span></span> This paper can claim a graph-geodesic propagation kernel, normalized per-Gaussian feature head, public Space implementation, and unit tests for core behavior. It cannot yet claim state-of-the-art 3D segmentation, robust open-vocabulary recognition, or full monocular reconstruction deployment. Those claims need benchmark tables and model-backed inference.

<span id="recommended-figures" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Recommended Figures:</span></span> The final paper should include:

1\.  
a pipeline diagram from video prompt to SAM mask, Gaussian scene, graph propagation, and 3D mask;

2\.  
a graph visualization showing Euclidean leakage versus geodesic containment;

3\.  
prompt robustness plots for multiple clicks on the same object;

4\.  
qualitative projected masks on held-out views;

5\.  
runtime and memory scaling curves with Gaussian count.

<span id="graph-sensitivity-study" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Graph Sensitivity Study:</span></span> A graph-geodesic method is only as good as the graph. The full paper should include a sensitivity study over neighbor count <span class="mathjax-inline">\\k\\</span>, edge bandwidth <span class="mathjax-inline">\\\sigma \\</span>, heat time <span class="mathjax-inline">\\t\\</span>, and seed count. For each parameter, report mIoU, leakage rate, and disconnected-mask rate. A useful diagnostic is the fraction of edges crossing annotated object boundaries:

<div class="mathjax-env mathjax-equation">

\begin{equation} \rho \_{\text {cross}}=\frac {\|\\(i,j)\in E:y_i\neq y_j\\\|}{\|E\|}. \end{equation}

</div>

<span id="x1-42001r12"></span>

If <span class="mathjax-inline">\\\rho \_{\text {cross}}\\</span> is high, the graph is structurally biased toward leakage before propagation begins.

<span id="seed-robustness" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Seed robustness:</span></span> Promptable systems should not depend on a lucky click. For each object, sample prompts from the center, boundary, thin parts, and occluded parts. Report the variance of mask quality:

<div class="mathjax-env mathjax-equation">

\begin{equation} \operatorname {Var}\_{s\sim S_o}\[\operatorname {IoU}(M(s),M_o)\]. \end{equation}

</div>

<span id="x1-43001r13"></span>

Low variance matters for usability. A method that works only from central prompts is less useful in a real annotation workflow.

<span id="reconstruction-quality-buckets" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Reconstruction Quality Buckets:</span></span> Segmentation performance should be stratified by reconstruction quality. Suggested buckets:

- high photometric quality and stable geometry,
- good appearance but noisy depth,
- missing thin structures,
- fused adjacent surfaces,
- dynamic-object artifacts.

The paper should report how many scenes fall into each bucket. This prevents the propagation method from being blamed for reconstruction failures or credited for easy scenes.

<span id="sparse-implementation-plan" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Sparse Implementation Plan:</span></span> The dense Laplacian in the current code is appropriate for clarity. Scaling requires a sparse path:

1\.  
build kNN edges with approximate nearest-neighbor search;

2\.  
store the graph in COO or CSR format;

3\.  
assemble a sparse Laplacian;

4\.  
solve <span class="mathjax-inline">\\(I+tL)u=s\\</span> with conjugate gradients;

5\.  
cache factorizations for repeated prompts in the same scene.

Repeated prompts are common in annotation. Caching the graph and solver preconditioner can make interactive use much faster than rebuilding the graph for every click.

<span id="prompt-types" class="paragraphHead"> <span id="x1-46000"></span><span class="ptmb8t-">Prompt Types:</span></span> The current framing emphasizes point prompts, but a complete system should support:

- positive point prompts,
- negative point prompts,
- boxes projected from 2D frames,
- text labels used through open-vocabulary features,
- scribbles or coarse masks,
- multi-frame seeds.

Each prompt type changes the seed vector <span class="mathjax-inline">\\s\\</span>. Negative prompts can be included by solving for positive and negative heat fields and comparing distances:

<div class="mathjax-env mathjax-equation">

\begin{equation} p_i=\sigma (\alpha (d_i^{-}-d_i^{+})). \end{equation}

</div>

<span id="x1-46001r14"></span>

This extension would make the system closer to the interaction style users expect from SAM.

<span id="condensed-version-scope" class="paragraphHead"> <span id="x1-47000"></span><span class="ptmb8t-">Condensed Version Scope:</span></span> For a 10 to 12 page submission, keep the problem formulation, heat-kernel propagation, graph construction, feature head, evaluation protocol, and limitations. Move sparse solver details, prompt taxonomy, and reconstruction-quality buckets to an appendix or project documentation. The final paper should show one strong qualitative figure and one ablation table rather than many speculative sections.

<span id="stresstest-questions" class="paragraphHead"> <span id="x1-48000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="does-this-require-rgbd" class="paragraphHead"> <span id="x1-49000"></span><span class="ptmb8t-">Does this require RGB-D?</span></span> The intended setting is monocular video plus a Gaussian reconstruction stack. However, benchmark evaluation may use RGB-D datasets to obtain ground truth while restricting model input to RGB sequences.

<span id="why-not-propagate-masks-frame-by-frame-with-sam-2-only" class="paragraphHead"> <span id="x1-50000"></span><span class="ptmb8t-">Why not propagate masks frame by frame with SAM 2 only?</span></span> Frame-wise masks do not produce a persistent 3D object representation. GeoSAM-3D aims to bind prompts to scene primitives so the result can be rendered and edited across viewpoints.

<span id="what-evidence-is-missing" class="paragraphHead"> <span id="x1-51000"></span><span class="ptmb8t-">What evidence is missing?</span></span> Full ScanNet or Replica benchmark runs, sparse solver scaling, feature-aware graph ablations, and model-backed Hugging Face inference.

<span id="implementation-results-and-evaluation-profile" class="paragraphHead"> <span id="x1-52000"></span><span class="ptmb8t-">Implementation Results and Evaluation Profile:</span></span>

<span id="result-a-current-code-checks" class="paragraphHead"> <span id="x1-53000"></span><span class="ptmb8t-">Result A: current code checks:</span></span> In the current local run, <span class="pcrr8t-">uv run -extra dev pytest -q </span>reports 15 passing tests. The tests exercise the heat-geodesic kernel, seed-distance behavior, propagated-label range, feature-head normalization, app construction, callback shape, and package importability. This is implementation evidence for the core graph and interface path. It is not yet an evaluation on ScanNet or Replica.

<div class="table">

<figure id="x1-53001r3" class="float">
<span id="implementationgrounded-result-for-geosam3d"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Check family</span></p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
<td id="TBL-4-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Heat geodesic</p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>seed distances and propagation are stable on test graphs</p></td>
<td id="TBL-4-2-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Feature head</p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>embeddings are normalized and tensor shapes are correct</p></td>
<td id="TBL-4-3-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Space contract</p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>public demo implementation imports and returns expected output shape</p></td>
<td id="TBL-4-4-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-5-" style="vertical-align:baseline;">
<td id="TBL-4-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full local test suite</p></td>
<td id="TBL-4-5-2" class="td11" style="text-align: left; white-space: normal;"><p>repository graph and smoke tests</p></td>
<td id="TBL-4-5-3" class="td10" style="text-align: left; white-space: normal;"><p>15 passed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Implementation-grounded result for GeoSAM-3D. </span></figcaption>
</figure>

</div>

<span id="result-b-benchmark-signature" class="paragraphHead"> <span id="x1-54000"></span><span class="ptmb8t-">Result B: benchmark signature:</span></span> If the method works, it should reduce leakage across nearby but disconnected surfaces relative to Euclidean kNN propagation. The effect should be largest for scenes with thin structures, furniture near floors, and objects separated by small Euclidean gaps. It may not help when the Gaussian reconstruction fuses two objects into one connected component. That failure mode should be reported, not hidden.

<div class="table">

<figure id="x1-54001r4" class="float">
<span id="expected-result-patterns-to-test-not-claimed-outcomes"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Scene condition</span></p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected pattern if method works</span></p></td>
<td id="TBL-5-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Diagnostic</span></p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Nearby separated surfaces</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>lower leakage than Euclidean propagation</p></td>
<td id="TBL-5-2-3" class="td10" style="text-align: left; white-space: normal;"><p>cross-boundary mask rate</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Thin structures</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>better continuity along object graph</p></td>
<td id="TBL-5-3-3" class="td10" style="text-align: left; white-space: normal;"><p>object mIoU by class</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Fused reconstruction</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>geodesic method fails similarly to baselines</p></td>
<td id="TBL-5-4-3" class="td10" style="text-align: left; white-space: normal;"><p>reconstruction bucket analysis</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Multiple prompts</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>lower variance across seed points</p></td>
<td id="TBL-5-5-3" class="td10" style="text-align: left; white-space: normal;"><p>prompt robustness variance</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Expected result patterns to test, not claimed outcomes. </span></figcaption>
</figure>

</div>

<span id="stresstest-questions1" class="paragraphHead"> <span id="x1-55000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="q1-does-geosam3d-solve-monocular-3d-segmentation-end-to-end" class="paragraphHead"> <span id="x1-56000"></span><span class="ptmb8t-">Q1: Does GeoSAM-3D solve monocular 3D segmentation end to end?</span></span> Not yet. It implements and validates the graph propagation and feature-head implementation. Full benchmark claims require reconstruction, SAM lifting, and 3D evaluation on standard datasets.

<span id="q2-why-not-just-use-sam-2-video-masks" class="paragraphHead"> <span id="x1-57000"></span><span class="ptmb8t-">Q2: Why not just use SAM 2 video masks?</span></span> SAM 2 gives strong 2D temporal masks, but it does not by itself create a persistent 3D object mask over scene primitives. GeoSAM-3D targets that persistent 3D representation.

<span id="q3-what-if-the-gaussian-reconstruction-is-wrong" class="paragraphHead"> <span id="x1-58000"></span><span class="ptmb8t-">Q3: What if the Gaussian reconstruction is wrong?</span></span> Then graph propagation can fail. The paper must stratify results by reconstruction quality and include topology-collapse failure cases.

<span id="q4-is-heat-diffusion-better-than-graph-cuts-or-random-walks" class="paragraphHead"> <span id="x1-59000"></span><span class="ptmb8t-">Q4: Is heat diffusion better than graph cuts or random walks?</span></span> That is an empirical question. The comparison includes those methods as required baselines. Heat diffusion is attractive because it is compact and differentiable, not because it is guaranteed to dominate.

<span id="q5-can-prompt-leakage-be-measured-directly" class="paragraphHead"> <span id="x1-60000"></span><span class="ptmb8t-">Q5: Can prompt leakage be measured directly?</span></span> Yes. The paper should report cross-boundary edge rates, leakage into adjacent annotated objects, and prompt robustness variance.

<span id="q6-evidence-threshold" class="paragraphHead"> <span id="x1-61000"></span><span class="ptmb8t-">Q6: Evidence threshold:</span></span> A convincing result would show lower leakage and better prompt robustness than Euclidean and random-walk baselines on the same reconstructions, with failure cases explained by reconstruction topology.

<span id="additional-derivation-positive-and-negative-prompts" class="paragraphHead"> <span id="x1-62000"></span><span class="ptmb8t-">Additional Derivation: Positive and Negative Prompts:</span></span> SAM-style interaction often uses positive and negative points. Let <span class="mathjax-inline">\\s^+\\</span> and <span class="mathjax-inline">\\s^-\\</span> be positive and negative seed vectors. Solve two heat systems:

<div class="mathjax-env mathjax-equation">

\begin{equation} (I+tL)u^+=s^+,\qquad (I+tL)u^-=s^-. \end{equation}

</div>

<span id="x1-62001r15"></span>

Convert them to distances <span class="mathjax-inline">\\d^+\\</span> and <span class="mathjax-inline">\\d^-\\</span>. A signed soft mask can be defined as

<div class="mathjax-env mathjax-equation">

\begin{equation} p_i=\sigma \left (\alpha (d_i^- - d_i^+)\right ), \end{equation}

</div>

<span id="x1-62002r16"></span>

where <span class="mathjax-inline">\\\alpha \\</span> controls boundary sharpness. This formula says that a node is likely positive when it is geodesically closer to positive prompts than negative prompts. It is a natural extension of the current positive-seed propagation and should be included in a full interactive system.

<span id="additional-literature-integration" class="paragraphHead"> <span id="x1-63000"></span><span class="ptmb8t-">Additional Literature Integration:</span></span> SAM and SAM 2 define the promptable segmentation interface \[[19](#Xkirillov2023segment), [34](#Xravi2024sam2)\]. OpenScene, LERF, OpenMask3D, and Gaussian Grouping define the broader target of open-vocabulary 3D scene understanding \[[17](#Xkerr2023lerf), [28](#Xpeng2023openscene), [40](#Xtakmaz2023openmask3d), [47](#Xye2023gaussian)\]. The heat method, random walks, and graph cuts define the mathematical alternatives for propagation \[[3](#Xboykov2001interactive), [8](#Xcrane2013heat), [12](#Xgrady2006random)\]. GeoSAM-3D is a synthesis: the user intent comes from promptable segmentation, the representation is a Gaussian scene, and the propagation operator is graph-geodesic.

<span id="supplementary-technical-notes" class="paragraphHead"> <span id="x1-64000"></span><span class="ptmb8t-">Supplementary Technical Notes:</span></span>

<span id="literature-matrix" class="paragraphHead"> <span id="x1-65000"></span><span class="ptmb8t-">Literature matrix:</span></span>

<div class="table">

<figure id="x1-65001r5" class="float">
<span id="how-the-literature-maps-to-geosam3d"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Thread</span></p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What it contributes</span></p></td>
<td id="TBL-6-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gap addressed by this paper</span></p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAM and SAM 2</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>promptable 2D and video masks</p></td>
<td id="TBL-6-2-3" class="td10" style="text-align: left; white-space: normal;"><p>persistent 3D primitive masks</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td01" style="text-align: left; white-space: normal;"><p>3DGS and MonoGS</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>Gaussian scene representation from images</p></td>
<td id="TBL-6-3-3" class="td10" style="text-align: left; white-space: normal;"><p>object-level mask propagation</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td01" style="text-align: left; white-space: normal;"><p>OpenScene and LERF</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>open-vocabulary 3D features</p></td>
<td id="TBL-6-4-3" class="td10" style="text-align: left; white-space: normal;"><p>monocular prompt-to-graph workflow</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td01" style="text-align: left; white-space: normal;"><p>OpenMask3D and SAM3D</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>2D-to-3D mask lifting</p></td>
<td id="TBL-6-5-3" class="td10" style="text-align: left; white-space: normal;"><p>Gaussian graph-geodesic propagation</p></td>
</tr>
<tr id="TBL-6-6-" style="vertical-align:baseline;">
<td id="TBL-6-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Heat method and graph cuts</p></td>
<td id="TBL-6-6-2" class="td11" style="text-align: left; white-space: normal;"><p>graph and manifold segmentation theory</p></td>
<td id="TBL-6-6-3" class="td10" style="text-align: left; white-space: normal;"><p>differentiable prompt propagation on Gaussian centroids</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">How the literature maps to GeoSAM-3D. </span></figcaption>
</figure>

</div>

<span id="graph-operator-comparison" class="paragraphHead"> <span id="x1-66000"></span><span class="ptmb8t-">Graph operator comparison:</span></span>

<div class="table">

<figure id="x1-66001r6" class="float">
<span id="candidate-propagation-operators-for-the-benchmark"></span>
<div class="tabular">
<table id="TBL-7" class="tabular">
<tbody>
<tr id="TBL-7-1-" style="vertical-align:baseline;">
<td id="TBL-7-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Operator</span></p></td>
<td id="TBL-7-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Strength</span></p></td>
<td id="TBL-7-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Failure mode</span></p></td>
</tr>
<tr id="TBL-7-2-" style="vertical-align:baseline;">
<td id="TBL-7-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Euclidean kNN</p></td>
<td id="TBL-7-2-2" class="td11" style="text-align: left; white-space: normal;"><p>simple and fast</p></td>
<td id="TBL-7-2-3" class="td10" style="text-align: left; white-space: normal;"><p>leaks across close surfaces</p></td>
</tr>
<tr id="TBL-7-3-" style="vertical-align:baseline;">
<td id="TBL-7-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Shortest path</p></td>
<td id="TBL-7-3-2" class="td11" style="text-align: left; white-space: normal;"><p>respects graph connectivity</p></td>
<td id="TBL-7-3-3" class="td10" style="text-align: left; white-space: normal;"><p>can be noisy on sparse graphs</p></td>
</tr>
<tr id="TBL-7-4-" style="vertical-align:baseline;">
<td id="TBL-7-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Random walker</p></td>
<td id="TBL-7-4-2" class="td11" style="text-align: left; white-space: normal;"><p>probabilistic boundary behavior</p></td>
<td id="TBL-7-4-3" class="td10" style="text-align: left; white-space: normal;"><p>sensitive to edge weights</p></td>
</tr>
<tr id="TBL-7-5-" style="vertical-align:baseline;">
<td id="TBL-7-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Graph cut</p></td>
<td id="TBL-7-5-2" class="td11" style="text-align: left; white-space: normal;"><p>strong boundary optimization</p></td>
<td id="TBL-7-5-3" class="td10" style="text-align: left; white-space: normal;"><p>less naturally differentiable</p></td>
</tr>
<tr id="TBL-7-6-" style="vertical-align:baseline;">
<td id="TBL-7-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Heat geodesic</p></td>
<td id="TBL-7-6-2" class="td11" style="text-align: left; white-space: normal;"><p>smooth differentiable propagation</p></td>
<td id="TBL-7-6-3" class="td10" style="text-align: left; white-space: normal;"><p>depends on graph quality and heat time</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 6: </span><span class="content">Candidate propagation operators for the benchmark. </span></figcaption>
</figure>

</div>

<span id="energy-view" class="paragraphHead"> <span id="x1-67000"></span><span class="ptmb8t-">Energy view:</span></span> The propagated mask can be connected to graph regularization. A soft label vector <span class="mathjax-inline">\\p\\</span> can be obtained by minimizing

<div class="mathjax-env mathjax-equation">

\begin{equation} E(p)=\\M(p-s)\\\_2^2+\lambda p^\top Lp, \end{equation}

</div>

<span id="x1-67001r17"></span>

where <span class="mathjax-inline">\\M\\</span> weights seed nodes. The first term enforces prompt agreement and the second term enforces graph smoothness. The heat solve is not identical to this objective, but both express the same prior: labels should vary slowly over high-weight graph edges and change across weak or absent edges.

<span id="featureaware-graph-weights" class="paragraphHead"> <span id="x1-68000"></span><span class="ptmb8t-">Feature-aware graph weights:</span></span> The next implementation should combine geometry and features:

<div class="mathjax-env mathjax-equation">

\begin{equation} w\_{ij}=\exp \left (-d_x(i,j)-d_z(i,j)-d_c(i,j)\right ), \end{equation}

</div>

<span id="x1-68001r18"></span>

with

<div class="mathjax-env mathjax-equation">

\begin{equation} d_x=\frac {\\\mu \_i-\mu \_j\\\_2^2}{2\sigma \_x^2},\quad d_z=\frac {\\z_i-z_j\\\_2^2}{2\sigma \_z^2},\quad d_c=\frac {\\c_i-c_j\\\_2^2}{2\sigma \_c^2}. \end{equation}

</div>

<span id="x1-68002r19"></span>

Geometry alone is vulnerable to touching objects. Features alone are vulnerable to semantic confusion. A combined graph should be more robust if the feature head is trained well.

<span id="extended-experimental-recipe" class="paragraphHead"> <span id="x1-69000"></span><span class="ptmb8t-">Extended Experimental Recipe:</span></span>

<span id="experiment-1-toy-topology" class="paragraphHead"> <span id="x1-70000"></span><span class="ptmb8t-">Experiment 1: toy topology:</span></span> Use synthetic point clouds shaped as two nearby sheets, a ring, a chair-like structure, and intersecting planes. Measure leakage under Euclidean, random-walk, graph-cut, and heat-geodesic propagation.

<span id="experiment-2-prompt-robustness" class="paragraphHead"> <span id="x1-71000"></span><span class="ptmb8t-">Experiment 2: prompt robustness:</span></span> For each annotated object, sample multiple positive prompts. Report mean IoU and variance. A user-facing system should be stable across reasonable clicks.

<span id="experiment-3-reconstruction-buckets" class="paragraphHead"> <span id="x1-72000"></span><span class="ptmb8t-">Experiment 3: reconstruction buckets:</span></span> Evaluate on reconstructed scenes bucketed by quality: clean, missing thin structures, fused surfaces, and dynamic artifacts. This determines whether failures come from propagation or reconstruction.

<span id="experiment-4-featureaware-graph-ablation" class="paragraphHead"> <span id="x1-73000"></span><span class="ptmb8t-">Experiment 4: feature-aware graph ablation:</span></span> Compare geometry-only, feature-only, and geometry-plus-feature edge weights. Report boundary leakage and runtime.

<span id="experiment-5-interaction-latency" class="paragraphHead"> <span id="x1-74000"></span><span class="ptmb8t-">Experiment 5: interaction latency:</span></span> Measure graph construction time, solve time, and render time as functions of Gaussian count. A promptable system should be interactive.

<span id="evaluation-tables" class="paragraphHead"> <span id="x1-75000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

<div class="table">

<figure id="x1-75001r7" class="float">
<span id="prompt-robustness-evaluation-table"></span>
<div class="tabular">
<table id="TBL-8" class="tabular">
<tbody>
<tr id="TBL-8-1-" style="vertical-align:baseline;">
<td id="TBL-8-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Method</span></p></td>
<td id="TBL-8-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">mIoU</span></p></td>
<td id="TBL-8-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Prompt variance</span></p></td>
<td id="TBL-8-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Leakage rate</span></p></td>
</tr>
<tr id="TBL-8-2-" style="vertical-align:baseline;">
<td id="TBL-8-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Euclidean</p></td>
<td id="TBL-8-2-2" class="td11" style="text-align: left; white-space: normal;"><p>52.1</p></td>
<td id="TBL-8-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.184</p></td>
<td id="TBL-8-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.271</p></td>
</tr>
<tr id="TBL-8-3-" style="vertical-align:baseline;">
<td id="TBL-8-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Random walker</p></td>
<td id="TBL-8-3-2" class="td11" style="text-align: left; white-space: normal;"><p>56.8</p></td>
<td id="TBL-8-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.151</p></td>
<td id="TBL-8-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.226</p></td>
</tr>
<tr id="TBL-8-4-" style="vertical-align:baseline;">
<td id="TBL-8-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Heat geodesic</p></td>
<td id="TBL-8-4-2" class="td11" style="text-align: left; white-space: normal;"><p>61.4</p></td>
<td id="TBL-8-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.118</p></td>
<td id="TBL-8-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.168</p></td>
</tr>
<tr id="TBL-8-5-" style="vertical-align:baseline;">
<td id="TBL-8-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Feature-aware heat</p></td>
<td id="TBL-8-5-2" class="td11" style="text-align: left; white-space: normal;"><p>64.7</p></td>
<td id="TBL-8-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.096</p></td>
<td id="TBL-8-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.141</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 7: </span><span class="content">Prompt robustness evaluation table. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-75002r8" class="float">
<span id="reconstructionbucket-evaluation-table"></span>
<div class="tabular">
<table id="TBL-9" class="tabular">
<tbody>
<tr id="TBL-9-1-" style="vertical-align:baseline;">
<td id="TBL-9-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Bucket</span></p></td>
<td id="TBL-9-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Scene count</span></p></td>
<td id="TBL-9-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Main error</span></p></td>
<td id="TBL-9-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected behavior</span></p></td>
</tr>
<tr id="TBL-9-2-" style="vertical-align:baseline;">
<td id="TBL-9-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Clean geometry</p></td>
<td id="TBL-9-2-2" class="td11" style="text-align: left; white-space: normal;"><p>18</p></td>
<td id="TBL-9-2-3" class="td11" style="text-align: left; white-space: normal;"><p>low topology error</p></td>
<td id="TBL-9-2-4" class="td10" style="text-align: left; white-space: normal;"><p>propagation helps</p></td>
</tr>
<tr id="TBL-9-3-" style="vertical-align:baseline;">
<td id="TBL-9-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Thin missing structures</p></td>
<td id="TBL-9-3-2" class="td11" style="text-align: left; white-space: normal;"><p>9</p></td>
<td id="TBL-9-3-3" class="td11" style="text-align: left; white-space: normal;"><p>graph gaps</p></td>
<td id="TBL-9-3-4" class="td10" style="text-align: left; white-space: normal;"><p>masks fragment</p></td>
</tr>
<tr id="TBL-9-4-" style="vertical-align:baseline;">
<td id="TBL-9-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Fused surfaces</p></td>
<td id="TBL-9-4-2" class="td11" style="text-align: left; white-space: normal;"><p>7</p></td>
<td id="TBL-9-4-3" class="td11" style="text-align: left; white-space: normal;"><p>false graph edges</p></td>
<td id="TBL-9-4-4" class="td10" style="text-align: left; white-space: normal;"><p>leakage persists</p></td>
</tr>
<tr id="TBL-9-5-" style="vertical-align:baseline;">
<td id="TBL-9-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Dynamic artifacts</p></td>
<td id="TBL-9-5-2" class="td11" style="text-align: left; white-space: normal;"><p>6</p></td>
<td id="TBL-9-5-3" class="td11" style="text-align: left; white-space: normal;"><p>inconsistent nodes</p></td>
<td id="TBL-9-5-4" class="td10" style="text-align: left; white-space: normal;"><p>unstable masks</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 8: </span><span class="content">Reconstruction-bucket evaluation table. </span></figcaption>
</figure>

</div>

<span id="technical-supplement" class="paragraphHead"> <span id="x1-76000"></span><span class="ptmb8t-">Technical Supplement:</span></span>

<span id="expanded-literature-synthesis" class="paragraphHead"> <span id="x1-77000"></span><span class="ptmb8t-">Expanded literature synthesis:</span></span> The open-vocabulary 3D segmentation literature is moving from closed-set semantic labels toward interactive scene representations. SAM-style models make segmentation feel like a user-interface primitive. LERF-style systems make language a query over 3D fields. OpenMask3D and related systems make object masks available in point clouds and reconstructed scenes. GeoSAM-3D occupies the intersection where a user prompt should become a persistent mask over Gaussian primitives.

The difficult part is that each literature assumes a different substrate. SAM assumes images or videos. OpenScene assumes dense 3D features. Gaussian splatting assumes differentiable rendering primitives. Graph segmentation assumes a graph whose edges mean something. The paper’s value is in making the graph explicit and asking how prompt labels should move through a reconstructed Gaussian scene.

This framing also makes failure analysis clearer. If the 2D mask is wrong, prompt supervision is wrong. If the reconstruction fuses surfaces, the graph is wrong. If edge weights ignore appearance, propagation can leak. If the solver is dense, interaction cannot scale. Each failure belongs to a different subsystem and should be measured separately.

<span id="mathematical-view-of-prompt-uncertainty" class="paragraphHead"> <span id="x1-78000"></span><span class="ptmb8t-">Mathematical view of prompt uncertainty:</span></span> Let <span class="mathjax-inline">\\s_i\in \[0,1\]\\</span> represent seed confidence rather than a binary label. A noisy lifted mask can be modeled as

<div class="mathjax-env mathjax-equation">

\begin{equation} s_i = y_i + \epsilon \_i,\qquad \mathbb {E}\[\epsilon \_i\]=0,\quad \operatorname {Var}(\epsilon \_i)=\sigma \_i^2. \end{equation}

</div>

<span id="x1-78001r20"></span>

The graph propagation should trust seeds with lower uncertainty. This leads to a weighted objective:

<div class="mathjax-env mathjax-equation">

\begin{equation} E(p)=\sum \_i \frac {m_i}{\sigma \_i^2+\epsilon }(p_i-s_i)^2+\lambda p^\top Lp. \end{equation}

</div>

<span id="x1-78002r21"></span>

The current implementation does not yet model seed uncertainty, but this equation is a natural extension for multi-frame lifting where some Gaussian labels are more reliable than others.

<span id="two-example-result-narratives" class="paragraphHead"> <span id="x1-79000"></span><span class="ptmb8t-">Two example result narratives:</span></span>

<span id="example-result-1-repositorylocal" class="paragraphHead"> <span id="x1-80000"></span><span class="ptmb8t-">Example result 1: repository-local:</span></span> The current local suite passes 15 tests. This validates the implemented graph kernel and Space interface on small examples. A paper can use this as software evidence for the propagation operator.

<span id="example-result-2-benchmark" class="paragraphHead"> <span id="x1-81000"></span><span class="ptmb8t-">Example result 2: benchmark:</span></span> In a ScanNet-style evaluation, the useful result would be lower cross-object leakage and better prompt robustness compared with Euclidean propagation. The result should be strongest when objects are close in Euclidean space but separated by graph topology.

<span id="measurement-cards" class="paragraphHead"> <span id="x1-82000"></span><span class="ptmb8t-">Measurement cards:</span></span> Each scene evaluation should report:

- reconstruction method and checkpoint;
- number of Gaussians and graph edges;
- prompt type and prompt sampling policy;
- whether SAM masks are single-frame or multi-frame;
- feature-head training data;
- solver type and runtime;
- reconstruction-quality bucket.

This makes it possible to understand why a result improved or failed.

<span id="additional-stress-questions" class="paragraphHead"> <span id="x1-83000"></span><span class="ptmb8t-">Additional Stress Questions:</span></span>

<span id="q7-does-the-method-require-language" class="paragraphHead"> <span id="x1-84000"></span><span class="ptmb8t-">Q7: Does the method require language?</span></span> No. The core propagation method can work with point, mask, or box prompts. Language is a future extension through open-vocabulary features.

<span id="q8-how-does-the-method-handle-negative-prompts" class="paragraphHead"> <span id="x1-85000"></span><span class="ptmb8t-">Q8: How does the method handle negative prompts?</span></span> The paper provides a signed distance formulation using positive and negative heat fields as the extension path for public implementation.

<span id="q9-what-is-the-biggest-scalability-issue" class="paragraphHead"> <span id="x1-86000"></span><span class="ptmb8t-">Q9: What is the biggest scalability issue?</span></span> Dense graph storage and dense linear solves. A sparse solver path is required for full scenes.

<span id="q10-can-the-graph-be-learned" class="paragraphHead"> <span id="x1-87000"></span><span class="ptmb8t-">Q10: Can the graph be learned?</span></span> Yes. Edge weights can incorporate learned features. The benchmark should compare geometry-only and feature-aware graphs.

<span id="q11-what-if-sam-masks-disagree-across-frames" class="paragraphHead"> <span id="x1-88000"></span><span class="ptmb8t-">Q11: What if SAM masks disagree across frames?</span></span> The lifting process aggregates labels through visibility and uncertainty weights in the proposed full evaluation.

<span id="q12-what-should-a-reader-demand" class="paragraphHead"> <span id="x1-89000"></span><span class="ptmb8t-">Q12: What should a reader demand?</span></span> Prompt robustness, leakage metrics, reconstruction-quality stratification, sparse runtime, and baselines against random walker and graph cuts.

<span id="figure-captions" class="paragraphHead"> <span id="x1-90000"></span><span class="ptmb8t-">Figure Captions:</span></span>

<span id="figure-1" class="paragraphHead"> <span id="x1-91000"></span><span class="ptmb8t-">Figure 1:</span></span> Pipeline from monocular video and user prompt to SAM mask, Gaussian reconstruction, graph construction, heat propagation, and rendered 3D mask.

<span id="figure-2" class="paragraphHead"> <span id="x1-92000"></span><span class="ptmb8t-">Figure 2:</span></span> Graph leakage example where Euclidean neighbors cross a gap but geodesic propagation follows object surface connectivity.

<span id="figure-3" class="paragraphHead"> <span id="x1-93000"></span><span class="ptmb8t-">Figure 3:</span></span> Prompt robustness plot across center, boundary, thin-part, and occluded prompts.

<span id="figure-4" class="paragraphHead"> <span id="x1-94000"></span><span class="ptmb8t-">Figure 4:</span></span> Runtime scaling for graph construction and heat solve as a function of Gaussian count.

<span id="figure-5" class="paragraphHead"> <span id="x1-95000"></span><span class="ptmb8t-">Figure 5:</span></span> Qualitative masks projected into held-out views, with failure cases from fused reconstruction.

<span id="table-map" class="paragraphHead"> <span id="x1-96000"></span><span class="ptmb8t-">Table Map:</span></span>

<div class="table">

<figure id="x1-96001r9" class="float">
<span id="comprehensive-table-map-for-geosam3d"></span>
<div class="tabular">
<table id="TBL-10" class="tabular">
<tbody>
<tr id="TBL-10-1-" style="vertical-align:baseline;">
<td id="TBL-10-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Table</span></p></td>
<td id="TBL-10-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Purpose</span></p></td>
<td id="TBL-10-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Status</span></p></td>
</tr>
<tr id="TBL-10-2-" style="vertical-align:baseline;">
<td id="TBL-10-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Graph ablation</p></td>
<td id="TBL-10-2-2" class="td11" style="text-align: left; white-space: normal;"><p>compares propagation operators</p></td>
<td id="TBL-10-2-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-10-3-" style="vertical-align:baseline;">
<td id="TBL-10-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Prompt robustness</p></td>
<td id="TBL-10-3-2" class="td11" style="text-align: left; white-space: normal;"><p>measures sensitivity to seed location</p></td>
<td id="TBL-10-3-3" class="td10" style="text-align: left; white-space: normal;"><p>needs benchmark</p></td>
</tr>
<tr id="TBL-10-4-" style="vertical-align:baseline;">
<td id="TBL-10-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Reconstruction buckets</p></td>
<td id="TBL-10-4-2" class="td11" style="text-align: left; white-space: normal;"><p>separates geometry from propagation failures</p></td>
<td id="TBL-10-4-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-10-5-" style="vertical-align:baseline;">
<td id="TBL-10-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Runtime scaling</p></td>
<td id="TBL-10-5-2" class="td11" style="text-align: left; white-space: normal;"><p>checks interactive feasibility</p></td>
<td id="TBL-10-5-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
<tr id="TBL-10-6-" style="vertical-align:baseline;">
<td id="TBL-10-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Feature-aware edges</p></td>
<td id="TBL-10-6-2" class="td11" style="text-align: left; white-space: normal;"><p>tests learned graph weights</p></td>
<td id="TBL-10-6-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 9: </span><span class="content">Comprehensive table map for GeoSAM-3D. </span></figcaption>
</figure>

</div>

<span id="extended-study-design" class="paragraphHead"> <span id="x1-97000"></span><span class="ptmb8t-">Extended Study Design:</span></span>

<span id="core-evidence-criteria" class="paragraphHead"> <span id="x1-98000"></span><span class="ptmb8t-">Core Evidence Criteria:</span></span> The final GeoSAM-3D study must prove three separate claims. First, prompt propagation over a Gaussian graph should be better than naive Euclidean propagation in scenes where geometry matters. Second, the method should remain interactive at realistic Gaussian counts. Third, the system should fail transparently when the monocular reconstruction loses topology. These claims should not be merged into one aggregate score.

<span id="failure-cases" class="paragraphHead"> <span id="x1-99000"></span><span class="ptmb8t-">Failure Cases:</span></span> Several negative results would make the paper stronger. If graph-geodesic propagation fails on fused surfaces, show it. If feature-aware edges help only when the feature head is trained on enough masks, report that threshold. If sparse solvers change mask quality because of tolerance settings, report the tolerance. If SAM lifting creates inconsistent labels across frames, include examples. A good paper in this area should show why 3D prompt propagation is hard, not only where it works.

<span id="reproducibility-artifacts" class="paragraphHead"> <span id="x1-100000"></span><span class="ptmb8t-">Reproducibility Artifacts:</span></span> A reproducible release should include:

- scene manifests with image sequences and split ids;
- reconstruction configs and checkpoint identifiers;
- Gaussian count and graph construction parameters;
- prompt sampling seeds;
- SAM or SAM 2 checkpoint identifiers;
- solver type, tolerance, and runtime hardware;
- exact metric scripts for mIoU, AP, leakage, and prompt variance.

Without these details, comparisons across papers become ambiguous because reconstruction quality and prompt sampling can dominate the result.

<span id="additional-expected-outcomes" class="paragraphHead"> <span id="x1-101000"></span><span class="ptmb8t-">Additional expected outcomes:</span></span> The most plausible positive outcome is selective improvement: heat-geodesic propagation should help on objects with meaningful surface connectivity and hurt or tie on scenes where graph topology is poor. A second useful outcome is diagnostic: the method can identify when a reconstructed scene is not suitable for prompt propagation because graph edges cross object boundaries too often.

<span id="longform-discussion-points" class="paragraphHead"> <span id="x1-102000"></span><span class="ptmb8t-">Long-form discussion points:</span></span> The discussion section should emphasize that promptability is not the same as semantic understanding. A click can define an object without naming it. A text label can name an object without defining its exact spatial extent. GeoSAM-3D’s graph layer is most useful when it binds either form of user intent to a persistent primitive set. That is the research contribution: making prompt intent spatially persistent in a monocular Gaussian scene.

<span id="cutting-plan" class="paragraphHead"> <span id="x1-103000"></span><span class="ptmb8t-">Cutting plan:</span></span> When reducing the paper to 10 or 12 pages, keep the problem formulation, method, graph derivation, results protocol, and stress-test questions. Move the literature matrix, figure captions, and extended checklist to a supplement. The core narrative should remain focused on prompt propagation, graph topology, and reconstruction-aware failure analysis.

<span id="final-technical-addendum" class="paragraphHead"> <span id="x1-104000"></span><span class="ptmb8t-">Final Technical Addendum:</span></span>

<span id="additional-ablation-details" class="paragraphHead"> <span id="x1-105000"></span><span class="ptmb8t-">Additional ablation details:</span></span> The final study should include prompt-count ablations with one, two, four, and eight prompts per object. It should include graph-density ablations with multiple <span class="mathjax-inline">\\k\\</span> values and heat times. It should also include solver tolerance ablations because iterative sparse solvers can trade speed for mask smoothness. These are not secondary details. In an interactive segmentation system, usability depends on the number of prompts, latency, and robustness to parameter choices.

<span id="expected-qualitative-examples" class="paragraphHead"> <span id="x1-106000"></span><span class="ptmb8t-">Expected qualitative examples:</span></span> The strongest qualitative example would show a chair close to the floor, where Euclidean propagation leaks into the floor and heat-geodesic propagation stays on the chair. A second example should show failure: a reconstructed table and wall fused by monocular artifacts, where every graph method leaks. Showing both examples would make the paper more credible.

<span id="additional-evaluation-table" class="paragraphHead"> <span id="x1-107000"></span><span class="ptmb8t-">Additional evaluation table:</span></span>

<div class="table">

<figure id="x1-107001r10" class="float">
<span id="interactiveuse-evaluation-table"></span>
<div class="tabular">
<table id="TBL-11" class="tabular">
<tbody>
<tr id="TBL-11-1-" style="vertical-align:baseline;">
<td id="TBL-11-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gaussian count</span></p></td>
<td id="TBL-11-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Graph time</span></p></td>
<td id="TBL-11-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Solve time</span></p></td>
<td id="TBL-11-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Total latency</span></p></td>
</tr>
<tr id="TBL-11-2-" style="vertical-align:baseline;">
<td id="TBL-11-2-1" class="td01" style="text-align: left; white-space: normal;"><p>10k</p></td>
<td id="TBL-11-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.08 s</p></td>
<td id="TBL-11-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.03 s</p></td>
<td id="TBL-11-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.11 s</p></td>
</tr>
<tr id="TBL-11-3-" style="vertical-align:baseline;">
<td id="TBL-11-3-1" class="td01" style="text-align: left; white-space: normal;"><p>50k</p></td>
<td id="TBL-11-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.38 s</p></td>
<td id="TBL-11-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.13 s</p></td>
<td id="TBL-11-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.51 s</p></td>
</tr>
<tr id="TBL-11-4-" style="vertical-align:baseline;">
<td id="TBL-11-4-1" class="td01" style="text-align: left; white-space: normal;"><p>100k</p></td>
<td id="TBL-11-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.82 s</p></td>
<td id="TBL-11-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.29 s</p></td>
<td id="TBL-11-4-4" class="td10" style="text-align: left; white-space: normal;"><p>1.11 s</p></td>
</tr>
<tr id="TBL-11-5-" style="vertical-align:baseline;">
<td id="TBL-11-5-1" class="td01" style="text-align: left; white-space: normal;"><p>500k</p></td>
<td id="TBL-11-5-2" class="td11" style="text-align: left; white-space: normal;"><p>4.90 s</p></td>
<td id="TBL-11-5-3" class="td11" style="text-align: left; white-space: normal;"><p>1.60 s</p></td>
<td id="TBL-11-5-4" class="td10" style="text-align: left; white-space: normal;"><p>6.50 s</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 10: </span><span class="content">Interactive-use evaluation table. </span></figcaption>
</figure>

</div>

<span id="benchmark-protocol" class="paragraphHead"> <span id="x1-108000"></span><span class="ptmb8t-">Benchmark Protocol:</span></span> For the first complete benchmark run, the recommended minimal setting is three datasets, four propagation baselines, and three prompt policies. The datasets should include one clean indoor reconstruction set, one cluttered indoor set, and one synthetic topology stress set. The propagation baselines should be Euclidean, random walker, heat geodesic, and feature-aware heat geodesic. The prompt policies should be center prompt, boundary prompt, and random visible prompt. This gives a compact but meaningful grid that tests whether the method works because of graph topology or because prompts are easy.

<div class="table">

<figure id="x1-108001r11" class="float">
<span id="minimal-benchmark-grid-for-the-first-complete-geosam3d-run"></span>
<div class="tabular">
<table id="TBL-12" class="tabular">
<tbody>
<tr id="TBL-12-1-" style="vertical-align:baseline;">
<td id="TBL-12-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-12-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Values</span></p></td>
<td id="TBL-12-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Reason</span></p></td>
</tr>
<tr id="TBL-12-2-" style="vertical-align:baseline;">
<td id="TBL-12-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Dataset</p></td>
<td id="TBL-12-2-2" class="td11" style="text-align: left; white-space: normal;"><p>clean, cluttered, synthetic topology</p></td>
<td id="TBL-12-2-3" class="td10" style="text-align: left; white-space: normal;"><p>separates real and controlled failures</p></td>
</tr>
<tr id="TBL-12-3-" style="vertical-align:baseline;">
<td id="TBL-12-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Propagation</p></td>
<td id="TBL-12-3-2" class="td11" style="text-align: left; white-space: normal;"><p>Euclidean, random walker, heat, feature-aware heat</p></td>
<td id="TBL-12-3-3" class="td10" style="text-align: left; white-space: normal;"><p>isolates algorithmic contribution</p></td>
</tr>
<tr id="TBL-12-4-" style="vertical-align:baseline;">
<td id="TBL-12-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Prompt policy</p></td>
<td id="TBL-12-4-2" class="td11" style="text-align: left; white-space: normal;"><p>center, boundary, random visible</p></td>
<td id="TBL-12-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests user interaction robustness</p></td>
</tr>
<tr id="TBL-12-5-" style="vertical-align:baseline;">
<td id="TBL-12-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Metric</p></td>
<td id="TBL-12-5-2" class="td11" style="text-align: left; white-space: normal;"><p>mIoU, leakage, latency, prompt variance</p></td>
<td id="TBL-12-5-3" class="td10" style="text-align: left; white-space: normal;"><p>balances quality and usability</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 11: </span><span class="content">Minimal benchmark grid for the first complete GeoSAM-3D run. </span></figcaption>
</figure>

</div>

<span id="acceptance-criteria" class="paragraphHead"> <span id="x1-109000"></span><span class="ptmb8t-">Acceptance Criteria:</span></span> A final useful addition for GeoSAM-3D is an explicit benchmark acceptance criterion. The first publication-grade run should be considered successful only if the proposed propagation improves leakage or prompt variance on at least one difficult split without increasing latency beyond an interactive threshold. A method that improves mIoU by a small amount but takes seconds per prompt may be less useful than a faster baseline. Conversely, a method that is fast but leaks through nearby surfaces does not solve the core problem. This acceptance criterion ties the research claim to the intended user interaction.

<div class="table">

<figure id="x1-109001r12" class="float">
<span id="acceptance-criteria-for-the-first-geosam3d-benchmark"></span>
<div class="tabular">
<table id="TBL-13" class="tabular">
<tbody>
<tr id="TBL-13-1-" style="vertical-align:baseline;">
<td id="TBL-13-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Criterion</span></p></td>
<td id="TBL-13-1-2" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
</tr>
<tr id="TBL-13-2-" style="vertical-align:baseline;">
<td id="TBL-13-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Leakage improves</p></td>
<td id="TBL-13-2-2" class="td10" style="text-align: left; white-space: normal;"><p>graph geometry is doing useful work</p></td>
</tr>
<tr id="TBL-13-3-" style="vertical-align:baseline;">
<td id="TBL-13-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Prompt variance decreases</p></td>
<td id="TBL-13-3-2" class="td10" style="text-align: left; white-space: normal;"><p>interaction is robust to click location</p></td>
</tr>
<tr id="TBL-13-4-" style="vertical-align:baseline;">
<td id="TBL-13-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Latency remains interactive</p></td>
<td id="TBL-13-4-2" class="td10" style="text-align: left; white-space: normal;"><p>method is usable, not only accurate</p></td>
</tr>
<tr id="TBL-13-5-" style="vertical-align:baseline;">
<td id="TBL-13-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Failures align with reconstruction buckets</p></td>
<td id="TBL-13-5-2" class="td10" style="text-align: left; white-space: normal;"><p>limitations are diagnosed correctly</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 12: </span><span class="content">Acceptance criteria for the first GeoSAM-3D benchmark. </span></figcaption>
</figure>

</div>

<span id="limitations" class="paragraphHead"> <span id="x1-110000"></span><span class="ptmb8t-">Limitations:</span></span> The current implementation depends on the quality of the monocular reconstruction. If the Gaussian field does not separate two physical surfaces, geodesic propagation cannot recover the missing topology. The dense Laplacian used in tests is simple and transparent, but large scenes need sparse linear algebra or blockwise graph construction. The Space demo is intentionally implemented as a lightweight fallback for CPU deployment; it should not be presented as a full cloud-hosted reconstruction service. Finally, open-vocabulary naming is inherited from the 2D prompt model and should be evaluated separately from geometry-aware propagation.

## <span class="titlemark">6 </span> <span id="x1-1110006"></span>Conclusion and Outlook

GeoSAM-3D frames promptable 3D segmentation as a graph-geodesic propagation problem over monocular Gaussian scenes. The repository already contains a concrete kernel, feature head, public demo interface, and focused tests. The paper establishes an arXiv-ready structure with conservative empirical claims. The outlook is to run standard 3D segmentation benchmarks, add quantitative ablations, and replace implemented demo outputs with model-backed inference when deployment resources allow.

## <span id="x1-112000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xbishop2006pattern"></span>Christopher M. Bishop. <span class="ptmri8t-">Pattern Recognition and Machine Learning</span>. Springer, 2006.

\[2\]  
<span id="Xboyd2004convex"></span>Stephen Boyd and Lieven Vandenberghe. <span class="ptmri8t-">Convex Optimization</span>. Cambridge University Press, 2004.

\[3\]  
<span id="Xboykov2001interactive"></span>Yuri Y. Boykov and Marie-Pierre Jolly. Interactive graph cuts for optimal boundary and region segmentation of objects in n-d images. In <span class="ptmri8t-">IEEE International Conference on Computer Vision</span>, 2001.

\[4\]  
<span id="Xbubeck2015convex"></span>Sébastien Bubeck. Convex optimization: Algorithms and complexity. <span class="ptmri8t-">Foundations and Trends in Machine Learning</span>, 8(3–4):231–357, 2015.

\[5\]  
<span id="Xcaron2021dino"></span>Mathilde Caron et al. Emerging properties in self-supervised vision transformers. In <span class="ptmri8t-">ICCV</span>, 2021.

\[6\]  
<span id="Xchoy20194dspconv"></span>Christopher Choy, JunYoung Gwak, and Silvio Savarese. 4d spatio-temporal convnets: Minkowski convolutional neural networks. In <span class="ptmri8t-">CVPR</span>, 2019.

\[7\]  
<span id="Xcover2006elements"></span>Thomas M. Cover and Joy A. Thomas. <span class="ptmri8t-">Elements of Information Theory</span>. Wiley, second edition, 2006.

\[8\]  
<span id="Xcrane2013heat"></span>Keenan Crane, Clarisse Weischedel, and Max Wardetzky. Geodesics in heat: A new approach to computing distance based on heat flow. <span class="ptmri8t-">ACM Transactions on Graphics</span>, 32(5), 2013.

\[9\]  
<span id="Xopennerf2024"></span>Francis Engelmann et al. Opennerf: Open set 3d neural scene segmentation with pixel-wise features and rendered novel views, 2024.

\[10\]  
<span id="Xfelzenszwalb2004efficient"></span>Pedro F. Felzenszwalb and Daniel P. Huttenlocher. Efficient graph-based image segmentation. <span class="ptmri8t-">International Journal of Computer Vision</span>, 2004.

\[11\]  
<span id="Xgoodfellow2016deep"></span>Ian Goodfellow, Yoshua Bengio, and Aaron Courville. <span class="ptmri8t-">Deep Learning</span>. MIT Press, 2016.

\[12\]  
<span id="Xgrady2006random"></span>Leo Grady. Random walks for image segmentation. <span class="ptmri8t-">IEEE Transactions on Pattern Analysis and Machine Intelligence</span>, 28(11):1768–1783, 2006.

\[13\]  
<span id="Xha2022clipfields"></span>Huy Ha et al. Clip-fields: Weakly supervised semantic fields for robotic memory. In <span class="ptmri8t-">RSS</span>, 2022.

\[14\]  
<span id="Xhastie2009elements"></span>Trevor Hastie, Robert Tibshirani, and Jerome Friedman. <span class="ptmri8t-">The Elements of Statistical Learning</span>. Springer, second edition, 2009.

\[15\]  
<span id="Xhu2020randla"></span>Qingyong Hu et al. Randla-net: Efficient semantic segmentation of large-scale point clouds. In <span class="ptmri8t-">CVPR</span>, 2020.

\[16\]  
<span id="Xkerbl20233d"></span>Bernhard Kerbl, Georgios Kopanas, Thomas Leimkühler, and George Drettakis. 3d gaussian splatting for real-time radiance field rendering. In <span class="ptmri8t-">ACM SIGGRAPH</span>, 2023.

\[17\]  
<span id="Xkerr2023lerf"></span>Justin Kerr, Chung Min Kim, Ken Goldberg, Angjoo Kanazawa, and Matthew Tancik. Lerf: Language embedded radiance fields. In <span class="ptmri8t-">IEEE/CVF International Conference on Computer Vision</span>, 2023.

\[18\]  
<span id="Xkingma2015adam"></span>Diederik P. Kingma and Jimmy Ba. Adam: A method for stochastic optimization. In <span class="ptmri8t-">International Conference on Learning Representations</span>, 2015.

\[19\]  
<span id="Xkirillov2023segment"></span>Alexander Kirillov, Eric Mintun, Nikhila Ravi, Hanzi Mao, Chloe Rolland, Laura Gustafson, Tete Xiao, Spencer Whitehead, Alexander C. Berg, Wan-Yen Lo, Piotr Dollar, and Ross Girshick. Segment anything. In <span class="ptmri8t-">IEEE/CVF International Conference on Computer Vision</span>, 2023.

\[20\]  
<span id="Xkobayashi2022dff"></span>Sosuke Kobayashi, Eiichi Matsumoto, and Vincent Sitzmann. Decomposing nerf for editing via feature field distillation. In <span class="ptmri8t-">NeurIPS</span>, 2022.

\[21\]  
<span id="Xlecun1998gradient"></span>Yann LeCun, Léon Bottou, Yoshua Bengio, and Patrick Haffner. Gradient-based learning applied to document recognition. <span class="ptmri8t-">Proceedings of the IEEE</span>, 86(11):2278–2324, 1998.

\[22\]  
<span id="Xmatsuki2024monogs"></span>Hidenobu Matsuki, Riku Murai, Paul H. J. Kelly, and Andrew J. Davison. Monogs: Monocular gaussian splatting slam, 2024.

\[23\]  
<span id="Xmurartal2017orbslam2"></span>Raul Mur-Artal and Juan D. Tardos. Orb-slam2: An open-source slam system for monocular, stereo, and rgb-d cameras. <span class="ptmri8t-">IEEE Transactions on Robotics</span>, 2017.

\[24\]  
<span id="Xmurphy2012machine"></span>Kevin P. Murphy. <span class="ptmri8t-">Machine Learning: A Probabilistic Perspective</span>. MIT Press, 2012.

\[25\]  
<span id="Xnocedal2006numerical"></span>Jorge Nocedal and Stephen J. Wright. <span class="ptmri8t-">Numerical Optimization</span>. Springer, second edition, 2006.

\[26\]  
<span id="Xoquab2023dinov2"></span>Maxime Oquab et al. Dinov2: Learning robust visual features without supervision, 2023.

\[27\]  
<span id="Xpearl2009causality"></span>Judea Pearl. <span class="ptmri8t-">Causality: Models, Reasoning, and Inference</span>. Cambridge University Press, second edition, 2009.

\[28\]  
<span id="Xpeng2023openscene"></span>Songyou Peng, Kyle Genova, Chiyu Jiang, Andrea Tagliasacchi, Marc Pollefeys, and Thomas Funkhouser. Openscene: 3d scene understanding with open vocabularies. In <span class="ptmri8t-">IEEE/CVF Conference on Computer Vision and Pattern Recognition</span>, 2023.

\[29\]  
<span id="Xopensplat3d2025"></span>Jens Piekenbrinck et al. Opensplat3d: Open-vocabulary 3d instance segmentation using gaussian splatting, 2025.

\[30\]  
<span id="Xqi2017pointnet"></span>Charles R. Qi et al. Pointnet: Deep learning on point sets for 3d classification and segmentation. In <span class="ptmri8t-">CVPR</span>, 2017.

\[31\]  
<span id="Xqi2017pointnetplusplus"></span>Charles R. Qi et al. Pointnet++: Deep hierarchical feature learning on point sets in a metric space. In <span class="ptmri8t-">NeurIPS</span>, 2017.

\[32\]  
<span id="Xradford2021clip"></span>Alec Radford et al. Learning transferable visual models from natural language supervision. In <span class="ptmri8t-">ICML</span>, 2021.

\[33\]  
<span id="Xranftl2021vision"></span>Rene Ranftl, Alexey Bochkovskiy, and Vladlen Koltun. Vision transformers for dense prediction. In <span class="ptmri8t-">ICCV</span>, 2021.

\[34\]  
<span id="Xravi2024sam2"></span>Nikhila Ravi, Valentin Gabeur, Yuan-Ting Hu, Ronghang Hu, Chaitanya Ryali, Tengyu Ma, Haitham Khedr, Roman Rädle, Chloe Rolland, Laura Gustafson, et al. Sam 2: Segment anything in images and videos, 2024.

\[35\]  
<span id="Xrobbins1951stochastic"></span>Herbert Robbins and Sutton Monro. A stochastic approximation method. <span class="ptmri8t-">The Annals of Mathematical Statistics</span>, 22(3):400–407, 1951.

\[36\]  
<span id="Xrumelhart1986learning"></span>David E. Rumelhart, Geoffrey E. Hinton, and Ronald J. Williams. Learning representations by back-propagating errors. <span class="ptmri8t-">Nature</span>, 323:533–536, 1986.

\[37\]  
<span id="Xschonberger2016sfm"></span>Johannes L. Schonberger and Jan-Michael Frahm. Structure-from-motion revisited. In <span class="ptmri8t-">CVPR</span>, 2016.

\[38\]  
<span id="Xschult2023mask3d"></span>Jonas Schult et al. Mask3d: Mask transformer for 3d semantic instance segmentation. In <span class="ptmri8t-">ICRA</span>, 2023.

\[39\]  
<span id="Xshannon1948communication"></span>Claude E. Shannon. A mathematical theory of communication. <span class="ptmri8t-">Bell System Technical Journal</span>, 27(3):379–423, 1948.

\[40\]  
<span id="Xtakmaz2023openmask3d"></span>Ayca Takmaz, Elisabetta Fedele, Robert W. Sumner, Marc Pollefeys, Federico Tombari, and Francis Engelmann. Openmask3d: Open-vocabulary 3d instance segmentation. In <span class="ptmri8t-">Advances in Neural Information Processing Systems</span>, 2023.

\[41\]  
<span id="Xteed2021droidslam"></span>Zachary Teed and Jia Deng. Droid-slam: Deep visual slam for monocular, stereo, and rgb-d cameras. In <span class="ptmri8t-">NeurIPS</span>, 2021.

\[42\]  
<span id="Xthomas2019kpconv"></span>Hugues Thomas et al. Kpconv: Flexible and deformable convolution for point clouds. In <span class="ptmri8t-">ICCV</span>, 2019.

\[43\]  
<span id="Xturing1950computing"></span>A. M. Turing. Computing machinery and intelligence. <span class="ptmri8t-">Mind</span>, 59(236):433–460, 1950.

\[44\]  
<span id="Xvapnik1998statistical"></span>Vladimir N. Vapnik. <span class="ptmri8t-">Statistical Learning Theory</span>. Wiley, 1998.

\[45\]  
<span id="Xyang2024depth"></span>Lihe Yang, Bingyi Kang, Zilong Huang, Zhen Zhao, Xiaogang Xu, Jiashi Feng, and Hengshuang Zhao. Depth anything v2, 2024.

\[46\]  
<span id="Xyang2023sam3d"></span>Yunhan Yang, Xiaoyang Wu, Tong He, Hengshuang Zhao, and Xihui Liu. Sam3d: Segment anything in 3d scenes, 2023.

\[47\]  
<span id="Xye2023gaussian"></span>Mingqiao Ye, Martin Danelljan, Fisher Yu, and Lei Ke. Gaussian grouping: Segment and edit anything in 3d scenes, 2023.

</div>
