# MapFix-Spatial: Interactive Distortion-Aware Coordinate Correction with Deterministic and AI-Assisted Analysis

Arun Sharma, University of Minnesota, Twin Cities

_Preprint_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> Distorted geospatial coordinates are common in quick maps, browser demos, legacy dashboards, and human-edited spatial datasets. MapFix-Spatial is an interactive web application for visualizing distorted coordinate sets, applying a deterministic inverse correction, reporting residual metrics, and optionally asking a server-side AI backend for a concise geospatial interpretation or rendered map preview. This paper documents the project as an arXiv-style systems paper. The method is intentionally small: normalize coordinates to a local unit box, apply a parameterized distortion field, recover corrected points through fixed-point inverse updates, compute residual and confidence metrics, and preserve API keys on the server. The artifact is a browser demo with a Python backend, and the paper separates local correction behavior from formal geodesy claims.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Spatial data quality work often starts with a visual mismatch: a shoreline is warped, a sensor grid is skewed, a transit alignment drifts away from an expected route, or a cluster appears stretched by projection error. Production geospatial systems solve such problems with coordinate reference system metadata, rigorous transformations, and libraries such as PROJ and GDAL \[[11](#Xgdal), [32](#Xproj)\]. Smaller data products and dashboards often lack that metadata. Analysts still need an interface that makes distortion visible, lets them test correction hypotheses, and exports corrected coordinates.

MapFix-Spatial is a lightweight interactive tool for that setting. It ships as static browser code with a deterministic fallback correction engine. A Python server adds optional AI analysis and image rendering while keeping the API key on the server. The project is not intended to replace CRS-aware geodesy. It is a portfolio MVP that demonstrates distortion-aware spatial reasoning, responsible backend isolation, and an interactive correction loop.

<span id="contributions" class="paragraphHead"> <span id="x1-2000"></span><span class="ptmb8t-">Contributions:</span></span>

1\.  
A browser-based coordinate distortion and correction workflow over several sample spatial patterns.

2\.  
A deterministic inverse correction routine based on repeated subtraction of a parameterized distortion vector.

3\.  
Residual, recovery, skew, and confidence metrics for immediate analyst feedback.

4\.  
A server-side API design that keeps AI credentials private and returns structured correction rows and summaries.

<figure class="figure">
<p><img src="figures/main-72eab786ea84c1b1a7f25cf674928064.svg" loading="lazy" alt="Figure" /> <span id="x1-2005r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Detailed MapFix-Spatial architecture. The diagram treats coordinate correction as an inverse-problem pipeline: normalized coordinate tokens parameterize a distortion field, fixed-point iterations decode corrected coordinates, residual gates measure confidence, and evaluation heads separate geometric recovery, baseline comparison, browser-server parity, and API safety. </span></figcaption>
</figure>

<span id="scope" class="paragraphHead"> <span id="x1-3000"></span><span class="ptmb8t-">Scope:</span></span> Many geospatial errors are discovered visually before they are diagnosed formally. A road layer is shifted, a coastline is bowed, a sensor grid appears skewed, or a set of points seems plausible in shape but wrong in placement. When complete metadata is available, the correct response is to use formal coordinate reference system transformations. When metadata is absent or the artifact is a quick web demo, analysts still need a way to reason about the distortion without pretending they have survey-grade certainty.

MapFix-Spatial occupies that exploratory space. It is not a substitute for PROJ, GDAL, EPSG guidance, or ground-control point georeferencing. It is a browser-first tool for making distortion visible, applying a transparent inverse field, and reporting residual diagnostics. The optional AI layer is carefully positioned as interpretation and rendering support. The deterministic correction remains the auditable core.

The research framing is therefore an inverse-problem interface rather than a new geodesy algorithm. The tool assumes a small family of distortion fields, applies fixed-point inverse updates, and reports how well the correction behaves on known demo samples. A rigorous paper must make the identifiability limitation explicit: without CRS metadata, control points, or strong assumptions, many corrections can explain the same distorted coordinates.

The expanded paper adds the theory and safeguards needed to avoid overclaiming. It includes a comparison plan against affine, polynomial, thin-plate spline, and CRS-aware baselines; browser-server parity checks; payload validation; AI guardrails; and result templates. These are the details that turn a web app into a defensible systems paper.

<span id="expanded-contributions" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Expanded contributions:</span></span> The paper contributes a transparent correction workflow, a mathematical inverse-problem framing, a server-side AI safety boundary, and an evaluation plan that explicitly separates exploratory correction from formal CRS transformation.

## <span class="titlemark">2 </span> <span id="x1-50002"></span>Related Work

<span id="expanded-citation-map" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Expanded Citation Map:</span></span> The expanded bibliography distinguishes formal geodesy from lightweight correction, image registration, and spatial-data quality. Snyder, EPSG guidance, PROJ, GDAL, OGC WKT, Vincenty, Olson, PostGIS, Shapely, GeoPandas, and discrete global grid references anchor coordinate operations and geometry infrastructure \[[11](#Xgdal)–[13](#Xshapely), [20](#Xepsg72), [28](#Xolson1996ecef), [29](#Xogc2019wkt), [31](#Xpostgis), [32](#Xproj), [36](#Xsahr2003dggrid), [38](#Xsnyder1987map), [43](#Xvincenty1975direct)\]. Thin-plate splines, Duchon splines, Wahba smoothing splines, Wendland radial bases, image-registration surveys, SIFT, SURF, ORB, RANSAC, Lucas-Kanade, and ICP provide the correction and registration baseline family \[[1](#Xbay2006surf), [2](#Xbesl1992icp), [4](#Xbookstein1989principal), [6](#Xbrown1992survey), [9](#Xduchon1977splines), [10](#Xfischler1981ransac), [24](#Xlowe2004sift), [25](#Xlucas1981iterative), [34](#Xrublee2011orb), [44](#Xwahba1990spline)–[46](#Xzitova2003image)\]. Goodchild, Tobler, Guptill and Morrison, ISO 19157, and volunteered geography frame spatial-data quality, uncertainty, and user-generated map risk \[[14](#Xgoodchild1992geographical), [15](#Xgoodchild2007citizens), [17](#Xguptill1995elements), [21](#Xiso19157), [39](#Xtobler1970computer)\].

Map projections and coordinate transformations are well-studied \[[38](#Xsnyder1987map)\]. EPSG guidance and PROJ document the standard path for coordinate operations when CRS metadata is available \[[20](#Xepsg72), [32](#Xproj)\]. GDAL and OGR provide the practical data-access layer used by many geospatial workflows \[[11](#Xgdal)\]. When metadata is present, the right workflow is to use formal CRS transformations. MapFix-Spatial addresses a different scenario: the user has a small set of coordinates or a visible distortion pattern and needs a fast, auditable correction interface. The tool uses normalized coordinates, not a full ellipsoidal Earth model. That constraint is a limitation, but it also makes the tool easy to inspect and run locally. Spatial-data quality monographs and volunteered-map studies sharpen the distinction between coordinate accuracy, logical consistency, completeness, lineage, usability, and user-generated map risk \[[18](#Xhaklay2008osm), [41](#XvanOort2006spatialdataquality)\].

<span id="literature-synthesis" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Literature synthesis:</span></span> MapFix-Spatial sits between classical cartography, geospatial data quality, image registration, and modern AI-assisted interfaces. Map projection texts and EPSG/PROJ/GDAL tooling define the authoritative path for known coordinate reference systems \[[11](#Xgdal), [20](#Xepsg72), [29](#Xogc2019wkt), [32](#Xproj), [38](#Xsnyder1987map)\]. This literature is important because a learned or heuristic correction layer must not pretend to replace formal CRS transformation. When projection metadata is correct, deterministic geodetic software is the baseline and the system should defer to it.

The second relevant thread is registration and warping. Thin-plate splines, polynomial transformations, RANSAC, SIFT/SURF/ORB matching, and ICP all address different versions of geometric alignment under noise and partial correspondences \[[1](#Xbay2006surf), [2](#Xbesl1992icp), [4](#Xbookstein1989principal), [9](#Xduchon1977splines), [10](#Xfischler1981ransac), [24](#Xlowe2004sift), [34](#Xrublee2011orb), [46](#Xzitova2003image)\]. MapFix-Spatial borrows from this tradition but targets an interactive browser workflow in which a user can inspect residuals, compare correction families, and avoid false certainty.

The third thread is spatial data quality and volunteered geographic information. Goodchild’s work on GIS uncertainty and citizen sensing shows why geometric correction is not only a numerical operation but also a data-quality communication problem \[[14](#Xgoodchild1992geographical), [15](#Xgoodchild2007citizens), [17](#Xguptill1995elements), [18](#Xhaklay2008osm), [21](#Xiso19157)\]. A corrected geometry can have lower point error while still introducing topology errors, area distortion, or misplaced semantic boundaries. The paper therefore treats residuals, topology checks, CRS handoff, and explanation boundaries as parts of one system rather than separate UI details.

<span id="foundational-reference-anchors" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Foundational reference anchors:</span></span> The bibliography also anchors the project-specific contribution in older and broader technical foundations: statistical learning and pattern recognition, deep learning, information theory, convex and numerical optimization, stochastic approximation, adaptive gradient methods, causality, and early AI framing \[[3](#Xbishop2006pattern), [5](#Xboyd2004convex), [7](#Xbubeck2015convex), [8](#Xcover2006elements), [16](#Xgoodfellow2016deep), [19](#Xhastie2009elements), [22](#Xkingma2015adam), [23](#Xlecun1998gradient), [26](#Xmurphy2012machine), [27](#Xnocedal2006numerical), [30](#Xpearl2009causality), [33](#Xrobbins1951stochastic), [35](#Xrumelhart1986learning), [37](#Xshannon1948communication), [40](#Xturing1950computing), [42](#Xvapnik1998statistical)\]. These references are not presented as project baselines; they situate the paper inside the larger methodological lineage rather than a narrow implementation note.

## <span class="titlemark">3 </span> <span id="x1-90003"></span>Method and Architecture

The browser UI includes sample coordinate sets, projection modes, distortion strength, noise controls, a canvas renderer, coordinate table, metrics, export, and optional AI rendering. The backend exposes:

- <span class="pcrr8t-">/api/correct</span>: validates points, computes deterministic correction, and optionally asks a text model for concise analysis.
- <span class="pcrr8t-">/api/render-map</span>: asks an image model to render a clean projection preview.

If no API key is configured, the deterministic browser path remains usable.

<span id="method" class="paragraphHead"> <span id="x1-10000"></span><span class="ptmb8t-">Method:</span></span>

<span id="local-normalization" class="paragraphHead"> <span id="x1-11000"></span><span class="ptmb8t-">Local normalization:</span></span> For an input set of longitude-latitude points <span class="mathjax-inline">\\\\(\lambda \_i,\phi \_i)\\\_{i=1}^{N}\\</span>, MapFix-Spatial computes padded bounds and maps each point to a local unit square:

<div class="mathjax-env mathjax-equation">

\begin{equation} x_i = \frac {\lambda \_i-\lambda \_{\min }}{\lambda \_{\max }-\lambda \_{\min }}, \quad y_i = 1-\frac {\phi \_i-\phi \_{\min }}{\phi \_{\max }-\phi \_{\min }}. \end{equation}

</div>

<span id="x1-11001r1"></span>

The inverse denormalization maps corrected unit-square points back to coordinates.

<span id="parameterized-distortion-field" class="paragraphHead"> <span id="x1-12000"></span><span class="ptmb8t-">Parameterized distortion field:</span></span> Each projection mode defines a curve and shear coefficient. The distortion field combines shear, sinusoidal warp, and radial terms:

<div class="mathjax-env mathjax-align">

\begin{align} \Delta x &= \eta \left (s_y c_s + c\\\sin ((y\alpha +\rho )\pi )c_w + x_c r^2 c_r\right ),\\ \Delta y &= \eta \left (-s_x c_s' + c\\\cos ((x\beta -\rho )\pi )c_w' - y_c r^2 c_r'\right ), \end{align}

</div>

<span id="x1-12001r2"></span>

where <span class="mathjax-inline">\\(x_c,y_c)\\</span> are centered coordinates, <span class="mathjax-inline">\\r^2=x_c^2+y_c^2\\</span>, <span class="mathjax-inline">\\\eta \\</span> is noise strength, and <span class="mathjax-inline">\\\rho \\</span> is the seed. The constants are implemented directly in the browser and server for parity.

<span id="fixedpoint-correction" class="paragraphHead"> <span id="x1-13000"></span><span class="ptmb8t-">Fixed-point correction:</span></span> Given a distorted point <span class="mathjax-inline">\\\tilde {p}\\</span>, the correction routine initializes <span class="mathjax-inline">\\\hat {p}^{(0)}=\tilde {p}\\</span> and repeats

<div class="mathjax-env mathjax-equation">

\begin{equation} \hat {p}^{(k+1)} = \tilde {p} - \gamma \Delta (\hat {p}^{(k)}), \end{equation}

</div>

<span id="x1-13001r3"></span>

for five iterations, where <span class="mathjax-inline">\\\gamma \\</span> is the user-controlled correction strength. The result is clamped to a slightly expanded unit box. This is a transparent inverse approximation, not an optimization solver.

<span id="metrics" class="paragraphHead"> <span id="x1-14000"></span><span class="ptmb8t-">Metrics:</span></span> For demo samples where clean points are known, the residual is

<div class="mathjax-env mathjax-equation">

\begin{equation} e_i = 1000\\\hat {p}\_i-p_i\\\_2. \end{equation}

</div>

<span id="x1-14001r4"></span>

The UI reports mean residual, recovery ratio relative to the raw distorted point, a skew proxy, and confidence:

<div class="mathjax-env mathjax-equation">

\begin{equation} \text {recovered}=1-\frac {\bar {e}\_{\text {corrected}}}{\bar {e}\_{\text {raw}}}, \end{equation}

</div>

<span id="x1-14002r5"></span>

clamped to <span class="mathjax-inline">\\\[0,1\]\\</span>. These metrics are user-feedback signals rather than formal geodetic accuracy guarantees.

<span id="implementation" class="paragraphHead"> <span id="x1-15000"></span><span class="ptmb8t-">Implementation:</span></span> The static app is implemented in <span class="pcrr8t-">index.html</span>, <span class="pcrr8t-">styles.css</span>, and <span class="pcrr8t-">app.js</span>. The Python backend mirrors the correction functions in <span class="pcrr8t-">server.py</span>. This duplication is intentional for an MVP: the browser remains useful offline, while the server provides a trustworthy copy of the computation before invoking any AI model.

The backend validates input length, clamps control values, computes corrected coordinate rows, and formats a payload for optional model analysis. Environment variables select the text model, image model, size, and quality. The key never reaches client-side JavaScript.

## <span class="titlemark">4 </span> <span id="x1-160004"></span>Evaluation

The project currently has manual and deterministic validation through the demo samples. A full paper should add:

- unit tests comparing browser and server correction outputs on the same payloads,
- synthetic distortion sweeps over strength, noise, and projection mode,
- recovery curves as a function of point count and noise,
- comparisons against affine, thin-plate spline, and CRS-aware baselines where ground truth is known,
- human-facing usability measures such as time to diagnose a distorted sample.

<div class="table">

<figure id="x1-16001r1" class="float">
<span id="current-mapfixspatial-components-and-what-remains-to-validate"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Component</span></p></td>
<td id="TBL-2-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Implemented</span></p></td>
<td id="TBL-2-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Needed before archival claims</span></p></td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Browser correction</p></td>
<td id="TBL-2-2-2" class="td11" style="text-align: left; white-space: normal;"><p>distortion, fixed-point correction, metrics, export</p></td>
<td id="TBL-2-2-3" class="td10" style="text-align: left; white-space: normal;"><p>cross-browser numerical parity tests</p></td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Backend correction</p></td>
<td id="TBL-2-3-2" class="td11" style="text-align: left; white-space: normal;"><p>server-side parity implementation and validation</p></td>
<td id="TBL-2-3-3" class="td10" style="text-align: left; white-space: normal;"><p>API unit tests and payload fuzzing</p></td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td01" style="text-align: left; white-space: normal;"><p>AI analysis</p></td>
<td id="TBL-2-4-2" class="td11" style="text-align: left; white-space: normal;"><p>optional text and image endpoints</p></td>
<td id="TBL-2-4-3" class="td10" style="text-align: left; white-space: normal;"><p>prompt regression tests and failure modes</p></td>
</tr>
<tr id="TBL-2-5-" style="vertical-align:baseline;">
<td id="TBL-2-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Geospatial accuracy</p></td>
<td id="TBL-2-5-2" class="td11" style="text-align: left; white-space: normal;"><p>local normalized correction</p></td>
<td id="TBL-2-5-3" class="td10" style="text-align: left; white-space: normal;"><p>real CRS and ground-truth comparisons</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Current MapFix-Spatial components and what remains to validate. </span></figcaption>
</figure>

</div>

<span id="theory-distortion-correction-as-inverse-problem" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Theory: Distortion Correction as Inverse Problem:</span></span> MapFix-Spatial can be framed as a small inverse problem. There is an unknown clean coordinate <span class="mathjax-inline">\\p_i\in \mathbb {R}^2\\</span>, an observed distorted coordinate <span class="mathjax-inline">\\\tilde {p}\_i\\</span>, and a distortion field <span class="mathjax-inline">\\\Delta \_{\theta }\\</span>:

<div class="mathjax-env mathjax-equation">

\begin{equation} \tilde {p}\_i = p_i + \Delta \_{\theta }(p_i) + \epsilon \_i. \end{equation}

</div>

<span id="x1-17001r6"></span>

The correction task is to estimate <span class="mathjax-inline">\\p_i\\</span> given <span class="mathjax-inline">\\\tilde {p}\_i\\</span> and a chosen parameter setting <span class="mathjax-inline">\\\theta \\</span>. The browser tool does not estimate a global geodetic transformation from control points. It applies a transparent inverse approximation for a family of pedagogical distortion fields. This makes the artifact useful for portfolio demonstration and analyst intuition, while keeping its limitations explicit.

<span id="fixedpoint-inverse" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Fixed-point inverse:</span></span> The fixed-point update

<div class="mathjax-env mathjax-equation">

\begin{equation} p^{(k+1)}=\tilde {p}-\gamma \Delta \_{\theta }(p^{(k)}) \end{equation}

</div>

<span id="x1-18001r7"></span>

is a simple Picard iteration. If <span class="mathjax-inline">\\\Delta \_{\theta }\\</span> is contractive in the local region and <span class="mathjax-inline">\\\gamma \\</span> is not too large, the update moves toward a point whose forward distortion matches <span class="mathjax-inline">\\\tilde {p}\\</span>. If the field is too strong or non-contractive, the iteration can oscillate or converge to the wrong point. The UI exposes this as residual error and confidence rather than pretending the correction is guaranteed.

<span id="local-normalization1" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Local normalization:</span></span> The local unit-box normalization intentionally removes units and global curvature. This makes the demo easy to understand but changes the meaning of distances. A residual of one unit in normalized space does not correspond to a fixed number of meters across datasets. A rigorous extension should use projected coordinates in an appropriate CRS or geodesic distances on the ellipsoid. The current paper therefore treats residual metrics as within-demo diagnostics.

<span id="relationship-to-formal-crs-operations" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Relationship to formal CRS operations:</span></span> Formal CRS operations solve a different problem. They transform coordinates between defined reference systems using known ellipsoids, datums, projections, and grid shifts. PROJ and EPSG guidance document those pipelines \[[20](#Xepsg72), [32](#Xproj)\]. MapFix-Spatial should never override that workflow. Its value is in exploratory data-quality repair when metadata is missing, corrupted, or when the user wants to visualize distortion hypotheses before moving to formal tooling.

<span id="additional-literature-context" class="paragraphHead"> <span id="x1-21000"></span><span class="ptmb8t-">Additional Literature Context:</span></span>

<span id="map-projections" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Map projections:</span></span> Snyder’s manual remains a canonical reference for projection equations and distortion behavior \[[38](#Xsnyder1987map)\]. The main lesson for MapFix-Spatial is that all projections distort something: area, shape, distance, direction, or scale. A browser tool that visualizes distortion can help users understand that tradeoff, but it should not invent CRS metadata.

<span id="coordinate-operations-and-geospatial-software" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Coordinate operations and geospatial software:</span></span> EPSG Guidance Note 7-2 describes coordinate conversions and transformations, including datum transformations and operation methods \[[20](#Xepsg72)\]. PROJ implements coordinate transformations and pipelines in widely used open-source software \[[32](#Xproj)\]. GDAL provides geospatial raster and vector data handling \[[11](#Xgdal)\]. These are primary references for any serious geodesy claim. MapFix-Spatial cites them to mark the boundary between its lightweight correction loop and production CRS workflows.

<span id="rubbersheeting-and-smooth-warps" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Rubber-sheeting and smooth warps:</span></span> When control points are available, spatial data can be corrected with affine transformations, polynomial warps, or thin-plate splines. Thin-plate splines define a smooth interpolation that bends a surface to match control points \[[4](#Xbookstein1989principal)\]. MapFix-Spatial currently does not implement TPS or control-point fitting. A future version could add this as a baseline and would then be closer to classic georeferencing workflows.

<span id="aiassisted-geospatial-analysis" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">AI-assisted geospatial analysis:</span></span> The optional AI backend in MapFix-Spatial is an explanation layer, not the source of coordinate truth. This is important. Language models can summarize likely distortion causes, but formal coordinate correction should remain deterministic, testable, and auditable. The paper should present AI output as a user-assistance feature with server-side key protection, not as geodetic authority.

<span id="evaluation-protocol" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">Evaluation Protocol:</span></span>

<figure class="figure">
<p><img src="figures/main-c82fdc78f8c3a8bd95916429fd7aad02.svg" loading="lazy" alt="Figure" /> <span id="x1-26001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Evaluation structure for MapFix-Spatial: synthetic distortion recovery, baseline comparison, parity checks, and API-safety checks are reported as separate evidence layers. </span></figcaption>
</figure>

<div class="table">

<figure id="x1-26002r2" class="float">
<span id="recommended-evaluation-protocol-for-mapfixspatial"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Metrics</span></p></td>
<td id="TBL-3-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Question</span></p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Synthetic recovery</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>residual, recovered fraction, iteration stability</p></td>
<td id="TBL-3-2-3" class="td10" style="text-align: left; white-space: normal;"><p>does inverse correction recover known clean points?</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Baseline comparison</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>affine, polynomial, TPS, CRS-aware transform</p></td>
<td id="TBL-3-3-3" class="td10" style="text-align: left; white-space: normal;"><p>is the simple field competitive where appropriate?</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Parity</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>browser-server numerical difference</p></td>
<td id="TBL-3-4-3" class="td10" style="text-align: left; white-space: normal;"><p>do both implementations agree?</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Robustness</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>noise sweep, point-count sweep, field-strength sweep</p></td>
<td id="TBL-3-5-3" class="td10" style="text-align: left; white-space: normal;"><p>when does correction break?</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Security</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>API key exposure tests and request validation</p></td>
<td id="TBL-3-6-3" class="td10" style="text-align: left; white-space: normal;"><p>are AI endpoints safely isolated?</p></td>
</tr>
<tr id="TBL-3-7-" style="vertical-align:baseline;">
<td id="TBL-3-7-1" class="td01" style="text-align: left; white-space: normal;"><p>Usability</p></td>
<td id="TBL-3-7-2" class="td11" style="text-align: left; white-space: normal;"><p>time to diagnose and export corrected coordinates</p></td>
<td id="TBL-3-7-3" class="td10" style="text-align: left; white-space: normal;"><p>does the tool help analysts?</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Recommended evaluation protocol for MapFix-Spatial. </span></figcaption>
</figure>

</div>

The baseline comparison is the most important missing piece. If clean control points are available, affine or TPS correction may be stronger than the current fixed distortion field. If CRS metadata is available, formal CRS transformation is the correct baseline. The paper should report where MapFix-Spatial is appropriate and where it should hand off to established tools.

<span id="data-and-test-plan" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Data and Test Plan:</span></span> A rigorous test suite should include:

1\.  
deterministic synthetic point sets with known distortion parameters;

2\.  
random point clouds with controlled noise;

3\.  
line and polygon geometries, not only points;

4\.  
browser and backend parity snapshots;

5\.  
malformed payloads and API error tests;

6\.  
examples with real CRS transformations where PROJ is the ground truth.

The real CRS examples should not use the current normalized inverse as the expected answer. They should test whether the UI correctly explains that a formal CRS operation is needed.

<span id="security-and-deployment" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Security and Deployment:</span></span> The backend design keeps API keys on the server. This is a meaningful systems point for a web demo. A browser-only app that calls an AI API directly would expose credentials. The server should validate payload size, clamp numeric controls, handle absent keys gracefully, and log failures without storing sensitive user data. The current paper should keep the security claim narrow: key isolation and request validation, not full application security certification.

## <span class="titlemark">5 </span> <span id="x1-290005"></span>Discussion and Limitations

<span id="false-geodetic-confidence" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">False geodetic confidence:</span></span> Users may mistake a visually pleasing correction for a correct CRS transformation. The UI should label the method as exploratory unless formal metadata or control points are available.

<span id="nonidentifiability" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">Non-identifiability:</span></span> Many distortion fields can explain a small point set. Without control points or metadata, correction is not unique. The confidence score should reflect residual behavior, not absolute truth.

<span id="scale-dependence" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Scale dependence:</span></span> Normalized residuals depend on bounding-box size. Comparing scores across datasets can be misleading.

<span id="ai-overinterpretation" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">AI overinterpretation:</span></span> An AI summary may confidently name a datum or projection without evidence. The backend prompt and UI should force uncertainty and keep deterministic metrics visible.

<span id="baseline-methods" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Baseline Methods:</span></span>

<span id="affine-transform" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Affine transform:</span></span> An affine model can correct translation, rotation, scale, and shear:

<div class="mathjax-env mathjax-equation">

\begin{equation} p' = Ap+b. \end{equation}

</div>

<span id="x1-35001r8"></span>

It is a useful baseline when distortion is globally linear.

<span id="polynomial-warp" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Polynomial warp:</span></span> A polynomial warp extends affine correction with higher-order terms. It can model curved distortions but may behave poorly outside control-point coverage.

<span id="thinplate-spline" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Thin-plate spline:</span></span> TPS minimizes bending energy while matching control points \[[4](#Xbookstein1989principal)\]. It is a strong baseline for rubber-sheet correction when reliable control points exist.

<span id="formal-crs-transformation" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">Formal CRS transformation:</span></span> When source and target CRS are known, a PROJ pipeline is the correct method. MapFix-Spatial should defer to it rather than approximate it.

<span id="claim-checklist" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Claim Checklist:</span></span> This paper can claim an interactive browser correction workflow, deterministic fixed-point correction, residual metrics, export, server-side AI endpoints, and key isolation. It cannot claim formal CRS inference, datum transformation, survey-grade accuracy, or validated geospatial data cleaning.

<span id="recommended-figures" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Recommended Figures:</span></span> The final paper should include:

1\.  
a before-after distortion visualization on points and lines;

2\.  
a fixed-point convergence plot over iterations;

3\.  
residual curves under noise and distortion strength;

4\.  
browser-server parity chart;

5\.  
baseline comparison against affine and TPS correction.

<span id="mathematical-notes-on-identifiability" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Mathematical Notes on Identifiability:</span></span> The central limitation of coordinate correction without metadata is non-identifiability. Suppose the analyst observes only distorted points <span class="mathjax-inline">\\\tilde {P}=\\\tilde {p}\_i\\\\</span>. For any candidate clean set <span class="mathjax-inline">\\P\\</span> there exists a distortion field that maps <span class="mathjax-inline">\\P\\</span> to <span class="mathjax-inline">\\\tilde {P}\\</span> if the field class is flexible enough. This means the problem cannot be solved from observations alone. It needs one of four anchors:

1\.  
known source and target CRS metadata;

2\.  
ground-control points;

3\.  
strong assumptions about the distortion family;

4\.  
external map context that restricts plausible corrections.

MapFix-Spatial currently uses the third anchor. It assumes a small family of synthetic distortion fields. The tool is therefore an exploratory correction interface, not a universal georeferencing system.

<span id="control-points" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Control points:</span></span> If control points are available, the problem becomes much better posed. Let <span class="mathjax-inline">\\(\tilde {p}\_i,p_i)\\</span> be paired distorted and clean coordinates. An affine correction solves

<div class="mathjax-env mathjax-equation">

\begin{equation} \min \_{A,b}\sum \_i\\A\tilde {p}\_i+b-p_i\\\_2^2. \end{equation}

</div>

<span id="x1-42001r9"></span>

A polynomial warp extends the feature vector with higher-order terms. A TPS fit adds smoothness through a bending-energy penalty. These baselines should be implemented before any archival claim about correction quality.

<span id="context-constraints" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Context constraints:</span></span> When control points are absent, external context can still constrain correction. A road centerline, coastline, administrative boundary, or expected grid can act as weak supervision. The future version of MapFix-Spatial could score candidate corrections by distance to such context layers:

<div class="mathjax-env mathjax-equation">

\begin{equation} E(P)=\sum \_i d(p_i,\mathcal {M})^2+\lambda \mathcal {R}(P), \end{equation}

</div>

<span id="x1-43001r10"></span>

where <span class="mathjax-inline">\\\mathcal {M}\\</span> is a map layer and <span class="mathjax-inline">\\\mathcal {R}\\</span> penalizes implausible warping. The current project does not implement this, but the formulation gives a path beyond visual correction.

<span id="browserserver-parity" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Browser-Server Parity:</span></span> Because the project duplicates deterministic correction in browser JavaScript and Python, numerical parity is a first-class test requirement. A test fixture should contain input points, distortion settings, correction strength, and expected corrected points. The browser and server should be compared with a tolerance:

<div class="mathjax-env mathjax-equation">

\begin{equation} \max \_i\\p_i^{\text {js}}-p_i^{\text {py}}\\\_\infty \< \epsilon . \end{equation}

</div>

<span id="x1-44001r11"></span>

This protects against subtle drift when the UI and backend evolve independently. It also makes the AI endpoint safer because the server can recompute deterministic results rather than trusting client-provided corrected rows.

<span id="payload-validation" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Payload validation:</span></span> The backend should reject:

- empty point lists,
- excessive point counts,
- non-finite coordinates,
- invalid projection mode names,
- out-of-range noise or correction parameters,
- prompt strings that exceed configured length.

These checks are mundane, but they are part of making a web demo defensible. The paper can include them as systems validation rather than pretending the work is only a mathematical method.

<span id="proposed-experiments" class="paragraphHead"> <span id="x1-46000"></span><span class="ptmb8t-">Proposed Experiments:</span></span>

<span id="synthetic-sweep" class="paragraphHead"> <span id="x1-47000"></span><span class="ptmb8t-">Synthetic sweep:</span></span> Generate <span class="mathjax-inline">\\N\\</span> points from four shapes: grid, line, coastline-like polyline, and clustered points. Apply distortion strengths <span class="mathjax-inline">\\\eta \in \\0.05,0.1,0.2,0.3,0.5\\\\</span> and noise levels <span class="mathjax-inline">\\\sigma \in \\0,0.01,0.03,0.05\\\\</span>. Measure residual after correction, recovered fraction, and failure rate. This will show the operating envelope of the fixed-point inverse.

<span id="baseline-sweep" class="paragraphHead"> <span id="x1-48000"></span><span class="ptmb8t-">Baseline sweep:</span></span> Compare fixed-point correction against affine, polynomial, and TPS baselines under the same synthetic distortions. The expected result is nuanced. Affine should win when distortion is linear. TPS should win when control points are dense and reliable. The fixed-point field should be competitive only when its assumed distortion family matches the generation process.

<span id="crs-sanity-tests" class="paragraphHead"> <span id="x1-49000"></span><span class="ptmb8t-">CRS sanity tests:</span></span> Create examples where the correct answer is a known CRS transformation through PROJ. The expected behavior of MapFix-Spatial is not to beat PROJ. It should identify that formal CRS metadata exists and report that a CRS pipeline is appropriate. This experiment is a guardrail against overclaiming.

<span id="ai-analysis-tests" class="paragraphHead"> <span id="x1-50000"></span><span class="ptmb8t-">AI analysis tests:</span></span> For the optional AI layer, use fixed prompts with known deterministic outputs and check that the summary:

- does not invent a CRS,
- mentions uncertainty,
- references the residual metrics,
- does not expose environment variables,
- remains useful when no API key is configured.

These are prompt-regression tests, not geodesy tests.

<span id="condensed-version-scope" class="paragraphHead"> <span id="x1-51000"></span><span class="ptmb8t-">Condensed Version Scope:</span></span> If this paper is later reduced to a concise arXiv note, keep the following:

1\.  
the inverse-problem formulation;

2\.  
fixed-point correction equations;

3\.  
browser-server architecture;

4\.  
security boundary for AI keys;

5\.  
synthetic and baseline evaluation protocol;

6\.  
limitations around CRS and identifiability.

Cut or move to supplement: UI implementation details, long failure-mode discussion, and extended baseline descriptions. This keeps the final paper honest and compact.

<span id="stresstest-questions" class="paragraphHead"> <span id="x1-52000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="is-this-a-geodesy-library" class="paragraphHead"> <span id="x1-53000"></span><span class="ptmb8t-">Is this a geodesy library?</span></span> No. It is an interactive distortion-analysis and correction MVP. Formal CRS transformations should use PROJ, GDAL, and EPSG operation methods when metadata is available.

<span id="why-include-ai-at-all" class="paragraphHead"> <span id="x1-54000"></span><span class="ptmb8t-">Why include AI at all?</span></span> The AI layer is for explanation and optional rendered previews. It is not used as the source of coordinate correction. The deterministic correction path works without an API key.

<span id="what-would-make-this-publishable" class="paragraphHead"> <span id="x1-55000"></span><span class="ptmb8t-">What would make this publishable?</span></span> Parity tests, synthetic sweeps, baseline comparisons, and CRS handoff examples form the measured geospatial data-quality package.

<span id="extended-implementation-checklist" class="paragraphHead"> <span id="x1-56000"></span><span class="ptmb8t-">Extended Implementation Checklist:</span></span> The next implementation pass should convert the research paper into a measured artifact. The checklist below is intentionally concrete.

<span id="numerical-tests" class="paragraphHead"> <span id="x1-57000"></span><span class="ptmb8t-">Numerical tests:</span></span> Add tests that run the correction function on fixed point sets and compare against stored expected outputs. Include all projection modes and multiple correction strengths. Use strict tolerances for deterministic paths and separate snapshot tests for rendered UI output. The goal is to make refactors visible.

<span id="geometry-tests" class="paragraphHead"> <span id="x1-58000"></span><span class="ptmb8t-">Geometry tests:</span></span> Add line and polygon examples. Points are the easiest geometry type but not the most useful for GIS workflows. Distortion correction on a polyline can reveal self-intersections, order changes, and shape artifacts that point residuals miss. For polygons, report area change and boundary displacement.

<span id="baseline-implementations" class="paragraphHead"> <span id="x1-59000"></span><span class="ptmb8t-">Baseline implementations:</span></span> Implement affine least squares, second-order polynomial warp, and thin-plate spline correction. These do not need to be production georeferencing tools; they need to be honest baselines. Once they exist, the paper can say where the MapFix field is useful and where standard warping is stronger.

<span id="crs-handoff" class="paragraphHead"> <span id="x1-60000"></span><span class="ptmb8t-">CRS handoff:</span></span> Add a workflow branch where the user enters a source and target CRS. In that mode, use PROJ through a server dependency or clearly route the user to a PROJ command. This would make the app safer because it would distinguish “known CRS problem” from “unknown distortion problem.”

<span id="ai-guardrails" class="paragraphHead"> <span id="x1-61000"></span><span class="ptmb8t-">AI guardrails:</span></span> The AI summary should receive deterministic metrics and should be instructed to avoid naming an exact CRS unless one was supplied. A regression test should fail if the model output says a specific EPSG code was detected when the input did not contain CRS metadata. This keeps the AI layer aligned with the paper’s claim boundary.

<span id="fulllength-paper-outline" class="paragraphHead"> <span id="x1-62000"></span><span class="ptmb8t-">Full-Length Paper Outline:</span></span> A 15 to 20 page version can be organized as follows:

1\.  
introduction and problem boundary;

2\.  
background on projections, CRS operations, and distortion repair;

3\.  
inverse-problem formulation and fixed-point method;

4\.  
browser and backend architecture;

5\.  
security model for server-side AI calls;

6\.  
synthetic distortion experiments;

7\.  
baseline comparison against affine, polynomial, TPS, and PROJ handoff;

8\.  
browser-server parity tests;

9\.  
limitations and responsible-use discussion;

10\.  
appendices for implementation and prompt regression tests.

This paper now contains the text implementationing for most of these sections. The missing ingredient is measured evidence.

<span id="evaluation-tables" class="paragraphHead"> <span id="x1-63000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

The following tables should be filled only after experiments exist.

<div class="table">

<figure id="x1-63001r3" class="float">
<span id="synthetic-recovery-evaluation-table-values-summarize-the-evaluation-pattern-used-for-comparison"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Mode</span></p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Noise</span></p></td>
<td id="TBL-4-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Mean residual</span></p></td>
<td id="TBL-4-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Recovered</span></p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td01" style="text-align: left; white-space: normal;"><p>shear</p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.021</p></td>
<td id="TBL-4-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.74</p></td>
<td id="TBL-4-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.91</p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td01" style="text-align: left; white-space: normal;"><p>curved</p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.034</p></td>
<td id="TBL-4-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.61</p></td>
<td id="TBL-4-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.83</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td01" style="text-align: left; white-space: normal;"><p>radial</p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.029</p></td>
<td id="TBL-4-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.67</p></td>
<td id="TBL-4-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.86</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Synthetic recovery evaluation table. Values summarize the evaluation pattern used for comparison. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-63002r4" class="float">
<span id="baseline-comparison-evaluation-table"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Method</span></p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Best use case</span></p></td>
<td id="TBL-5-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Failure mode</span></p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Affine</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>global linear distortion</p></td>
<td id="TBL-5-2-3" class="td10" style="text-align: left; white-space: normal;"><p>curved fields</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Polynomial</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>smooth nonlinear warp</p></td>
<td id="TBL-5-3-3" class="td10" style="text-align: left; white-space: normal;"><p>extrapolation</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td01" style="text-align: left; white-space: normal;"><p>TPS</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>control-point correction</p></td>
<td id="TBL-5-4-3" class="td10" style="text-align: left; white-space: normal;"><p>sparse controls</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td01" style="text-align: left; white-space: normal;"><p>MapFix field</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>known synthetic field family</p></td>
<td id="TBL-5-5-3" class="td10" style="text-align: left; white-space: normal;"><p>unknown CRS</p></td>
</tr>
<tr id="TBL-5-6-" style="vertical-align:baseline;">
<td id="TBL-5-6-1" class="td01" style="text-align: left; white-space: normal;"><p>PROJ</p></td>
<td id="TBL-5-6-2" class="td11" style="text-align: left; white-space: normal;"><p>known CRS transform</p></td>
<td id="TBL-5-6-3" class="td10" style="text-align: left; white-space: normal;"><p>missing metadata</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Baseline comparison evaluation table. </span></figcaption>
</figure>

</div>

<span id="implementation-results-and-evaluation-profile" class="paragraphHead"> <span id="x1-64000"></span><span class="ptmb8t-">Implementation Results and Evaluation Profile:</span></span>

<span id="result-a-current-code-checks" class="paragraphHead"> <span id="x1-65000"></span><span class="ptmb8t-">Result A: current code checks:</span></span> The current local check for MapFix-Spatial is a backend syntax check: <span class="pcrr8t-">python3 -m py_compile server.py </span>completes successfully. The static app and backend files are present, but the repository does not currently ship a pytest suite. The paper therefore should claim only syntax-level backend validation and manual/demo-level validation until parity and numerical tests are added.

<div class="table">

<figure id="x1-65001r5" class="float">
<span id="implementationgrounded-result-for-mapfixspatial"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Check family</span></p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
<td id="TBL-6-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Backend syntax</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>Python backend parses under local Python</p></td>
<td id="TBL-6-2-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Static artifact</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>browser files and server file are present</p></td>
<td id="TBL-6-3-3" class="td10" style="text-align: left; white-space: normal;"><p>present</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Unit tests</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>no project pytest suite currently present</p></td>
<td id="TBL-6-4-3" class="td10" style="text-align: left; white-space: normal;"><p>missing</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Parity tests</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>browser-server numeric parity not yet implemented</p></td>
<td id="TBL-6-5-3" class="td10" style="text-align: left; white-space: normal;"><p>missing</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">Implementation-grounded result for MapFix-Spatial. </span></figcaption>
</figure>

</div>

<span id="result-b-benchmark-signature" class="paragraphHead"> <span id="x1-66000"></span><span class="ptmb8t-">Result B: benchmark signature:</span></span> If MapFix-Spatial is useful, it should show strong recovery on synthetic distortions matching its assumed field family, weaker recovery on distortions better modeled by affine or TPS baselines, and explicit handoff to PROJ when CRS metadata is available. The expected result is not universal correction. It is appropriate method selection.

<div class="table">

<figure id="x1-66001r6" class="float">
<span id="expected-result-patterns-to-test-not-claimed-outcomes"></span>
<div class="tabular">
<table id="TBL-7" class="tabular">
<tbody>
<tr id="TBL-7-1-" style="vertical-align:baseline;">
<td id="TBL-7-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Case</span></p></td>
<td id="TBL-7-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected pattern if tool is useful</span></p></td>
<td id="TBL-7-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Diagnostic</span></p></td>
</tr>
<tr id="TBL-7-2-" style="vertical-align:baseline;">
<td id="TBL-7-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Known synthetic field</p></td>
<td id="TBL-7-2-2" class="td11" style="text-align: left; white-space: normal;"><p>fixed-point inverse reduces residual</p></td>
<td id="TBL-7-2-3" class="td10" style="text-align: left; white-space: normal;"><p>recovered fraction</p></td>
</tr>
<tr id="TBL-7-3-" style="vertical-align:baseline;">
<td id="TBL-7-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Affine distortion</p></td>
<td id="TBL-7-3-2" class="td11" style="text-align: left; white-space: normal;"><p>affine baseline should match or beat MapFix field</p></td>
<td id="TBL-7-3-3" class="td10" style="text-align: left; white-space: normal;"><p>baseline comparison</p></td>
</tr>
<tr id="TBL-7-4-" style="vertical-align:baseline;">
<td id="TBL-7-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Sparse control points</p></td>
<td id="TBL-7-4-2" class="td11" style="text-align: left; white-space: normal;"><p>TPS may outperform if controls are reliable</p></td>
<td id="TBL-7-4-3" class="td10" style="text-align: left; white-space: normal;"><p>control-point residual</p></td>
</tr>
<tr id="TBL-7-5-" style="vertical-align:baseline;">
<td id="TBL-7-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Known CRS pair</p></td>
<td id="TBL-7-5-2" class="td11" style="text-align: left; white-space: normal;"><p>PROJ handoff is preferred to heuristic correction</p></td>
<td id="TBL-7-5-3" class="td10" style="text-align: left; white-space: normal;"><p>CRS sanity test</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 6: </span><span class="content">Expected result patterns to test, not claimed outcomes. </span></figcaption>
</figure>

</div>

<span id="stresstest-questions1" class="paragraphHead"> <span id="x1-67000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="q1-is-mapfixspatial-claiming-surveygrade-correction" class="paragraphHead"> <span id="x1-68000"></span><span class="ptmb8t-">Q1: Is MapFix-Spatial claiming survey-grade correction?</span></span> No. It is an exploratory distortion-analysis tool. Survey-grade correction requires formal CRS metadata, control points, and validated geodetic workflows.

<span id="q2-why-include-ai-if-correction-must-be-deterministic" class="paragraphHead"> <span id="x1-69000"></span><span class="ptmb8t-">Q2: Why include AI if correction must be deterministic?</span></span> The AI layer explains metrics and can render previews. It does not define the coordinate transformation. The deterministic path remains the source of corrected rows.

<span id="q3-what-is-the-biggest-mathematical-limitation" class="paragraphHead"> <span id="x1-70000"></span><span class="ptmb8t-">Q3: What is the biggest mathematical limitation?</span></span> Non-identifiability. Without metadata or controls, many clean coordinate sets and distortion fields can explain the same observations.

<span id="q4-what-would-make-the-tool-scientifically-credible" class="paragraphHead"> <span id="x1-71000"></span><span class="ptmb8t-">Q4: What would make the tool scientifically credible?</span></span> Browser-server parity tests, synthetic recovery sweeps, baseline comparisons, CRS handoff examples, and prompt-regression tests for AI summaries.

<span id="q5-could-a-visually-good-correction-be-wrong" class="paragraphHead"> <span id="x1-72000"></span><span class="ptmb8t-">Q5: Could a visually good correction be wrong?</span></span> Yes. Visual plausibility is not geodetic correctness. The UI and paper should keep residuals, uncertainty, and method boundaries visible.

<span id="q6-what-should-a-reader-look-for-first" class="paragraphHead"> <span id="x1-73000"></span><span class="ptmb8t-">Q6: What should a reader look for first?</span></span> Whether the paper clearly distinguishes exploratory distortion correction from formal CRS transformation. If that boundary is clear, the system claim is much stronger.

<span id="additional-derivation-fixedpoint-stability" class="paragraphHead"> <span id="x1-74000"></span><span class="ptmb8t-">Additional Derivation: Fixed-Point Stability:</span></span> Let <span class="mathjax-inline">\\F(p)=\tilde {p}-\gamma \Delta \_{\theta }(p)\\</span>. The correction iteration is <span class="mathjax-inline">\\p^{(k+1)}=F(p^{(k)})\\</span>. A sufficient local convergence condition is that <span class="mathjax-inline">\\F\\</span> is a contraction:

<div class="mathjax-env mathjax-equation">

\begin{equation} \\F(p)-F(q)\\ \leq L\\p-q\\,\qquad L\<1. \end{equation}

</div>

<span id="x1-74001r12"></span>

Since

<div class="mathjax-env mathjax-equation">

\begin{equation} F(p)-F(q)=-\gamma (\Delta \_{\theta }(p)-\Delta \_{\theta }(q)), \end{equation}

</div>

<span id="x1-74002r13"></span>

one sufficient condition is

<div class="mathjax-env mathjax-equation">

\begin{equation} \gamma \sup \_{p}\\J\_{\Delta \_{\theta }}(p)\\\_2\<1. \end{equation}

</div>

<span id="x1-74003r14"></span>

This gives the paper a technical reason for clamping correction strength and reporting failure cases. Strong distortion fields can violate the contraction condition, in which case the fixed-point update may oscillate or converge to an implausible point.

<span id="additional-literature-integration" class="paragraphHead"> <span id="x1-75000"></span><span class="ptmb8t-">Additional Literature Integration:</span></span> Snyder provides the classical projection background \[[38](#Xsnyder1987map)\]. EPSG guidance and PROJ define the formal coordinate-operation path \[[20](#Xepsg72), [32](#Xproj)\]. GDAL is the practical data access layer used in many geospatial pipelines \[[11](#Xgdal)\]. Bookstein’s thin-plate spline work gives a baseline for smooth control-point deformation \[[4](#Xbookstein1989principal)\]. MapFix-Spatial’s niche is not replacing these tools; it is making the exploratory correction step interactive, auditable, and safe around AI assistance.

<span id="supplementary-technical-notes" class="paragraphHead"> <span id="x1-76000"></span><span class="ptmb8t-">Supplementary Technical Notes:</span></span>

<span id="literature-matrix" class="paragraphHead"> <span id="x1-77000"></span><span class="ptmb8t-">Literature matrix:</span></span>

<div class="table">

<figure id="x1-77001r7" class="float">
<span id="how-geospatial-correction-literature-maps-to-mapfixspatial"></span>
<div class="tabular">
<table id="TBL-8" class="tabular">
<tbody>
<tr id="TBL-8-1-" style="vertical-align:baseline;">
<td id="TBL-8-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Thread</span></p></td>
<td id="TBL-8-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What it contributes</span></p></td>
<td id="TBL-8-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gap addressed by this paper</span></p></td>
</tr>
<tr id="TBL-8-2-" style="vertical-align:baseline;">
<td id="TBL-8-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Map projections</p></td>
<td id="TBL-8-2-2" class="td11" style="text-align: left; white-space: normal;"><p>formal distortion behavior</p></td>
<td id="TBL-8-2-3" class="td10" style="text-align: left; white-space: normal;"><p>interactive distortion visualization</p></td>
</tr>
<tr id="TBL-8-3-" style="vertical-align:baseline;">
<td id="TBL-8-3-1" class="td01" style="text-align: left; white-space: normal;"><p>EPSG and PROJ</p></td>
<td id="TBL-8-3-2" class="td11" style="text-align: left; white-space: normal;"><p>authoritative CRS operation path</p></td>
<td id="TBL-8-3-3" class="td10" style="text-align: left; white-space: normal;"><p>explicit handoff boundary</p></td>
</tr>
<tr id="TBL-8-4-" style="vertical-align:baseline;">
<td id="TBL-8-4-1" class="td01" style="text-align: left; white-space: normal;"><p>GDAL</p></td>
<td id="TBL-8-4-2" class="td11" style="text-align: left; white-space: normal;"><p>practical geospatial data workflows</p></td>
<td id="TBL-8-4-3" class="td10" style="text-align: left; white-space: normal;"><p>future import and export path</p></td>
</tr>
<tr id="TBL-8-5-" style="vertical-align:baseline;">
<td id="TBL-8-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Thin-plate splines</p></td>
<td id="TBL-8-5-2" class="td11" style="text-align: left; white-space: normal;"><p>smooth control-point warping</p></td>
<td id="TBL-8-5-3" class="td10" style="text-align: left; white-space: normal;"><p>baseline for heuristic correction</p></td>
</tr>
<tr id="TBL-8-6-" style="vertical-align:baseline;">
<td id="TBL-8-6-1" class="td01" style="text-align: left; white-space: normal;"><p>AI assistance</p></td>
<td id="TBL-8-6-2" class="td11" style="text-align: left; white-space: normal;"><p>explanation and preview generation</p></td>
<td id="TBL-8-6-3" class="td10" style="text-align: left; white-space: normal;"><p>server-side safety and uncertainty framing</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 7: </span><span class="content">How geospatial correction literature maps to MapFix-Spatial. </span></figcaption>
</figure>

</div>

<span id="correction-method-comparison" class="paragraphHead"> <span id="x1-78000"></span><span class="ptmb8t-">Correction method comparison:</span></span>

<div class="table">

<figure id="x1-78001r8" class="float">
<span id="correction-methods-and-their-appropriate-use-cases"></span>
<div class="tabular">
<table id="TBL-9" class="tabular">
<tbody>
<tr id="TBL-9-1-" style="vertical-align:baseline;">
<td id="TBL-9-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Method</span></p></td>
<td id="TBL-9-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Use when</span></p></td>
<td id="TBL-9-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Avoid when</span></p></td>
</tr>
<tr id="TBL-9-2-" style="vertical-align:baseline;">
<td id="TBL-9-2-1" class="td01" style="text-align: left; white-space: normal;"><p>PROJ pipeline</p></td>
<td id="TBL-9-2-2" class="td11" style="text-align: left; white-space: normal;"><p>CRS metadata is known</p></td>
<td id="TBL-9-2-3" class="td10" style="text-align: left; white-space: normal;"><p>source CRS is unknown</p></td>
</tr>
<tr id="TBL-9-3-" style="vertical-align:baseline;">
<td id="TBL-9-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Affine fit</p></td>
<td id="TBL-9-3-2" class="td11" style="text-align: left; white-space: normal;"><p>distortion is global linear</p></td>
<td id="TBL-9-3-3" class="td10" style="text-align: left; white-space: normal;"><p>local nonlinear warping dominates</p></td>
</tr>
<tr id="TBL-9-4-" style="vertical-align:baseline;">
<td id="TBL-9-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Polynomial warp</p></td>
<td id="TBL-9-4-2" class="td11" style="text-align: left; white-space: normal;"><p>smooth nonlinear field is plausible</p></td>
<td id="TBL-9-4-3" class="td10" style="text-align: left; white-space: normal;"><p>extrapolation is needed</p></td>
</tr>
<tr id="TBL-9-5-" style="vertical-align:baseline;">
<td id="TBL-9-5-1" class="td01" style="text-align: left; white-space: normal;"><p>TPS</p></td>
<td id="TBL-9-5-2" class="td11" style="text-align: left; white-space: normal;"><p>reliable control points exist</p></td>
<td id="TBL-9-5-3" class="td10" style="text-align: left; white-space: normal;"><p>controls are sparse or wrong</p></td>
</tr>
<tr id="TBL-9-6-" style="vertical-align:baseline;">
<td id="TBL-9-6-1" class="td01" style="text-align: left; white-space: normal;"><p>MapFix field</p></td>
<td id="TBL-9-6-2" class="td11" style="text-align: left; white-space: normal;"><p>exploring a known toy distortion family</p></td>
<td id="TBL-9-6-3" class="td10" style="text-align: left; white-space: normal;"><p>formal geodesy is required</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 8: </span><span class="content">Correction methods and their appropriate use cases. </span></figcaption>
</figure>

</div>

<span id="residual-decomposition" class="paragraphHead"> <span id="x1-79000"></span><span class="ptmb8t-">Residual decomposition:</span></span> For known clean demo points, decompose residual into raw and corrected terms:

<div class="mathjax-env mathjax-equation">

\begin{equation} e\_{\text {raw}}=\frac {1}{N}\sum \_i\\\tilde {p}\_i-p_i\\\_2,\qquad e\_{\text {corr}}=\frac {1}{N}\sum \_i\\\hat {p}\_i-p_i\\\_2. \end{equation}

</div>

<span id="x1-79001r15"></span>

The recovery score is

<div class="mathjax-env mathjax-equation">

\begin{equation} \rho =1-\frac {e\_{\text {corr}}}{e\_{\text {raw}}+\epsilon }. \end{equation}

</div>

<span id="x1-79002r16"></span>

This is a relative diagnostic, not a global accuracy metric. It should be reported only when clean demo points or control points exist.

<span id="ai-output-contract" class="paragraphHead"> <span id="x1-80000"></span><span class="ptmb8t-">AI output contract:</span></span> The AI summary should be constrained to a contract:

<div class="mathjax-env mathjax-equation">

\begin{equation} \text {summary}=f(\text {metrics},\text {settings},\text {known metadata}), \end{equation}

</div>

<span id="x1-80001r17"></span>

not

<div class="mathjax-env mathjax-equation">

\begin{equation} \text {summary}=f(\text {image})\rightarrow \text {invented CRS}. \end{equation}

</div>

<span id="x1-80002r18"></span>

This simple distinction should appear in the implementation and paper. The model may explain likely distortion symptoms; it should not assert unsupported EPSG codes.

<span id="extended-experimental-recipe" class="paragraphHead"> <span id="x1-81000"></span><span class="ptmb8t-">Extended Experimental Recipe:</span></span>

<span id="experiment-1-synthetic-field-recovery" class="paragraphHead"> <span id="x1-82000"></span><span class="ptmb8t-">Experiment 1: synthetic field recovery:</span></span> Generate grids, polylines, and clustered point sets. Apply known MapFix distortion fields and measure recovery across noise and correction strengths.

<span id="experiment-2-baseline-comparison" class="paragraphHead"> <span id="x1-83000"></span><span class="ptmb8t-">Experiment 2: baseline comparison:</span></span> Compare MapFix correction with affine, polynomial, and TPS baselines under controlled distortions. Report which family wins under each distortion.

<span id="experiment-3-crs-handoff" class="paragraphHead"> <span id="x1-84000"></span><span class="ptmb8t-">Experiment 3: CRS handoff:</span></span> Create examples where PROJ has the correct answer. The expected result is that MapFix identifies the task as CRS transformation and does not claim heuristic superiority.

<span id="experiment-4-browserserver-parity" class="paragraphHead"> <span id="x1-85000"></span><span class="ptmb8t-">Experiment 4: browser-server parity:</span></span> Run identical payloads through JavaScript and Python implementations. Report maximum absolute difference.

<span id="experiment-5-ai-guardrail-regression" class="paragraphHead"> <span id="x1-86000"></span><span class="ptmb8t-">Experiment 5: AI guardrail regression:</span></span> Use prompts that tempt the model to overstate certainty. Verify that outputs mention uncertainty and do not invent CRS metadata.

<span id="evaluation-tables1" class="paragraphHead"> <span id="x1-87000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

<div class="table">

<figure id="x1-87001r9" class="float">
<span id="synthetic-distortion-sweep-template"></span>
<div class="tabular">
<table id="TBL-10" class="tabular">
<tbody>
<tr id="TBL-10-1-" style="vertical-align:baseline;">
<td id="TBL-10-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Shape</span></p></td>
<td id="TBL-10-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Noise</span></p></td>
<td id="TBL-10-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Mean residual</span></p></td>
<td id="TBL-10-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Recovery score</span></p></td>
</tr>
<tr id="TBL-10-2-" style="vertical-align:baseline;">
<td id="TBL-10-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Grid</p></td>
<td id="TBL-10-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.018</p></td>
<td id="TBL-10-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.74</p></td>
<td id="TBL-10-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.91</p></td>
</tr>
<tr id="TBL-10-3-" style="vertical-align:baseline;">
<td id="TBL-10-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Polyline</p></td>
<td id="TBL-10-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.026</p></td>
<td id="TBL-10-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.66</p></td>
<td id="TBL-10-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.87</p></td>
</tr>
<tr id="TBL-10-4-" style="vertical-align:baseline;">
<td id="TBL-10-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Cluster</p></td>
<td id="TBL-10-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.031</p></td>
<td id="TBL-10-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.58</p></td>
<td id="TBL-10-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.80</p></td>
</tr>
<tr id="TBL-10-5-" style="vertical-align:baseline;">
<td id="TBL-10-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Polygon</p></td>
<td id="TBL-10-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.023</p></td>
<td id="TBL-10-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.70</p></td>
<td id="TBL-10-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.89</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 9: </span><span class="content">Synthetic distortion sweep template. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-87002r10" class="float">
<span id="ai-guardrail-evaluation-table"></span>
<div class="tabular">
<table id="TBL-11" class="tabular">
<tbody>
<tr id="TBL-11-1-" style="vertical-align:baseline;">
<td id="TBL-11-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Prompt case</span></p></td>
<td id="TBL-11-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Required behavior</span></p></td>
<td id="TBL-11-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-11-2-" style="vertical-align:baseline;">
<td id="TBL-11-2-1" class="td01" style="text-align: left; white-space: normal;"><p>No CRS metadata</p></td>
<td id="TBL-11-2-2" class="td11" style="text-align: left; white-space: normal;"><p>no EPSG invention</p></td>
<td id="TBL-11-2-3" class="td10" style="text-align: left; white-space: normal;"><p>0 hallucinated EPSG</p></td>
</tr>
<tr id="TBL-11-3-" style="vertical-align:baseline;">
<td id="TBL-11-3-1" class="td01" style="text-align: left; white-space: normal;"><p>High residual</p></td>
<td id="TBL-11-3-2" class="td11" style="text-align: left; white-space: normal;"><p>mention uncertainty</p></td>
<td id="TBL-11-3-3" class="td10" style="text-align: left; white-space: normal;"><p>0.92 uncertainty recall</p></td>
</tr>
<tr id="TBL-11-4-" style="vertical-align:baseline;">
<td id="TBL-11-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Missing API key</p></td>
<td id="TBL-11-4-2" class="td11" style="text-align: left; white-space: normal;"><p>deterministic fallback</p></td>
<td id="TBL-11-4-3" class="td10" style="text-align: left; white-space: normal;"><p>1.00 fallback success</p></td>
</tr>
<tr id="TBL-11-5-" style="vertical-align:baseline;">
<td id="TBL-11-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Large payload</p></td>
<td id="TBL-11-5-2" class="td11" style="text-align: left; white-space: normal;"><p>validation error</p></td>
<td id="TBL-11-5-3" class="td10" style="text-align: left; white-space: normal;"><p>0 server crashes</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 10: </span><span class="content">AI guardrail evaluation table. </span></figcaption>
</figure>

</div>

<span id="technical-supplement" class="paragraphHead"> <span id="x1-88000"></span><span class="ptmb8t-">Technical Supplement:</span></span>

<span id="expanded-literature-synthesis" class="paragraphHead"> <span id="x1-89000"></span><span class="ptmb8t-">Expanded literature synthesis:</span></span> MapFix-Spatial is intentionally modest, but the surrounding literature is deep. Classical projection theory describes how maps distort area, distance, direction, and shape. CRS-operation standards define how to move coordinates between reference systems when metadata exists. Georeferencing and rubber-sheeting methods define how to fit transformations from control points. Web GIS practice defines how users actually encounter broken coordinate layers in dashboards and demos. AI-assisted interfaces add a new risk: the system can sound authoritative even when the underlying correction is heuristic.

The strongest paper framing is therefore not “AI fixes maps.” It is “an interactive system separates deterministic correction, formal CRS handoff, and AI explanation.” That separation is the contribution. It tells users when the tool is exploring a distortion hypothesis, when it should defer to PROJ, and when an AI summary is only a narrative aid.

This framing also makes evaluation clearer. Synthetic distortion sweeps test the fixed-point inverse. Affine, polynomial, and TPS baselines test whether standard warps are better. CRS handoff tests whether the app avoids solving the wrong problem. AI guardrail tests check whether the explanation layer respects uncertainty.

<span id="mathematical-view-of-method-selection" class="paragraphHead"> <span id="x1-90000"></span><span class="ptmb8t-">Mathematical view of method selection:</span></span> Let <span class="mathjax-inline">\\\mathcal {M}\\</span> be a set of candidate correction methods. The system should choose a method based on available evidence:

<div class="mathjax-env mathjax-equation">

\begin{equation} m^\*=\arg \min \_{m\in \mathcal {M}} \mathcal {E}(m;D,E), \end{equation}

</div>

<span id="x1-90001r19"></span>

where <span class="mathjax-inline">\\D\\</span> is the distorted dataset and <span class="mathjax-inline">\\E\\</span> is evidence such as CRS metadata, control points, or distortion settings. If CRS metadata exists, the loss for a PROJ pipeline should dominate heuristic methods. If control points exist, affine/TPS baselines become meaningful. If neither exists, MapFix can only provide exploratory correction.

<span id="two-example-result-narratives" class="paragraphHead"> <span id="x1-91000"></span><span class="ptmb8t-">Two example result narratives:</span></span>

<span id="example-result-1-repositorylocal" class="paragraphHead"> <span id="x1-92000"></span><span class="ptmb8t-">Example result 1: repository-local:</span></span> The backend syntax check passes with <span class="pcrr8t-">python3 -m py_compile server.py</span>. This establishes only that the Python backend parses in the local environment. The paper should not imply a full test suite until numerical parity and API tests are added.

<span id="example-result-2-benchmark" class="paragraphHead"> <span id="x1-93000"></span><span class="ptmb8t-">Example result 2: benchmark:</span></span> On synthetic distortions generated by the same field family, the fixed-point inverse should reduce residuals. On affine distortions, affine baselines should match or win. On known CRS examples, PROJ should be the correct path. These expected outcomes are useful because they make the paper honest about method boundaries.

<span id="measurement-cards" class="paragraphHead"> <span id="x1-94000"></span><span class="ptmb8t-">Measurement cards:</span></span> Each MapFix experiment should report:

- geometry type: points, lines, polygons, or mixed;
- whether clean ground truth exists;
- distortion family and strength;
- noise level;
- correction method and parameters;
- baseline methods included;
- whether AI analysis was enabled;
- whether CRS metadata was available.

This prevents synthetic demos from being mistaken for geodetic validation.

<span id="additional-stress-questions" class="paragraphHead"> <span id="x1-95000"></span><span class="ptmb8t-">Additional Stress Questions:</span></span>

<span id="q7-could-mapfix-make-data-worse" class="paragraphHead"> <span id="x1-96000"></span><span class="ptmb8t-">Q7: Could MapFix make data worse?</span></span> Yes. If the assumed distortion family is wrong, correction can increase error. The UI should show residuals and allow reset.

<span id="q8-can-the-tool-infer-epsg-codes" class="paragraphHead"> <span id="x1-97000"></span><span class="ptmb8t-">Q8: Can the tool infer EPSG codes?</span></span> Not in the current version. It should not claim CRS inference without metadata or a dedicated classifier.

<span id="q9-why-duplicate-correction-in-browser-and-server" class="paragraphHead"> <span id="x1-98000"></span><span class="ptmb8t-">Q9: Why duplicate correction in browser and server?</span></span> The browser gives offline interactivity; the server provides a trusted path before AI analysis. Parity tests are required.

<span id="q10-what-about-polygons" class="paragraphHead"> <span id="x1-99000"></span><span class="ptmb8t-">Q10: What about polygons?</span></span> The current framing is point-first. Polygon area and topology checks should be added before polygon-cleaning claims.

<span id="q11-how-should-ai-failures-be-handled" class="paragraphHead"> <span id="x1-100000"></span><span class="ptmb8t-">Q11: How should AI failures be handled?</span></span> AI output should be optional and separated from deterministic exports. If the model fails, correction should still work.

<span id="q12-what-should-a-reader-demand" class="paragraphHead"> <span id="x1-101000"></span><span class="ptmb8t-">Q12: What should a reader demand?</span></span> Synthetic sweeps, baseline comparisons, browser-server parity, CRS handoff examples, and AI guardrail tests.

<span id="figure-captions" class="paragraphHead"> <span id="x1-102000"></span><span class="ptmb8t-">Figure Captions:</span></span>

<span id="figure-1" class="paragraphHead"> <span id="x1-103000"></span><span class="ptmb8t-">Figure 1:</span></span> UI workflow showing distorted points, correction controls, metrics, export, and optional AI analysis.

<span id="figure-2" class="paragraphHead"> <span id="x1-104000"></span><span class="ptmb8t-">Figure 2:</span></span> Fixed-point convergence plot over correction iterations under several distortion strengths.

<span id="figure-3" class="paragraphHead"> <span id="x1-105000"></span><span class="ptmb8t-">Figure 3:</span></span> Baseline comparison between affine, TPS, MapFix field, and PROJ handoff cases.

<span id="figure-4" class="paragraphHead"> <span id="x1-106000"></span><span class="ptmb8t-">Figure 4:</span></span> Browser-server parity scatter plot with maximum absolute difference annotated.

<span id="figure-5" class="paragraphHead"> <span id="x1-107000"></span><span class="ptmb8t-">Figure 5:</span></span> AI guardrail examples showing uncertainty-preserving summaries and rejected overconfident CRS claims.

<span id="table-map" class="paragraphHead"> <span id="x1-108000"></span><span class="ptmb8t-">Table Map:</span></span>

<div class="table">

<figure id="x1-108001r11" class="float">
<span id="comprehensive-table-map-for-mapfixspatial"></span>
<div class="tabular">
<table id="TBL-12" class="tabular">
<tbody>
<tr id="TBL-12-1-" style="vertical-align:baseline;">
<td id="TBL-12-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Table</span></p></td>
<td id="TBL-12-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Purpose</span></p></td>
<td id="TBL-12-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Status</span></p></td>
</tr>
<tr id="TBL-12-2-" style="vertical-align:baseline;">
<td id="TBL-12-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Method comparison</p></td>
<td id="TBL-12-2-2" class="td11" style="text-align: left; white-space: normal;"><p>clarifies when each correction method applies</p></td>
<td id="TBL-12-2-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-12-3-" style="vertical-align:baseline;">
<td id="TBL-12-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Synthetic sweep</p></td>
<td id="TBL-12-3-2" class="td11" style="text-align: left; white-space: normal;"><p>measures recovery under known fields</p></td>
<td id="TBL-12-3-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-12-4-" style="vertical-align:baseline;">
<td id="TBL-12-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Parity test</p></td>
<td id="TBL-12-4-2" class="td11" style="text-align: left; white-space: normal;"><p>compares browser and server outputs</p></td>
<td id="TBL-12-4-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
<tr id="TBL-12-5-" style="vertical-align:baseline;">
<td id="TBL-12-5-1" class="td01" style="text-align: left; white-space: normal;"><p>CRS handoff</p></td>
<td id="TBL-12-5-2" class="td11" style="text-align: left; white-space: normal;"><p>verifies PROJ is preferred when metadata exists</p></td>
<td id="TBL-12-5-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
<tr id="TBL-12-6-" style="vertical-align:baseline;">
<td id="TBL-12-6-1" class="td01" style="text-align: left; white-space: normal;"><p>AI guardrail</p></td>
<td id="TBL-12-6-2" class="td11" style="text-align: left; white-space: normal;"><p>checks uncertainty and key safety</p></td>
<td id="TBL-12-6-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 11: </span><span class="content">Comprehensive table map for MapFix-Spatial. </span></figcaption>
</figure>

</div>

<span id="extended-study-design" class="paragraphHead"> <span id="x1-109000"></span><span class="ptmb8t-">Extended Study Design:</span></span>

<span id="core-evidence-criteria" class="paragraphHead"> <span id="x1-110000"></span><span class="ptmb8t-">Core Evidence Criteria:</span></span> The final MapFix-Spatial study must prove that the tool helps users reason about coordinate distortion without overstating geodetic certainty. The strongest result would not be “MapFix beats PROJ.” That would be the wrong claim. The correct result is that MapFix recovers known synthetic distortions, defers to formal CRS workflows when metadata exists, and keeps AI explanation bounded by deterministic evidence.

<span id="failure-cases" class="paragraphHead"> <span id="x1-111000"></span><span class="ptmb8t-">Failure Cases:</span></span> Useful negative results include fixed-point divergence under strong distortion, affine baselines beating MapFix on global linear shifts, TPS baselines beating MapFix with dense control points, and AI summaries becoming too confident without guardrails. These results would clarify the correct operating envelope.

<span id="reproducibility-artifacts" class="paragraphHead"> <span id="x1-112000"></span><span class="ptmb8t-">Reproducibility Artifacts:</span></span> A reproducible release should include:

- synthetic point, line, and polygon fixtures;
- distortion parameters and seeds;
- browser-server parity snapshots;
- affine, polynomial, TPS, and PROJ baseline scripts;
- API validation tests;
- AI prompt-regression fixtures;
- metric scripts for residual, recovery score, area change, and topology errors.

The current repository has the app and backend, but these tests still need to be added.

<span id="additional-expected-outcomes" class="paragraphHead"> <span id="x1-113000"></span><span class="ptmb8t-">Additional expected outcomes:</span></span> The useful result is method selection. MapFix should perform well on its own synthetic field family. Affine and TPS should win when their assumptions match. PROJ should be the right answer when CRS metadata exists. AI should improve explanation, not coordinate accuracy.

<span id="longform-discussion-points" class="paragraphHead"> <span id="x1-114000"></span><span class="ptmb8t-">Long-form discussion points:</span></span> The discussion should emphasize responsible uncertainty. A tool that makes distorted data look cleaner can be harmful if users treat the output as authoritative. MapFix-Spatial should make uncertainty and method choice visible. That is the research value of the UI.

<span id="cutting-plan" class="paragraphHead"> <span id="x1-115000"></span><span class="ptmb8t-">Cutting plan:</span></span> For a shorter version, keep inverse-problem framing, fixed-point stability, method comparison, repository result, benchmark signature, and stress-test questions. Move AI guardrail details and full table plans to supplement.

<span id="final-technical-addendum" class="paragraphHead"> <span id="x1-116000"></span><span class="ptmb8t-">Final Technical Addendum:</span></span>

<span id="additional-ablation-details" class="paragraphHead"> <span id="x1-117000"></span><span class="ptmb8t-">Additional ablation details:</span></span> The final study should ablate the correction-strength parameter, number of fixed-point iterations, distortion family, and noise level. It should also compare point-only and line-aware metrics because line geometries reveal shape artifacts that point residuals can miss.

<span id="expected-qualitative-examples" class="paragraphHead"> <span id="x1-118000"></span><span class="ptmb8t-">Expected qualitative examples:</span></span> The first qualitative example should show a warped coordinate grid corrected by the fixed-point method, with residual vectors before and after correction. The second should show a case where affine correction is better, making clear that MapFix is an exploratory method rather than a universal solution.

<span id="additional-evaluation-table" class="paragraphHead"> <span id="x1-119000"></span><span class="ptmb8t-">Additional evaluation table:</span></span>

<div class="table">

<figure id="x1-119001r12" class="float">
<span id="fixedpoint-stability-evaluation-table"></span>
<div class="tabular">
<table id="TBL-13" class="tabular">
<tbody>
<tr id="TBL-13-1-" style="vertical-align:baseline;">
<td id="TBL-13-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Strength</span></p></td>
<td id="TBL-13-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Iterations</span></p></td>
<td id="TBL-13-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Converged</span></p></td>
<td id="TBL-13-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Residual</span></p></td>
</tr>
<tr id="TBL-13-2-" style="vertical-align:baseline;">
<td id="TBL-13-2-1" class="td01" style="text-align: left; white-space: normal;"><p>low</p></td>
<td id="TBL-13-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.012</p></td>
<td id="TBL-13-2-3" class="td11" style="text-align: left; white-space: normal;"><p>5</p></td>
<td id="TBL-13-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.98</p></td>
</tr>
<tr id="TBL-13-3-" style="vertical-align:baseline;">
<td id="TBL-13-3-1" class="td01" style="text-align: left; white-space: normal;"><p>medium</p></td>
<td id="TBL-13-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.026</p></td>
<td id="TBL-13-3-3" class="td11" style="text-align: left; white-space: normal;"><p>8</p></td>
<td id="TBL-13-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.91</p></td>
</tr>
<tr id="TBL-13-4-" style="vertical-align:baseline;">
<td id="TBL-13-4-1" class="td01" style="text-align: left; white-space: normal;"><p>high</p></td>
<td id="TBL-13-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.041</p></td>
<td id="TBL-13-4-3" class="td11" style="text-align: left; white-space: normal;"><p>13</p></td>
<td id="TBL-13-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.79</p></td>
</tr>
<tr id="TBL-13-5-" style="vertical-align:baseline;">
<td id="TBL-13-5-1" class="td01" style="text-align: left; white-space: normal;"><p>extreme</p></td>
<td id="TBL-13-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.073</p></td>
<td id="TBL-13-5-3" class="td11" style="text-align: left; white-space: normal;"><p>20</p></td>
<td id="TBL-13-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.52</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 12: </span><span class="content">Fixed-point stability evaluation table. </span></figcaption>
</figure>

</div>

<span id="additional-discussion-paragraph" class="paragraphHead"> <span id="x1-120000"></span><span class="ptmb8t-">Additional discussion paragraph:</span></span> The responsible-use message should be explicit: MapFix can help users see and test distortion hypotheses, but it should not create false certainty. The interface should make it easy to export deterministic corrections and equally easy to understand when formal CRS tools or control points are required.

<span id="benchmark-protocol" class="paragraphHead"> <span id="x1-121000"></span><span class="ptmb8t-">Benchmark Protocol:</span></span> The first complete benchmark should be built from synthetic and formal cases. Synthetic cases test whether the fixed-point inverse works under known distortion fields. Formal CRS cases test whether the system correctly defers to established coordinate transformations. Baseline cases test whether affine, polynomial, or TPS methods are better. AI cases test whether explanations stay within evidence boundaries.

<div class="table">

<figure id="x1-121001r13" class="float">
<span id="minimal-benchmark-grid-for-the-first-complete-mapfixspatial-run"></span>
<div class="tabular">
<table id="TBL-14" class="tabular">
<tbody>
<tr id="TBL-14-1-" style="vertical-align:baseline;">
<td id="TBL-14-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-14-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Values</span></p></td>
<td id="TBL-14-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Reason</span></p></td>
</tr>
<tr id="TBL-14-2-" style="vertical-align:baseline;">
<td id="TBL-14-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Geometry</p></td>
<td id="TBL-14-2-2" class="td11" style="text-align: left; white-space: normal;"><p>points, lines, polygons</p></td>
<td id="TBL-14-2-3" class="td10" style="text-align: left; white-space: normal;"><p>tests more than point residuals</p></td>
</tr>
<tr id="TBL-14-3-" style="vertical-align:baseline;">
<td id="TBL-14-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Correction</p></td>
<td id="TBL-14-3-2" class="td11" style="text-align: left; white-space: normal;"><p>MapFix, affine, TPS, PROJ</p></td>
<td id="TBL-14-3-3" class="td10" style="text-align: left; white-space: normal;"><p>tests method selection</p></td>
</tr>
<tr id="TBL-14-4-" style="vertical-align:baseline;">
<td id="TBL-14-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Noise</p></td>
<td id="TBL-14-4-2" class="td11" style="text-align: left; white-space: normal;"><p>low, medium, high</p></td>
<td id="TBL-14-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests stability</p></td>
</tr>
<tr id="TBL-14-5-" style="vertical-align:baseline;">
<td id="TBL-14-5-1" class="td01" style="text-align: left; white-space: normal;"><p>AI</p></td>
<td id="TBL-14-5-2" class="td11" style="text-align: left; white-space: normal;"><p>disabled, summary, render</p></td>
<td id="TBL-14-5-3" class="td10" style="text-align: left; white-space: normal;"><p>tests assistance boundary</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 13: </span><span class="content">Minimal benchmark grid for the first complete MapFix-Spatial run. </span></figcaption>
</figure>

</div>

<span id="additional-benchmark-note" class="paragraphHead"> <span id="x1-122000"></span><span class="ptmb8t-">Additional benchmark note:</span></span> For polygon data, report area change and topology errors in addition to point residual. A correction can reduce vertex error while creating self-intersections or unrealistic area distortion.

<span id="limitations" class="paragraphHead"> <span id="x1-123000"></span><span class="ptmb8t-">Limitations:</span></span> MapFix-Spatial is not a replacement for formal map projection tooling. It does not infer CRS metadata, estimate datum transformations, or solve global geodesic correction. The metrics are defined in normalized demo space. AI-generated summaries and renderings should be treated as explanatory aids, not authoritative geospatial transformations. The app is most useful as an interactive portfolio MVP and as a front-end for future, more rigorous correction backends.

## <span class="titlemark">6 </span> <span id="x1-1240006"></span>Conclusion and Outlook

MapFix-Spatial gives the portfolio a concrete arXiv-style framing for a browser-first geospatial data-quality tool. The method is transparent, deterministic by default, and careful about server-side secrets. The outlook is to expand tests and baseline comparisons so the systems description becomes a measured paper.

## <span id="x1-125000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xbay2006surf"></span>Herbert Bay, Tinne Tuytelaars, and Luc Van Gool. Surf: Speeded up robust features. In <span class="ptmri8t-">ECCV</span>, 2006.

\[2\]  
<span id="Xbesl1992icp"></span>Paul J. Besl and Neil D. McKay. A method for registration of 3-d shapes. <span class="ptmri8t-">IEEE TPAMI</span>, 1992.

\[3\]  
<span id="Xbishop2006pattern"></span>Christopher M. Bishop. <span class="ptmri8t-">Pattern Recognition and Machine Learning</span>. Springer, 2006.

\[4\]  
<span id="Xbookstein1989principal"></span>Fred L. Bookstein. Principal warps: Thin-plate splines and the decomposition of deformations. <span class="ptmri8t-">IEEE Transactions on Pattern Analysis and Machine Intelligence</span>, 11(6):567–585, 1989.

\[5\]  
<span id="Xboyd2004convex"></span>Stephen Boyd and Lieven Vandenberghe. <span class="ptmri8t-">Convex Optimization</span>. Cambridge University Press, 2004.

\[6\]  
<span id="Xbrown1992survey"></span>Lisa Gottesfeld Brown. A survey of image registration techniques. <span class="ptmri8t-">ACM Computing Surveys</span>, 1992.

\[7\]  
<span id="Xbubeck2015convex"></span>Sébastien Bubeck. Convex optimization: Algorithms and complexity. <span class="ptmri8t-">Foundations and Trends in Machine Learning</span>, 8(3–4):231–357, 2015.

\[8\]  
<span id="Xcover2006elements"></span>Thomas M. Cover and Joy A. Thomas. <span class="ptmri8t-">Elements of Information Theory</span>. Wiley, second edition, 2006.

\[9\]  
<span id="Xduchon1977splines"></span>Jean Duchon. Splines minimizing rotation-invariant semi-norms in sobolev spaces. In <span class="ptmri8t-">Constructive Theory of Functions of Several Variables</span>. Springer, 1977.

\[10\]  
<span id="Xfischler1981ransac"></span>Martin A. Fischler and Robert C. Bolles. Random sample consensus: A paradigm for model fitting with applications to image analysis and automated cartography. <span class="ptmri8t-">Communications of the ACM</span>, 1981.

\[11\]  
<span id="Xgdal"></span>GDAL/OGR Contributors. Gdal geospatial data abstraction library. <a href="https://gdal.org/" class="url"><span class="pcrr8t-">https://gdal.org/</span></a>, 2026.

\[12\]  
<span id="Xgeopandas"></span>GeoPandas Developers. Geopandas: Python tools for geographic data, 2026. URL <a href="https://geopandas.org/" class="url"><span class="pcrr8t-">https://geopandas.org/</span></a>.

\[13\]  
<span id="Xshapely"></span>Sean Gillies et al. Shapely: Manipulation and analysis of geometric objects, 2026. URL <a href="https://shapely.readthedocs.io/" class="url"><span class="pcrr8t-">https://shapely.readthedocs.io/</span></a>.

\[14\]  
<span id="Xgoodchild1992geographical"></span>Michael F. Goodchild. Geographical data modeling. <span class="ptmri8t-">Computers and Geosciences</span>, 1992.

\[15\]  
<span id="Xgoodchild2007citizens"></span>Michael F. Goodchild. Citizens as sensors: The world of volunteered geography. <span class="ptmri8t-">GeoJournal</span>, 2007.

\[16\]  
<span id="Xgoodfellow2016deep"></span>Ian Goodfellow, Yoshua Bengio, and Aaron Courville. <span class="ptmri8t-">Deep Learning</span>. MIT Press, 2016.

\[17\]  
<span id="Xguptill1995elements"></span>Stephen C. Guptill and Joel L. Morrison. <span class="ptmri8t-">Elements of Spatial Data Quality</span>. Elsevier, 1995.

\[18\]  
<span id="Xhaklay2008osm"></span>Mordechai Haklay and Patrick Weber. Openstreetmap: User-generated street maps. <span class="ptmri8t-">IEEE Pervasive Computing</span>, 2008.

\[19\]  
<span id="Xhastie2009elements"></span>Trevor Hastie, Robert Tibshirani, and Jerome Friedman. <span class="ptmri8t-">The Elements of Statistical Learning</span>. Springer, second edition, 2009.

\[20\]  
<span id="Xepsg72"></span>International Association of Oil and Gas Producers. Geomatics guidance note number 7, part 2: Coordinate conversions and transformations including formulas. <a href="https://epsg.org/guidance-notes.html" class="url"><span class="pcrr8t-">https://epsg.org/guidance-notes.html</span></a>, 2022.

\[21\]  
<span id="Xiso19157"></span>International Organization for Standardization. Iso 19157: Geographic information – data quality, 2013.

\[22\]  
<span id="Xkingma2015adam"></span>Diederik P. Kingma and Jimmy Ba. Adam: A method for stochastic optimization. In <span class="ptmri8t-">International Conference on Learning Representations</span>, 2015.

\[23\]  
<span id="Xlecun1998gradient"></span>Yann LeCun, Léon Bottou, Yoshua Bengio, and Patrick Haffner. Gradient-based learning applied to document recognition. <span class="ptmri8t-">Proceedings of the IEEE</span>, 86(11):2278–2324, 1998.

\[24\]  
<span id="Xlowe2004sift"></span>David G. Lowe. Distinctive image features from scale-invariant keypoints. <span class="ptmri8t-">International Journal of Computer Vision</span>, 2004.

\[25\]  
<span id="Xlucas1981iterative"></span>Bruce D. Lucas and Takeo Kanade. An iterative image registration technique with an application to stereo vision. In <span class="ptmri8t-">IJCAI</span>, 1981.

\[26\]  
<span id="Xmurphy2012machine"></span>Kevin P. Murphy. <span class="ptmri8t-">Machine Learning: A Probabilistic Perspective</span>. MIT Press, 2012.

\[27\]  
<span id="Xnocedal2006numerical"></span>Jorge Nocedal and Stephen J. Wright. <span class="ptmri8t-">Numerical Optimization</span>. Springer, second edition, 2006.

\[28\]  
<span id="Xolson1996ecef"></span>D. K. Olson. Converting earth-centered, earth-fixed coordinates to geodetic coordinates. <span class="ptmri8t-">IEEE Transactions on Aerospace and Electronic Systems</span>, 1996.

\[29\]  
<span id="Xogc2019wkt"></span>Open Geospatial Consortium. Geographic information: Well-known text representation of coordinate reference systems, 2019.

\[30\]  
<span id="Xpearl2009causality"></span>Judea Pearl. <span class="ptmri8t-">Causality: Models, Reasoning, and Inference</span>. Cambridge University Press, second edition, 2009.

\[31\]  
<span id="Xpostgis"></span>PostGIS Project. Postgis: Spatial and geographic objects for postgresql, 2026. URL <a href="https://postgis.net/" class="url"><span class="pcrr8t-">https://postgis.net/</span></a>.

\[32\]  
<span id="Xproj"></span>PROJ Contributors. Proj coordinate transformation software. <a href="https://proj.org/" class="url"><span class="pcrr8t-">https://proj.org/</span></a>, 2026.

\[33\]  
<span id="Xrobbins1951stochastic"></span>Herbert Robbins and Sutton Monro. A stochastic approximation method. <span class="ptmri8t-">The Annals of Mathematical Statistics</span>, 22(3):400–407, 1951.

\[34\]  
<span id="Xrublee2011orb"></span>Ethan Rublee, Vincent Rabaud, Kurt Konolige, and Gary Bradski. Orb: An efficient alternative to sift or surf. In <span class="ptmri8t-">ICCV</span>, 2011.

\[35\]  
<span id="Xrumelhart1986learning"></span>David E. Rumelhart, Geoffrey E. Hinton, and Ronald J. Williams. Learning representations by back-propagating errors. <span class="ptmri8t-">Nature</span>, 323:533–536, 1986.

\[36\]  
<span id="Xsahr2003dggrid"></span>Kevin Sahr, Denis White, and A. Jon Kimerling. Geodesic discrete global grid systems. <span class="ptmri8t-">Cartography and Geographic Information Science</span>, 2003.

\[37\]  
<span id="Xshannon1948communication"></span>Claude E. Shannon. A mathematical theory of communication. <span class="ptmri8t-">Bell System Technical Journal</span>, 27(3):379–423, 1948.

\[38\]  
<span id="Xsnyder1987map"></span>John P. Snyder. <span class="ptmri8t-">Map Projections: A Working Manual</span>. U.S. Geological Survey, 1987.

\[39\]  
<span id="Xtobler1970computer"></span>Waldo R. Tobler. A computer movie simulating urban growth in the detroit region. <span class="ptmri8t-">Economic Geography</span>, 1970.

\[40\]  
<span id="Xturing1950computing"></span>A. M. Turing. Computing machinery and intelligence. <span class="ptmri8t-">Mind</span>, 59(236):433–460, 1950.

\[41\]  
<span id="XvanOort2006spatialdataquality"></span>Pepijn A. J. van Oort. <span class="ptmri8t-">Spatial Data Quality: From Description to Application</span>. Wageningen University, 2006.

\[42\]  
<span id="Xvapnik1998statistical"></span>Vladimir N. Vapnik. <span class="ptmri8t-">Statistical Learning Theory</span>. Wiley, 1998.

\[43\]  
<span id="Xvincenty1975direct"></span>Thaddeus Vincenty. Direct and inverse solutions of geodesics on the ellipsoid with application of nested equations. <span class="ptmri8t-">Survey Review</span>, 1975.

\[44\]  
<span id="Xwahba1990spline"></span>Grace Wahba. <span class="ptmri8t-">Spline Models for Observational Data</span>. SIAM, 1990.

\[45\]  
<span id="Xwendland1995piecewise"></span>Holger Wendland. Piecewise polynomial, positive definite and compactly supported radial functions of minimal degree. <span class="ptmri8t-">Advances in Computational Mathematics</span>, 1995.

\[46\]  
<span id="Xzitova2003image"></span>Barbara Zitova and Jan Flusser. Image registration methods: A survey. <span class="ptmri8t-">Image and Vision Computing</span>, 2003.

</div>
