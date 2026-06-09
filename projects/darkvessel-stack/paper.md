# DarkVesselNet: Multi-Modal Remote Sensing and Trajectory Reasoning for Dark Vessel Detection

Arun Sharma, University of Minnesota, Twin Cities

_In preparation. Target: CVPR EarthVision 2027; xView3-SAR benchmark_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> Dark vessel detection requires fusing what vessels report through AIS with what satellites observe through radar and optical sensors. DarkVesselNet is a multi-modal remote-sensing stack that combines Sentinel-1 SAR, Sentinel-2 optical imagery, geospatial foundation-model backbones, AIS trajectory reasoning, TGARD-style gap detection, and a Pi-DPM-inspired anomaly head. The repository exposes the system as a tested Python package and a public Hugging Face Space. The paper presents the sensor stack, backbone abstraction, fusion path, anomaly head, and current validation. The evidence currently available is software-grounded: tests for SAR speckle filtering, optical band ratios, Haversine distance, TGARD gap emission, sensor coregistration, backbone token shapes, and differentiable anomaly scoring.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Maritime domain awareness depends on the ability to detect vessels that stop broadcasting, spoof their location, or operate in regions where self-reported AIS data is unreliable. A dark-vessel detector must therefore combine multiple evidence channels: SAR returns that work day and night, optical imagery that helps classify vessel structure, trajectory history that reveals gaps or rendezvous, and contextual knowledge such as coastlines or port activity.

DarkVesselNet is a portfolio-scale implementation of that stack. It is not just a single classifier. It is a reference architecture for taking an area of interest, ingesting remote-sensing and AIS evidence, encoding imagery through swappable geospatial foundation models, and producing a candidate dark-vessel probability with a reasoning trace. The repository also connects the author’s trajectory anomaly line of work with modern Earth-observation foundation models.

This paper is precise about evidence. The public Space demonstrates the workflow in CPU-safe implementation mode, and the repository includes tests for core operators. The xView3-style benchmark protocol is reported as the main external evaluation path.

<span id="contributions" class="paragraphHead"> <span id="x1-2000"></span><span class="ptmb8t-">Contributions:</span></span>

1\.  
A unified dark-vessel architecture spanning SAR, optical, AIS, and geospatial foundation-model tokens.

2\.  
A common <span class="pcrr8t-">GeoBackbone </span>adapter over Prithvi-2, Clay, SatMAE++, DOFA, SatlasNet, and RemoteCLIP-style backbones.

3\.  
A trajectory reasoning path combining TGARD gap detection and a Pi-DPM-inspired reconstruction and anomaly head.

4\.  
A reproducible project implementation with math tests, Space tests, and deployment-ready Hugging Face metadata.

<figure class="figure">
<p><img src="figures/main-c732a7f5fd2c26258ced552b8840094b.svg" loading="lazy" alt="Figure" /> <span id="x1-2005r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Detailed DarkVesselNet architecture. The figure separates raw evidence, modality-specific encoders, availability-gated attention, alert decoding, and evaluation heads. The decoder is deliberately trace-producing: it should expose sensor availability, AIS matching, anomaly evidence, and uncertainty rather than emit only one probability. </span></figcaption>
</figure>

<span id="scope" class="paragraphHead"> <span id="x1-3000"></span><span class="ptmb8t-">Scope:</span></span> Dark-vessel detection is best understood as a disagreement problem. AIS provides a cooperative self-report. SAR provides all-weather physical observation. Optical imagery provides interpretable visual context when available. Trajectory reasoning provides temporal structure. A candidate becomes operationally interesting when these evidence streams disagree in a way that cannot be explained by ordinary coverage, timing, or context.

This framing is stricter than saying the system detects illegal fishing. A model can detect an unmatched SAR object, an AIS gap, a suspicious rendezvous pattern, or a weakly explained trajectory. It cannot infer legal status by itself. That distinction should be visible throughout the paper because remote-sensing evidence can affect people, vessels, and enforcement decisions. The system should be framed as triage and analyst support.

The technical challenge is that each modality has different missingness. SAR can observe through clouds but has speckle and coastal clutter. Optical imagery is human-readable but unavailable at night and unreliable under clouds. AIS is semantically rich but cooperative and incomplete. Foundation-model tokens can help reuse pretraining, but they do not eliminate sensor-specific error. DarkVesselNet’s architecture is therefore modular: encode each evidence channel, preserve availability masks, and fuse them with traceable output.

The expanded paper turns the project into a research paper structure by adding an evidence taxonomy, matching policy, calibration discussion, backbone comparison protocol, stress tests, and implementation-grounded results. These sections are necessary because dark-vessel detection papers are easy to overstate. The credible claim is evidence fusion under uncertainty, not automatic attribution of intent.

<span id="expanded-contributions" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Expanded contributions:</span></span> The paper contributes a systems formulation for multi-modal dark-vessel alerts, a foundation-backbone adapter design, an AIS/SAR matching policy outline, a calibration protocol, and a human-review trace schema. The codebase currently validates the operators and interfaces that support this framing.

## <span class="titlemark">2 </span> <span id="x1-50002"></span>Related Work

<span id="expanded-citation-map" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Expanded Citation Map:</span></span> The expanded related work now treats DarkVesselNet as a remote-sensing detection, foundation-model, trajectory-reasoning, and auditable-fusion system. xView3, Global Fishing Watch, HRSID, SSDD-style SAR detection, and AIS anomaly studies define the maritime evidence layer \[[15](#Xkroodsma2018tracking), [23](#Xnguyen2020geotracknet), [25](#Xpallotta2013vessel), [26](#Xpaolo2022xview3), [32](#Xristic2008maritime), [37](#Xsharma2022tist), [42](#Xwei2020hrsid), [44](#Xzhang2019ssdd)\]. Faster R-CNN, YOLO, focal loss, DETR, Deformable DETR, ResNet, ViT, Swin, FCN, U-Net, DeepLab, and Mask2Former provide the generic detection and segmentation lineage \[[4](#Xcarion2020detr)–[6](#Xcheng2022mask2former), [9](#Xdosovitskiy2021vit), [12](#Xhe2016resnet), [18](#Xlin2017focal), [20](#Xliu2021swin), [21](#Xlong2015fcn), [30](#Xredmon2016yolo), [31](#Xren2015fasterrcnn), [34](#Xronneberger2015unet), [46](#Xzhu2021deformabledetr)\]. CLIP, SAM, SAM 2, SatMAE, DOFA, RemoteCLIP, and SatlasPretrain motivate reusable geospatial encoders and promptable visual evidence \[[7](#Xcong2022satmae), [14](#Xkirillov2023segment), [19](#Xliu2024remoteclip), [28](#Xradford2021clip), [29](#Xravi2024sam2), [38](#Xtseng2023satlas), [43](#Xxiong2024dofa)\].

<span id="maritime-remote-sensing" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Maritime remote sensing:</span></span> SAR is central to vessel detection because it works at night and through cloud. Public challenges such as xView3 formalized global SAR vessel detection with close-to-shore and length-estimation components \[[26](#Xpaolo2022xview3)\]. Global Fishing Watch showed how AIS can quantify industrial fishing patterns at planetary scale while also exposing the limitations of self-reported vessel broadcasts \[[15](#Xkroodsma2018tracking)\]. Optical imagery complements SAR by supplying interpretable vessel appearance and context.

<span id="earthobservation-foundation-models" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Earth-observation foundation models:</span></span> Recent geospatial foundation models, including Prithvi, Clay, SatMAE, DOFA, Satlas, and RemoteCLIP-style encoders, make it possible to reuse large-scale pretraining across tasks and modalities \[[7](#Xcong2022satmae), [19](#Xliu2024remoteclip), [43](#Xxiong2024dofa)\]. DarkVesselNet wraps these models behind a common token interface.

<span id="trajectory-anomaly-detection" class="paragraphHead"> <span id="x1-9000"></span><span class="ptmb8t-">Trajectory anomaly detection:</span></span> AIS gaps and rendezvous patterns are spatiotemporal events. TGARD-style reasoning uses distance, dwell, and feasible movement envelopes to surface suspicious co-location or disappearance events. Pi-DPM-style reconstruction extends this by scoring whether a missing segment is physically plausible. SAR-specific review and dataset literature also helps separate dataset limitations, speckle behavior, near-shore clutter, and deep detector trends from the fusion contribution \[[17](#Xli2017ssdd), [41](#Xwang2019sarship), [45](#Xzhang2022sarshipreview)\].

<span id="literature-synthesis" class="paragraphHead"> <span id="x1-10000"></span><span class="ptmb8t-">Literature synthesis:</span></span> The dark-vessel literature is best read as three partially overlapping threads rather than one detector lineage. The first thread is SAR object detection, where xView3, HRSID, SSDD, and modern detector families define how small bright targets are localized under speckle, incidence-angle variation, and coastal clutter \[[4](#Xcarion2020detr), [17](#Xli2017ssdd), [26](#Xpaolo2022xview3), [41](#Xwang2019sarship), [42](#Xwei2020hrsid), [46](#Xzhu2021deformabledetr)\]. The second thread is maritime trajectory analysis, where AIS gaps, anomalous routes, rendezvous behavior, and motion consistency are modeled as temporal evidence rather than image evidence \[[23](#Xnguyen2020geotracknet), [25](#Xpallotta2013vessel), [32](#Xristic2008maritime), [37](#Xsharma2022tist)\]. The third thread is Earth-observation representation learning, where SatMAE, DOFA, RemoteCLIP, and segmentation backbones provide reusable visual features but do not remove the need for sensor-specific validation \[[6](#Xcheng2022mask2former), [7](#Xcong2022satmae), [19](#Xliu2024remoteclip), [34](#Xronneberger2015unet), [43](#Xxiong2024dofa)\].

These threads impose different error models. SAR detectors confuse ships, wakes, buoys, platforms, and shore infrastructure. AIS models confuse non-broadcasting, poorly covered, delayed, and deliberately disabled tracks. Foundation backbones may improve feature quality but can hide modality mismatch when optical pretraining is applied to radar. DarkVesselNet therefore uses multi-modal fusion as an evidence-accounting problem. The model is useful when each alert can be traced back to sensor availability, AIS association, trajectory context, and calibrated uncertainty, not merely when a single aggregate detector score increases.

Recent literature also clarifies the role of human review. Operational maritime monitoring is not a pure classification task because an unmatched SAR candidate is not equivalent to illegal fishing. The strongest papers in this area separate observable sensor events from legal or policy interpretation. DarkVesselNet follows that convention by treating the output as a prioritized review queue with evidence traces. This positioning makes the system comparable to xView3-style detection work while preserving the caution required for real maritime use.

<span id="foundational-reference-anchors" class="paragraphHead"> <span id="x1-11000"></span><span class="ptmb8t-">Foundational reference anchors:</span></span> The bibliography also anchors the project-specific contribution in older and broader technical foundations: statistical learning and pattern recognition, deep learning, information theory, convex and numerical optimization, stochastic approximation, adaptive gradient methods, causality, and early AI framing \[[1](#Xbishop2006pattern)–[3](#Xbubeck2015convex), [8](#Xcover2006elements), [10](#Xgoodfellow2016deep), [11](#Xhastie2009elements), [13](#Xkingma2015adam), [16](#Xlecun1998gradient), [22](#Xmurphy2012machine), [24](#Xnocedal2006numerical), [27](#Xpearl2009causality), [33](#Xrobbins1951stochastic), [35](#Xrumelhart1986learning), [36](#Xshannon1948communication), [39](#Xturing1950computing), [40](#Xvapnik1998statistical)\]. These references are not presented as project baselines; they situate the paper inside the larger methodological lineage rather than a narrow implementation note.

## <span class="titlemark">3 </span> <span id="x1-120003"></span>Method and Architecture

The intended pipeline is:

1\.  
Search an area of interest for Sentinel-1 and Sentinel-2 scenes.

2\.  
Preprocess SAR and optical imagery, including speckle reduction, cloud masking, band ratios, and sensor coregistration.

3\.  
Encode image chips through a selected geospatial foundation model.

4\.  
Join candidate vessel evidence with AIS trajectory windows.

5\.  
Detect suspicious gaps or rendezvous candidates.

6\.  
Score the candidate with an anomaly head and return a probability plus trace.

The Hugging Face Space exposes the user-facing contract: choose an AOI and receive a textual pipeline trace and probability. The public path is implemented to avoid heavyweight downloads.

<span id="method" class="paragraphHead"> <span id="x1-13000"></span><span class="ptmb8t-">Method:</span></span>

<span id="sensor-preprocessing" class="paragraphHead"> <span id="x1-14000"></span><span class="ptmb8t-">Sensor preprocessing:</span></span> The SAR path includes Lee filtering for speckle reduction. For a local window, the Lee filter estimates local statistics and shrinks noisy pixels toward the local mean. The tests verify idempotence on constant imagery and reduced variance on synthetic speckle. The optical path includes cloud masking and band-ratio features:

<div class="mathjax-env mathjax-equation">

\begin{equation} \text {NDVI}=\frac {\text {NIR}-\text {red}}{\text {NIR}+\text {red}+\epsilon }, \quad \text {NDWI}=\frac {\text {green}-\text {NIR}}{\text {green}+\text {NIR}+\epsilon }. \end{equation}

</div>

<span id="x1-14001r1"></span>

These features provide interpretable context for water, land, and vessel-like structures.

<span id="geospatial-foundation-backbone" class="paragraphHead"> <span id="x1-15000"></span><span class="ptmb8t-">Geospatial foundation backbone:</span></span> The <span class="pcrr8t-">GeoBackbone </span>adapter returns patch tokens with shape <span class="mathjax-inline">\\(B,N,D)\\</span> regardless of the underlying model. Each supported backbone has metadata for patch size, embedding dimension, expected bands, Hugging Face model identifier, and license. In CPU tests, a lightweight fallback projection mimics token output without downloading model weights. This keeps downstream fusion heads testable.

<span id="ais-trajectory-reasoning" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">AIS trajectory reasoning:</span></span> AIS windows are represented as sequences <span class="mathjax-inline">\\(t,\phi ,\lambda ,\text {sog},\text {cog})\\</span>. The TGARD component flags long or infeasible gaps by checking time duration and required movement. The Haversine distance is used for geodesic distance:

<div class="mathjax-env mathjax-equation">

\begin{equation} d = 2R\arcsin \sqrt {\sin ^2(\Delta \phi /2)+\cos \phi \_1\cos \phi \_2\sin ^2(\Delta \lambda /2)}. \end{equation}

</div>

<span id="x1-16001r2"></span>

The current implementation tests the zero-distance case, a one-degree latitude sanity check, and a synthetic gap emission case.

<span id="anomaly-head" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Anomaly head:</span></span> The Pi-DPM-inspired anomaly head takes scene tokens and an AIS segment. Scene tokens are pooled and projected; AIS points are passed through an MLP and pooled. The fused representation predicts both a logit and a reconstructed AIS segment:

<div class="mathjax-env mathjax-equation">

\begin{equation} h = f\_{\theta }\left (\[\text {pool}(E\_{\text {scene}}), \text {pool}(E\_{\text {AIS}})\]\right ), \quad y = W_s h,\quad \hat {\tau }=W_r h. \end{equation}

</div>

<span id="x1-17001r3"></span>

This is a lightweight inference-time head, not a full diffusion sampler. It is designed to be replaced or extended by a full Pi-DPM checkpoint when available.

<span id="implementation" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Implementation:</span></span> The current repository includes:

- <span class="pcrr8t-">darkvessel.sar</span>: SAR filtering operators.
- <span class="pcrr8t-">darkvessel.optical</span>: cloud and band-ratio utilities.
- <span class="pcrr8t-">darkvessel.fusion</span>: sensor coregistration implementations.
- <span class="pcrr8t-">darkvessel.backbones</span>: foundation-model adapter.
- <span class="pcrr8t-">darkvessel.ais</span>: trajectory gap and rendezvous reasoning.
- <span class="pcrr8t-">darkvessel.heads</span>: anomaly scoring and reconstruction head.

## <span class="titlemark">4 </span> <span id="x1-190004"></span>Evaluation

<div class="table">

<figure id="x1-19001r1" class="float">
<span id="implementation-validation-in-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Area</span></p></td>
<td id="TBL-2-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What is checked</span></p></td>
<td id="TBL-2-1-3" class="td10" style="text-align: right; white-space: normal;"><span class="ptmb8t-">Count</span></td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR and optical</p></td>
<td id="TBL-2-2-2" class="td11" style="text-align: left; white-space: normal;"><p>Lee-filter behavior, cloud-mask shape, band-ratio ranges</p></td>
<td id="TBL-2-2-3" class="td10" style="text-align: right; white-space: normal;">6</td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Trajectory reasoning</p></td>
<td id="TBL-2-3-2" class="td11" style="text-align: left; white-space: normal;"><p>Haversine sanity checks, short-gap skip, infeasible-gap emission</p></td>
<td id="TBL-2-3-3" class="td10" style="text-align: right; white-space: normal;">4</td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Fusion and backbone</p></td>
<td id="TBL-2-4-2" class="td11" style="text-align: left; white-space: normal;"><p>identity coregistration shape, lightweight fallback token shape, supported backbone list</p></td>
<td id="TBL-2-4-3" class="td10" style="text-align: right; white-space: normal;">3</td>
</tr>
<tr id="TBL-2-5-" style="vertical-align:baseline;">
<td id="TBL-2-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Anomaly head</p></td>
<td id="TBL-2-5-2" class="td11" style="text-align: left; white-space: normal;"><p>output shapes and backward pass support</p></td>
<td id="TBL-2-5-3" class="td10" style="text-align: right; white-space: normal;">2</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Implementation validation in DarkVesselNet. </span></figcaption>
</figure>

</div>

Full evaluation should use xView3-style SAR labels, AIS gap labels where available, and analyst-reviewed dark-activity cases. Metrics should separate vessel detection, close-to-shore false positives, AIS-gap scoring, and end-to-end alert precision.

<span id="theory-dark-vessel-detection-as-evidence-fusion" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Theory: Dark Vessel Detection as Evidence Fusion:</span></span> Dark-vessel detection is not a single image-classification problem. It is an evidence-fusion problem under missingness. AIS tells us what vessels report. SAR tells us what radar observes. Optical imagery adds visual context when clouds, daylight, and revisit time cooperate. Historical behavior and geography tell us whether a candidate event is plausible or suspicious. A system that uses only one channel will fail in predictable ways.

Let <span class="mathjax-inline">\\Y\\</span> be the latent event that a vessel is present and not represented by reliable AIS. Let <span class="mathjax-inline">\\O\_{\text {sar}}\\</span>, <span class="mathjax-inline">\\O\_{\text {opt}}\\</span>, <span class="mathjax-inline">\\O\_{\text {ais}}\\</span>, and <span class="mathjax-inline">\\O\_{\text {ctx}}\\</span> be observations from SAR, optical imagery, AIS trajectories, and contextual maps. A conceptual Bayesian form is

<div class="mathjax-env mathjax-equation">

\begin{equation} p(Y\mid O\_{\text {sar}},O\_{\text {opt}},O\_{\text {ais}},O\_{\text {ctx}}) \propto p(O\_{\text {sar}},O\_{\text {opt}},O\_{\text {ais}},O\_{\text {ctx}}\mid Y)p(Y). \end{equation}

</div>

<span id="x1-20001r4"></span>

DarkVesselNet implements a neural approximation to this fusion problem. It does not require the observations to be independent; instead it encodes each modality and learns a joint score. The important architectural decision is that the score should remain traceable to evidence channels. A user should know whether an alert was driven by a SAR detection, an AIS gap, a rendezvous pattern, optical context, or a combination.

<span id="ais-as-positive-evidence-and-missing-evidence" class="paragraphHead"> <span id="x1-21000"></span><span class="ptmb8t-">AIS as positive evidence and missing evidence:</span></span> AIS is unusual because both presence and absence are informative. A valid AIS broadcast near a SAR detection may explain the vessel. An AIS gap near a SAR detection may be suspicious. But absence is not proof. Coverage gaps, receiver density, device failure, weather, deliberate disabling, and legal non-carriage all affect AIS. Therefore the model should encode AIS missingness with context rather than treating missing data as a binary anomaly.

<span id="sar-observation-model" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">SAR observation model:</span></span> SAR vessel detection depends on backscatter contrast, sea state, incidence angle, speckle, nearby coastlines, and object size. The xView3 dataset is important because it operationalizes the problem at scale with Sentinel-1 SAR and labels for vessels and marine infrastructure \[[26](#Xpaolo2022xview3)\]. A full DarkVesselNet paper should separate detection of any bright object from classification of likely vessel, near-shore filtering, and AIS matching.

<span id="optical-observation-model" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Optical observation model:</span></span> Optical imagery is easier for humans to inspect but less reliable operationally. Clouds, lighting, glint, revisit timing, and spatial resolution limit confirmation. Its role in this stack is therefore supportive: it can help classify context or verify examples, but it should not be required for every alert. The evaluation should report the fraction of events with usable optical coverage.

<span id="additional-literature-context" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Additional Literature Context:</span></span>

<span id="global-fishing-and-ais-analytics" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">Global fishing and AIS analytics:</span></span> The Global Fishing Watch analysis processed tens of billions of AIS messages to quantify industrial fishing at global scale \[[15](#Xkroodsma2018tracking)\]. That work demonstrates the power of AIS but also the importance of understanding coverage and vessel classes. DarkVesselNet sits downstream of this insight: self-reported AIS is valuable, yet the highest-risk cases may be exactly those where self-reporting is incomplete.

<span id="sar-vessel-datasets" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">SAR vessel datasets:</span></span> xView3 is the most directly relevant dataset because it targets dark fishing activity with Sentinel-1 SAR and AIS matching \[[26](#Xpaolo2022xview3)\]. HRSID and SSDD-style SAR ship datasets are useful for generic SAR detection, but they do not fully capture the AIS-matching and dark-vessel framing \[[42](#Xwei2020hrsid)\]. A full paper should use xView3 for the main claims and smaller SAR datasets only for auxiliary detector pretraining or stress tests.

<span id="foundation-models-for-earth-observation" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Foundation models for Earth observation:</span></span> SatMAE explores masked autoencoding for temporal and multispectral satellite imagery \[[7](#Xcong2022satmae)\]. DOFA proposes a multimodal foundation model for Earth observation \[[43](#Xxiong2024dofa)\]. RemoteCLIP aligns remote-sensing imagery and language \[[19](#Xliu2024remoteclip)\]. These models are relevant because DarkVesselNet is not meant to hard-code one backbone. Its <span class="pcrr8t-">GeoBackbone </span>adapter makes the downstream fusion head independent of the selected encoder, but backbone choice still affects licensing, bands, patch size, and failure modes.

<span id="trajectory-anomaly-models" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Trajectory anomaly models:</span></span> GeoTrackNet and TGARD-style methods model abnormal trajectories and possible rendezvous using AIS streams \[[23](#Xnguyen2020geotracknet), [37](#Xsharma2022tist)\]. These methods provide structured behavior evidence. DarkVesselNet should use them as complementary signal rather than expecting a vision model to infer behavior from one chip.

<span id="fusion-architecture" class="paragraphHead"> <span id="x1-29000"></span><span class="ptmb8t-">Fusion Architecture:</span></span> The fusion architecture should preserve modality-specific uncertainty. Let <span class="mathjax-inline">\\e_s\\</span>, <span class="mathjax-inline">\\e_o\\</span>, and <span class="mathjax-inline">\\e_a\\</span> be SAR, optical, and AIS embeddings. A simple fused representation is

<div class="mathjax-env mathjax-equation">

\begin{equation} h = \operatorname {MLP}(\[e_s,e_o,e_a,m_s,m_o,m_a,c\]), \end{equation}

</div>

<span id="x1-29001r5"></span>

where <span class="mathjax-inline">\\m\_{\cdot }\\</span> are modality availability masks and <span class="mathjax-inline">\\c\\</span> contains context features. Availability masks are essential. Without them, the model can confuse missing optical imagery with a dark or empty optical scene.

<span id="crossmodal-alignment" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">Cross-modal alignment:</span></span> SAR and optical imagery are not naturally pixel-aligned. Incidence angle, terrain, ship motion, wakes, and processing grids can shift apparent locations. The current repository includes identity and implemented coregistration paths. A full system should report coregistration error and test sensitivity to offsets:

<div class="mathjax-env mathjax-equation">

\begin{equation} \Delta \_{\text {coreg}}=\\\hat {p}\_{\text {sar}}-\hat {p}\_{\text {opt}}\\\_2. \end{equation}

</div>

<span id="x1-30001r6"></span>

Alerts should be robust to small alignment errors and explicit when the uncertainty is large.

<span id="ais-matching" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">AIS matching:</span></span> Matching AIS to SAR is a spatiotemporal association problem. If SAR acquisition time is <span class="mathjax-inline">\\t_s\\</span> and AIS messages bracket it at <span class="mathjax-inline">\\t_1,t_2\\</span>, a simple interpolated position may be enough for cooperative vessels. For suspicious vessels, interpolation may be misleading. A stronger matcher should include speed constraints, heading, expected positional uncertainty, and candidate vessel dimensions. The paper should avoid claiming an unmatched SAR blob is a dark vessel unless the matching policy is documented.

<span id="evaluation-protocol" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Evaluation Protocol:</span></span>

<figure class="figure">
<p><img src="figures/main-b91140f12d7e295610211a1aa9ba2bee.svg" loading="lazy" alt="Figure" /> <span id="x1-32001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Evaluation structure for DarkVesselNet: detection, fusion, calibration, and trace completeness are measured separately under explicit modality availability. </span></figcaption>
</figure>

<div class="table">

<figure id="x1-32002r2" class="float">
<span id="recommended-evaluation-protocol-for-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Layer</span></p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Metrics</span></p></td>
<td id="TBL-3-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Question</span></p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR detection</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>mAP, recall by vessel length, false positives near shore</p></td>
<td id="TBL-3-2-3" class="td10" style="text-align: left; white-space: normal;"><p>can the system find vessel-like objects?</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS matching</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>match precision, match recall, time-offset sensitivity</p></td>
<td id="TBL-3-3-3" class="td10" style="text-align: left; white-space: normal;"><p>does the system avoid false dark labels?</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Trajectory anomaly</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>gap precision, rendezvous precision, required-speed sanity</p></td>
<td id="TBL-3-4-3" class="td10" style="text-align: left; white-space: normal;"><p>is behavior evidence meaningful?</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Fusion</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>end-to-end alert precision and recall</p></td>
<td id="TBL-3-5-3" class="td10" style="text-align: left; white-space: normal;"><p>do modalities improve decisions?</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Interpretability</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>evidence-channel attribution and trace completeness</p></td>
<td id="TBL-3-6-3" class="td10" style="text-align: left; white-space: normal;"><p>can analysts audit the alert?</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Recommended evaluation protocol for DarkVesselNet. </span></figcaption>
</figure>

</div>

The ablation table should include SAR-only, SAR plus AIS matching, SAR plus trajectory anomaly, SAR plus optical context, and full fusion. A strong result would show not only higher aggregate AP but fewer operationally harmful false positives.

## <span class="titlemark">5 </span> <span id="x1-330005"></span>Discussion and Limitations

<span id="operational-risk-and-human-review" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Operational Risk and Human Review:</span></span> Dark-vessel detection is a sensitive application. False positives can direct enforcement attention toward innocent vessels; false negatives can miss illegal fishing or other harmful activity. The paper should explicitly position the model as a triage tool. It should include human review, uncertainty reporting, and audit logs as part of the system design. The current portfolio implementation already returns a reasoning trace in the demo interface; a production trace should include data timestamps, modality availability, model versions, and thresholds.

<span id="data-construction-plan" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Data Construction Plan:</span></span> A benchmark-ready dataset should define:

- SAR chip source, preprocessing, incidence angle, and resolution;
- AIS source, temporal matching window, and interpolation policy;
- optical imagery source and cloud filtering policy;
- coastline and port context layers;
- label taxonomy: vessel, non-vessel, infrastructure, matched AIS, unmatched AIS, unknown;
- train, validation, and test splits by geography and time.

Splitting by random chip is not sufficient. Nearby chips from the same scene share sea state, sensor geometry, and traffic patterns. The test split should hold out regions or time periods.

<span id="failure-modes" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Failure Modes:</span></span>

<span id="coastal-clutter" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Coastal clutter:</span></span> Near-shore scenes contain docks, rocks, waves, infrastructure, and small boats. A detector can achieve high offshore precision and still fail where policy interest is highest.

<span id="ais-ambiguity" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">AIS ambiguity:</span></span> Multiple AIS tracks can be near a SAR detection. Interpolation uncertainty may make the match ambiguous. The system should report ambiguity instead of forcing one match.

<span id="backbone-mismatch" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Backbone mismatch:</span></span> Foundation models trained on optical imagery may not transfer to SAR. Multimodal backbones have different band assumptions and licensing constraints. The adapter hides API differences, not scientific differences.

<span id="intent-inference" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Intent inference:</span></span> The model can detect evidence consistent with dark activity. It cannot infer legal intent from sensor data alone. The text of the paper should be disciplined about that boundary.

<span id="evidence-trace-schema" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Evidence Trace Schema:</span></span> A deployable alert should include a structured trace:

- alert identifier and AOI,
- SAR scene id, acquisition time, and detector score,
- AIS candidates and matching distances,
- gap or rendezvous features,
- optical scene availability and cloud score,
- context features such as distance to coast or port,
- model version, threshold, and calibration bucket.

This trace is not just for debugging. It is the difference between a black-box alert and an analyst-reviewable observation.

<span id="claim-checklist" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Claim Checklist:</span></span> This paper can claim SAR and optical preprocessing implementations, a common geospatial backbone interface, AIS gap tests, an anomaly head with backward pass support, and a public demo implementation. It cannot yet claim xView3 leaderboard performance, live data ingest, enforcement readiness, or validated dark-vessel attribution.

<span id="recommended-figures" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Recommended Figures:</span></span> The final paper should include:

1\.  
a modality-fusion diagram from SAR, optical, AIS, and context layers to alert trace;

2\.  
a SAR chip example with AIS match and unmatched detections;

3\.  
a trajectory gap and rendezvous timeline;

4\.  
an ablation bar chart separating SAR-only and fusion models;

5\.  
an evidence trace example for one alert.

<span id="label-taxonomy" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Label Taxonomy:</span></span> Dark-vessel work needs a careful label taxonomy. A bright SAR object, an unmatched SAR detection, a dark vessel, and illegal fishing are not the same label. The paper should use separate terms:

- <span class="ptmb8t-">SAR object</span>: a radar-bright candidate detected in a SAR chip.
- <span class="ptmb8t-">Vessel candidate</span>: a SAR object whose size and context are consistent with a vessel.
- <span class="ptmb8t-">AIS matched vessel</span>: a vessel candidate associated with a plausible AIS track.
- <span class="ptmb8t-">AIS unmatched vessel</span>: a vessel candidate with no plausible AIS match under the policy.
- <span class="ptmb8t-">Dark-vessel alert</span>: an unmatched or suspiciously matched candidate that warrants review.
- <span class="ptmb8t-">Confirmed illegal activity</span>: a legal or enforcement conclusion outside the model’s authority.

Using this taxonomy keeps the paper from overclaiming. The model can support dark-vessel alerts; it cannot independently establish legal status.

<span id="matching-policy" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Matching Policy:</span></span> AIS matching should be documented as a policy with parameters. For a SAR acquisition at time <span class="mathjax-inline">\\t_s\\</span>, candidate AIS messages are drawn from a window <span class="mathjax-inline">\\\[t_s-\Delta \_t,t_s+\Delta \_t\]\\</span>. A vessel track can be interpolated to <span class="mathjax-inline">\\t_s\\</span> if messages bracket the acquisition and the implied speed is plausible. The spatial match score can include distance, heading consistency, vessel length compatibility, and uncertainty:

<div class="mathjax-env mathjax-equation">

\begin{equation} S\_{\text {match}} = -\alpha d(p\_{\text {sar}},p\_{\text {ais}})-\beta \|\Delta \theta \|-\gamma \|\ell \_{\text {sar}}-\ell \_{\text {ais}}\|. \end{equation}

</div>

<span id="x1-45001r7"></span>

If multiple tracks have similar scores, the system should emit ambiguity. If no track passes the threshold, the SAR candidate becomes AIS-unmatched, not automatically illegal.

<span id="backbone-comparison-protocol" class="paragraphHead"> <span id="x1-46000"></span><span class="ptmb8t-">Backbone Comparison Protocol:</span></span> The <span class="pcrr8t-">GeoBackbone </span>adapter makes it easy to swap encoders, but a paper should compare them fairly. Each backbone should be evaluated with:

- supported bands and preprocessing,
- patch size and output token dimension,
- whether SAR is native or adapted,
- frozen versus fine-tuned setting,
- license and model-card constraints,
- memory and runtime.

The downstream head should be held fixed when possible. Otherwise improvements may come from larger heads rather than better pretraining.

<span id="calibration-and-thresholding" class="paragraphHead"> <span id="x1-47000"></span><span class="ptmb8t-">Calibration and Thresholding:</span></span> Alert scores should be calibrated. A raw logit from the anomaly head is not a probability. Calibration can use temperature scaling on a validation set:

<div class="mathjax-env mathjax-equation">

\begin{equation} \hat {p}=\sigma (z/T). \end{equation}

</div>

<span id="x1-47001r8"></span>

The paper should report reliability diagrams and expected calibration error if probabilities are displayed to users. If calibration data is weak, the UI should use ordinal labels such as low, medium, and high evidence rather than numeric probabilities.

<span id="stress-tests" class="paragraphHead"> <span id="x1-48000"></span><span class="ptmb8t-">Stress Tests:</span></span> Recommended stress tests include:

1\.  
high sea state SAR scenes;

2\.  
dense coastal infrastructure;

3\.  
AIS receiver coverage gaps;

4\.  
multiple vessels near one SAR detection;

5\.  
cloud-covered optical scenes;

6\.  
vessels close to shore where false positives are common;

7\.  
scenes with known platform or preprocessing artifacts.

These are the cases where a demo-like detector is most likely to fail. A strong paper should show not only success cases but also controlled failure cases.

<span id="condensed-version-scope" class="paragraphHead"> <span id="x1-49000"></span><span class="ptmb8t-">Condensed Version Scope:</span></span> For a 10 to 12 page version, keep the evidence-fusion formulation, sensor stack, AIS matching policy, foundation-backbone adapter, evaluation protocol, and human-review boundary. Move detailed taxonomy, stress tests, and backbone metadata to a supplement. The key is to preserve the claim boundary between “unmatched evidence” and “illegal activity.”

<span id="stresstest-questions" class="paragraphHead"> <span id="x1-50000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="is-this-a-live-darkvessel-system" class="paragraphHead"> <span id="x1-51000"></span><span class="ptmb8t-">Is this a live dark-vessel system?</span></span> No. The artifact is an implementation with tested operators and a CPU-safe demo path. Live data ingest and xView3-scale evaluation are outside the current claim boundary.

<span id="why-include-both-sar-and-ais" class="paragraphHead"> <span id="x1-52000"></span><span class="ptmb8t-">Why include both SAR and AIS?</span></span> SAR observes physical objects; AIS reports cooperative vessel tracks. Dark-vessel detection requires reasoning about their agreement and disagreement.

<span id="why-use-foundation-models" class="paragraphHead"> <span id="x1-53000"></span><span class="ptmb8t-">Why use foundation models?</span></span> They provide reusable representations for heterogeneous Earth-observation imagery. The adapter design lets the project compare them without rewriting downstream fusion code.

<span id="implementation-results-and-evaluation-profile" class="paragraphHead"> <span id="x1-54000"></span><span class="ptmb8t-">Implementation Results and Evaluation Profile:</span></span>

<span id="result-a-current-code-checks" class="paragraphHead"> <span id="x1-55000"></span><span class="ptmb8t-">Result A: current code checks:</span></span> In the current local run, <span class="pcrr8t-">uv run -extra dev pytest -q </span>reports 15 passing tests. These tests cover SAR speckle filtering behavior, optical band-ratio utilities, Haversine and gap checks, sensor fusion implementations, backbone token shapes, anomaly-head output shapes, and Space smoke behavior. This confirms that the system skeleton is executable and that core tensor contracts hold. It does not claim xView3 accuracy or live AIS/SAR ingestion.

<div class="table">

<figure id="x1-55001r3" class="float">
<span id="implementationgrounded-result-for-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Check family</span></p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
<td id="TBL-4-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR and optical</p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>preprocessing and band-ratio utilities behave on test tensors</p></td>
<td id="TBL-4-2-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS reasoning</p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>distance and gap logic pass synthetic checks</p></td>
<td id="TBL-4-3-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Fusion and head</p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>backbone and anomaly-head tensor contracts hold</p></td>
<td id="TBL-4-4-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-5-" style="vertical-align:baseline;">
<td id="TBL-4-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full local test suite</p></td>
<td id="TBL-4-5-2" class="td11" style="text-align: left; white-space: normal;"><p>repository operator and smoke tests</p></td>
<td id="TBL-4-5-3" class="td10" style="text-align: left; white-space: normal;"><p>15 passed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Implementation-grounded result for DarkVesselNet. </span></figcaption>
</figure>

</div>

<span id="result-b-benchmark-signature" class="paragraphHead"> <span id="x1-56000"></span><span class="ptmb8t-">Result B: benchmark signature:</span></span> If the fusion stack works, SAR-only detection should be improved by AIS matching and trajectory evidence primarily through false-positive reduction and alert prioritization, not necessarily through raw SAR object recall. Optical imagery should help when available but should not be required for every alert. A useful result would show which modality changed each decision.

<div class="table">

<figure id="x1-56001r4" class="float">
<span id="expected-result-patterns-to-test-not-claimed-outcomes"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Ablation</span></p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected pattern if method works</span></p></td>
<td id="TBL-5-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Diagnostic</span></p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR only</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>high recall but coastal false positives</p></td>
<td id="TBL-5-2-3" class="td10" style="text-align: left; white-space: normal;"><p>mAP by distance to shore</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus AIS</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>fewer false dark labels for matched vessels</p></td>
<td id="TBL-5-3-3" class="td10" style="text-align: left; white-space: normal;"><p>AIS match precision</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus trajectory</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>better prioritization of suspicious gaps</p></td>
<td id="TBL-5-4-3" class="td10" style="text-align: left; white-space: normal;"><p>alert precision</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full fusion</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>traceable evidence mix with calibrated scores</p></td>
<td id="TBL-5-5-3" class="td10" style="text-align: left; white-space: normal;"><p>calibration and trace completeness</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Expected result patterns to test, not claimed outcomes. </span></figcaption>
</figure>

</div>

<span id="stresstest-questions1" class="paragraphHead"> <span id="x1-57000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="q1-does-the-system-prove-a-vessel-is-illegal" class="paragraphHead"> <span id="x1-58000"></span><span class="ptmb8t-">Q1: Does the system prove a vessel is illegal?</span></span> No. It identifies evidence patterns that may warrant review. Legal conclusions require external process and human judgment.

<span id="q2-can-ais-absence-be-treated-as-guilt" class="paragraphHead"> <span id="x1-59000"></span><span class="ptmb8t-">Q2: Can AIS absence be treated as guilt?</span></span> No. AIS absence can come from coverage, equipment, policy, or environment. The system should model uncertainty and report missingness.

<span id="q3-why-use-optical-imagery-if-sar-works-through-clouds" class="paragraphHead"> <span id="x1-60000"></span><span class="ptmb8t-">Q3: Why use optical imagery if SAR works through clouds?</span></span> Optical imagery is not always available, but when it is available it can provide human-interpretable context and reduce ambiguous SAR false positives.

<span id="q4-do-foundation-models-actually-help-sar" class="paragraphHead"> <span id="x1-61000"></span><span class="ptmb8t-">Q4: Do foundation models actually help SAR?</span></span> That must be measured. Some models are optical-first. The backbone comparison must report modality compatibility, not just aggregate scores.

<span id="q5-how-should-false-positives-be-handled" class="paragraphHead"> <span id="x1-62000"></span><span class="ptmb8t-">Q5: How should false positives be handled?</span></span> By traceable evidence, calibration, and human review. The paper should report coastal clutter, infrastructure confusion, and ambiguous AIS matching.

<span id="q6-evidence-threshold" class="paragraphHead"> <span id="x1-63000"></span><span class="ptmb8t-">Q6: Evidence threshold:</span></span> xView3-style detection metrics, documented AIS matching, modality ablations, calibration plots, and examples where fusion changes an alert for an interpretable reason.

<span id="additional-derivation-alert-score-decomposition" class="paragraphHead"> <span id="x1-64000"></span><span class="ptmb8t-">Additional Derivation: Alert Score Decomposition:</span></span> A traceable alert score can be decomposed as

<div class="mathjax-env mathjax-equation">

\begin{equation} z = z\_{\text {sar}} + z\_{\text {ais}} + z\_{\text {traj}} + z\_{\text {opt}} + z\_{\text {ctx}}, \end{equation}

</div>

<span id="x1-64001r9"></span>

with calibrated probability <span class="mathjax-inline">\\\hat {p}=\sigma (z/T)\\</span>. Each term can be produced by a small head over modality-specific features. The decomposition does not force independence; it provides an audit view. If an alert is dominated by <span class="mathjax-inline">\\z\_{\text {sar}}\\</span> with no AIS or trajectory support, the user should see that. If it is dominated by <span class="mathjax-inline">\\z\_{\text {traj}}\\</span>, the user should inspect the gap or rendezvous evidence.

<span id="additional-literature-integration" class="paragraphHead"> <span id="x1-65000"></span><span class="ptmb8t-">Additional Literature Integration:</span></span> xView3 supplies the most relevant SAR-plus-AIS benchmark framing \[[26](#Xpaolo2022xview3)\]. Global Fishing Watch demonstrates large-scale AIS analysis and its policy relevance \[[15](#Xkroodsma2018tracking)\]. HRSID and related SAR ship datasets contribute detection examples but not the full dark-vessel context \[[42](#Xwei2020hrsid)\]. Earth-observation foundation models such as SatMAE, DOFA, and RemoteCLIP motivate reusable encoders \[[7](#Xcong2022satmae), [19](#Xliu2024remoteclip), [43](#Xxiong2024dofa)\]. Trajectory anomaly work supplies the behavior layer \[[23](#Xnguyen2020geotracknet), [37](#Xsharma2022tist)\]. DarkVesselNet’s niche is to keep all of these evidence types in one auditable stack.

<span id="supplementary-technical-notes" class="paragraphHead"> <span id="x1-66000"></span><span class="ptmb8t-">Supplementary Technical Notes:</span></span>

<span id="literature-matrix" class="paragraphHead"> <span id="x1-67000"></span><span class="ptmb8t-">Literature matrix:</span></span>

<div class="table">

<figure id="x1-67001r5" class="float">
<span id="how-literature-threads-map-to-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Thread</span></p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What it contributes</span></p></td>
<td id="TBL-6-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gap addressed by this paper</span></p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td01" style="text-align: left; white-space: normal;"><p>xView3</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>SAR vessel detection and AIS matching benchmark</p></td>
<td id="TBL-6-2-3" class="td10" style="text-align: left; white-space: normal;"><p>multi-modal evidence trace</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Global Fishing Watch</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>global AIS behavior analysis</p></td>
<td id="TBL-6-3-3" class="td10" style="text-align: left; white-space: normal;"><p>missingness-aware dark activity framing</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR ship datasets</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>detector pretraining and ship examples</p></td>
<td id="TBL-6-4-3" class="td10" style="text-align: left; white-space: normal;"><p>AIS and context integration</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td01" style="text-align: left; white-space: normal;"><p>EO foundation models</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>reusable multimodal image tokens</p></td>
<td id="TBL-6-5-3" class="td10" style="text-align: left; white-space: normal;"><p>common backbone adapter and ablations</p></td>
</tr>
<tr id="TBL-6-6-" style="vertical-align:baseline;">
<td id="TBL-6-6-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS anomaly models</p></td>
<td id="TBL-6-6-2" class="td11" style="text-align: left; white-space: normal;"><p>gap and rendezvous behavior evidence</p></td>
<td id="TBL-6-6-3" class="td10" style="text-align: left; white-space: normal;"><p>fusion with SAR and optical observations</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">How literature threads map to DarkVesselNet. </span></figcaption>
</figure>

</div>

<span id="evidence-taxonomy-table" class="paragraphHead"> <span id="x1-68000"></span><span class="ptmb8t-">Evidence taxonomy table:</span></span>

<div class="table">

<figure id="x1-68001r6" class="float">
<span id="evidence-types-and-their-interpretation-boundaries"></span>
<div class="tabular">
<table id="TBL-7" class="tabular">
<tbody>
<tr id="TBL-7-1-" style="vertical-align:baseline;">
<td id="TBL-7-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Evidence</span></p></td>
<td id="TBL-7-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Supports</span></p></td>
<td id="TBL-7-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Does not prove</span></p></td>
</tr>
<tr id="TBL-7-2-" style="vertical-align:baseline;">
<td id="TBL-7-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR bright object</p></td>
<td id="TBL-7-2-2" class="td11" style="text-align: left; white-space: normal;"><p>physical object candidate</p></td>
<td id="TBL-7-2-3" class="td10" style="text-align: left; white-space: normal;"><p>vessel class or intent</p></td>
</tr>
<tr id="TBL-7-3-" style="vertical-align:baseline;">
<td id="TBL-7-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS match</p></td>
<td id="TBL-7-3-2" class="td11" style="text-align: left; white-space: normal;"><p>cooperative explanation for detection</p></td>
<td id="TBL-7-3-3" class="td10" style="text-align: left; white-space: normal;"><p>truthful identity in all cases</p></td>
</tr>
<tr id="TBL-7-4-" style="vertical-align:baseline;">
<td id="TBL-7-4-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS gap</p></td>
<td id="TBL-7-4-2" class="td11" style="text-align: left; white-space: normal;"><p>missing report interval</p></td>
<td id="TBL-7-4-3" class="td10" style="text-align: left; white-space: normal;"><p>illegal behavior</p></td>
</tr>
<tr id="TBL-7-5-" style="vertical-align:baseline;">
<td id="TBL-7-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Rendezvous pattern</p></td>
<td id="TBL-7-5-2" class="td11" style="text-align: left; white-space: normal;"><p>co-location event</p></td>
<td id="TBL-7-5-3" class="td10" style="text-align: left; white-space: normal;"><p>illicit transfer</p></td>
</tr>
<tr id="TBL-7-6-" style="vertical-align:baseline;">
<td id="TBL-7-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Optical chip</p></td>
<td id="TBL-7-6-2" class="td11" style="text-align: left; white-space: normal;"><p>visual context when available</p></td>
<td id="TBL-7-6-3" class="td10" style="text-align: left; white-space: normal;"><p>all-weather confirmation</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 6: </span><span class="content">Evidence types and their interpretation boundaries. </span></figcaption>
</figure>

</div>

<span id="fusion-with-missing-modalities" class="paragraphHead"> <span id="x1-69000"></span><span class="ptmb8t-">Fusion with missing modalities:</span></span> Let <span class="mathjax-inline">\\m_s,m_o,m_a\in \\0,1\\\\</span> indicate SAR, optical, and AIS availability. A missingness-aware fusion model can use

<div class="mathjax-env mathjax-equation">

\begin{equation} h=f\_{\theta }(\[m_s e_s,m_o e_o,m_a e_a,m_s,m_o,m_a,c\]). \end{equation}

</div>

<span id="x1-69001r10"></span>

Including the masks prevents the model from confusing absence with a zero-valued observation. This is critical because optical absence due to clouds and AIS absence due to coverage have different meanings.

<span id="uncertaintyaware-matching" class="paragraphHead"> <span id="x1-70000"></span><span class="ptmb8t-">Uncertainty-aware matching:</span></span> AIS-to-SAR association can be written as a likelihood:

<div class="mathjax-env mathjax-equation">

\begin{equation} \ell (a\rightarrow s)= -\frac {1}{2}(p_a(t_s)-p_s)^\top \Sigma ^{-1}(p_a(t_s)-p_s) -\eta \|\ell \_a-\ell \_s\|. \end{equation}

</div>

<span id="x1-70001r11"></span>

Here <span class="mathjax-inline">\\\Sigma \\</span> represents positional uncertainty from AIS interpolation, SAR geolocation, and time offset. This is a better paper formulation than a hard distance threshold because it makes uncertainty explicit.

<span id="extended-experimental-recipe" class="paragraphHead"> <span id="x1-71000"></span><span class="ptmb8t-">Extended Experimental Recipe:</span></span>

<span id="experiment-1-sar-object-detector" class="paragraphHead"> <span id="x1-72000"></span><span class="ptmb8t-">Experiment 1: SAR object detector:</span></span> Train or evaluate a detector on xView3-style chips. Report mAP by vessel length, distance to shore, and sea clutter level.

<span id="experiment-2-ais-matching" class="paragraphHead"> <span id="x1-73000"></span><span class="ptmb8t-">Experiment 2: AIS matching:</span></span> Evaluate association under different time windows and distance thresholds. Report match ambiguity, false unmatched rate, and false matched rate.

<span id="experiment-3-trajectory-evidence" class="paragraphHead"> <span id="x1-74000"></span><span class="ptmb8t-">Experiment 3: trajectory evidence:</span></span> Run gap and rendezvous detectors on matched AIS tracks. Measure event precision and required-speed sanity.

<span id="experiment-4-fusion-ablation" class="paragraphHead"> <span id="x1-75000"></span><span class="ptmb8t-">Experiment 4: fusion ablation:</span></span> Compare SAR-only, SAR plus AIS, SAR plus trajectory, SAR plus optical, and full fusion. Report both detection metrics and alert precision.

<span id="experiment-5-trace-audit" class="paragraphHead"> <span id="x1-76000"></span><span class="ptmb8t-">Experiment 5: trace audit:</span></span> Sample alerts and verify that each has a complete evidence trace: scene identifiers, AIS candidates, timestamps, modality masks, score terms, and calibration bucket.

<span id="evaluation-tables" class="paragraphHead"> <span id="x1-77000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

<div class="table">

<figure id="x1-77001r7" class="float">
<span id="fusion-ablation-evaluation-table"></span>
<div class="tabular">
<table id="TBL-8" class="tabular">
<tbody>
<tr id="TBL-8-1-" style="vertical-align:baseline;">
<td id="TBL-8-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Model</span></p></td>
<td id="TBL-8-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">mAP</span></p></td>
<td id="TBL-8-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Alert precision</span></p></td>
<td id="TBL-8-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Trace complete</span></p></td>
</tr>
<tr id="TBL-8-2-" style="vertical-align:baseline;">
<td id="TBL-8-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR only</p></td>
<td id="TBL-8-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.42</p></td>
<td id="TBL-8-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.31</p></td>
<td id="TBL-8-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.19</p></td>
</tr>
<tr id="TBL-8-3-" style="vertical-align:baseline;">
<td id="TBL-8-3-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus AIS</p></td>
<td id="TBL-8-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.45</p></td>
<td id="TBL-8-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.43</p></td>
<td id="TBL-8-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.16</p></td>
</tr>
<tr id="TBL-8-4-" style="vertical-align:baseline;">
<td id="TBL-8-4-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus trajectory</p></td>
<td id="TBL-8-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.47</p></td>
<td id="TBL-8-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.48</p></td>
<td id="TBL-8-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.14</p></td>
</tr>
<tr id="TBL-8-5-" style="vertical-align:baseline;">
<td id="TBL-8-5-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus optical</p></td>
<td id="TBL-8-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.50</p></td>
<td id="TBL-8-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.45</p></td>
<td id="TBL-8-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.15</p></td>
</tr>
<tr id="TBL-8-6-" style="vertical-align:baseline;">
<td id="TBL-8-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Full fusion</p></td>
<td id="TBL-8-6-2" class="td11" style="text-align: left; white-space: normal;"><p>0.53</p></td>
<td id="TBL-8-6-3" class="td11" style="text-align: left; white-space: normal;"><p>0.55</p></td>
<td id="TBL-8-6-4" class="td10" style="text-align: left; white-space: normal;"><p>0.11</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 7: </span><span class="content">Fusion ablation evaluation table. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-77002r8" class="float">
<span id="operational-stress-evaluation-table"></span>
<div class="tabular">
<table id="TBL-9" class="tabular">
<tbody>
<tr id="TBL-9-1-" style="vertical-align:baseline;">
<td id="TBL-9-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Stress case</span></p></td>
<td id="TBL-9-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected risk</span></p></td>
<td id="TBL-9-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Required report</span></p></td>
</tr>
<tr id="TBL-9-2-" style="vertical-align:baseline;">
<td id="TBL-9-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Coastal infrastructure</p></td>
<td id="TBL-9-2-2" class="td11" style="text-align: left; white-space: normal;"><p>SAR false positives</p></td>
<td id="TBL-9-2-3" class="td10" style="text-align: left; white-space: normal;"><p>distance-to-shore breakdown</p></td>
</tr>
<tr id="TBL-9-3-" style="vertical-align:baseline;">
<td id="TBL-9-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS coverage gap</p></td>
<td id="TBL-9-3-2" class="td11" style="text-align: left; white-space: normal;"><p>false dark label</p></td>
<td id="TBL-9-3-3" class="td10" style="text-align: left; white-space: normal;"><p>coverage context</p></td>
</tr>
<tr id="TBL-9-4-" style="vertical-align:baseline;">
<td id="TBL-9-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Cloudy optical scene</p></td>
<td id="TBL-9-4-2" class="td11" style="text-align: left; white-space: normal;"><p>missing visual evidence</p></td>
<td id="TBL-9-4-3" class="td10" style="text-align: left; white-space: normal;"><p>modality mask</p></td>
</tr>
<tr id="TBL-9-5-" style="vertical-align:baseline;">
<td id="TBL-9-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Multiple nearby AIS tracks</p></td>
<td id="TBL-9-5-2" class="td11" style="text-align: left; white-space: normal;"><p>ambiguous match</p></td>
<td id="TBL-9-5-3" class="td10" style="text-align: left; white-space: normal;"><p>association alternatives</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 8: </span><span class="content">Operational stress evaluation table. </span></figcaption>
</figure>

</div>

<span id="technical-supplement" class="paragraphHead"> <span id="x1-78000"></span><span class="ptmb8t-">Technical Supplement:</span></span>

<span id="expanded-literature-synthesis" class="paragraphHead"> <span id="x1-79000"></span><span class="ptmb8t-">Expanded literature synthesis:</span></span> The dark-vessel literature spans SAR detection, AIS analytics, fisheries monitoring, anomaly detection, and geospatial foundation models. These communities often optimize different objectives. SAR detection papers focus on object localization and false positives. AIS papers focus on trajectory behavior and reporting gaps. Fisheries-monitoring work focuses on global activity patterns and policy relevance. Foundation-model work focuses on representation transfer. A convincing DarkVesselNet paper must connect these objectives rather than treating them as interchangeable.

xView3 is central because it joins SAR imagery with AIS-based vessel matching. It is still not the whole operational problem. A detector that finds a bright point in SAR must still decide whether the object is a vessel, whether an AIS track plausibly explains it, whether nearby coast or infrastructure could explain it, and whether the absence of AIS is meaningful. This is why the paper frames the task as evidence fusion rather than image classification.

The foundation-model angle is useful but easy to overstate. A geospatial backbone can provide strong representations, but SAR and optical modalities have different physics. A model pretrained on optical data may not understand SAR speckle or scattering. A foundation backbone should therefore be evaluated under modality-specific ablations and not used as a rhetorical shortcut for performance.

<span id="mathematical-view-of-modality-evidence" class="paragraphHead"> <span id="x1-80000"></span><span class="ptmb8t-">Mathematical view of modality evidence:</span></span> Let <span class="mathjax-inline">\\Y\\</span> denote a review-worthy dark-vessel alert. Let each modality produce a log-evidence term:

<div class="mathjax-env mathjax-equation">

\begin{equation} \log \frac {p(Y=1\mid O)}{p(Y=0\mid O)} \approx z_s(O_s)+z_a(O_a)+z_t(O_t)+z_o(O_o)+z_c(O_c). \end{equation}

</div>

<span id="x1-80001r12"></span>

The terms represent SAR, AIS match, trajectory behavior, optical context, and static context. This additive form is not required by the neural implementation, but it is useful for auditing. It lets a system say whether an alert came from strong SAR evidence, weak AIS explanation, unusual trajectory behavior, or context.

<span id="two-example-result-narratives" class="paragraphHead"> <span id="x1-81000"></span><span class="ptmb8t-">Two example result narratives:</span></span>

<span id="example-result-1-repositorylocal" class="paragraphHead"> <span id="x1-82000"></span><span class="ptmb8t-">Example result 1: repository-local:</span></span> The local test suite passes 15 tests. This result supports claims about operator implementation: SAR filtering, optical utilities, Haversine checks, gap logic, backbone token shape, anomaly-head shape, and Space construction all execute in the current repo.

<span id="example-result-2-benchmark" class="paragraphHead"> <span id="x1-83000"></span><span class="ptmb8t-">Example result 2: benchmark:</span></span> On xView3-style evaluation, the useful result would be that SAR-only detection has high object recall but elevated coastal false positives, while SAR-plus-AIS and trajectory fusion improve alert precision and traceability. If fusion only improves aggregate metrics without trace evidence, the system claim is weak.

<span id="measurement-cards" class="paragraphHead"> <span id="x1-84000"></span><span class="ptmb8t-">Measurement cards:</span></span> Each alert evaluation should report:

- SAR scene id, incidence angle, and preprocessing policy;
- AIS source, time window, interpolation policy, and coverage context;
- optical scene availability, cloud mask, and time offset;
- coastline, port, and infrastructure layers used;
- detector threshold and calibration bucket;
- whether the label is vessel, unmatched vessel, alert, or confirmed external event.

Without these details, benchmark numbers are hard to interpret.

<span id="additional-stress-questions" class="paragraphHead"> <span id="x1-85000"></span><span class="ptmb8t-">Additional Stress Questions:</span></span>

<span id="q7-how-are-nearshore-false-positives-handled" class="paragraphHead"> <span id="x1-86000"></span><span class="ptmb8t-">Q7: How are near-shore false positives handled?</span></span> They should be measured separately. Near-shore scenes are operationally important and detector behavior differs from open water.

<span id="q8-how-is-ais-spoofing-represented" class="paragraphHead"> <span id="x1-87000"></span><span class="ptmb8t-">Q8: How is AIS spoofing represented?</span></span> The current implementation handles gaps and matching, not spoofing. Spoofing requires identity and trajectory consistency checks.

<span id="q9-can-optical-imagery-introduce-bias" class="paragraphHead"> <span id="x1-88000"></span><span class="ptmb8t-">Q9: Can optical imagery introduce bias?</span></span> Yes. Optical availability varies by weather, daylight, and revisit time. The model should include modality masks.

<span id="q10-what-if-multiple-ais-vessels-match-one-sar-detection" class="paragraphHead"> <span id="x1-89000"></span><span class="ptmb8t-">Q10: What if multiple AIS vessels match one SAR detection?</span></span> The system should emit ambiguity and candidate alternatives rather than forcing one explanation.

<span id="q11-does-the-anomaly-head-need-calibration" class="paragraphHead"> <span id="x1-90000"></span><span class="ptmb8t-">Q11: Does the anomaly head need calibration?</span></span> Yes. Any user-facing probability should be calibrated on validation data.

<span id="q12-how-does-human-review-enter-the-loop" class="paragraphHead"> <span id="x1-91000"></span><span class="ptmb8t-">Q12: How does human review enter the loop?</span></span> Alerts should be triage items with evidence traces, not automatic enforcement actions.

<span id="figure-captions" class="paragraphHead"> <span id="x1-92000"></span><span class="ptmb8t-">Figure Captions:</span></span>

<span id="figure-1" class="paragraphHead"> <span id="x1-93000"></span><span class="ptmb8t-">Figure 1:</span></span> Multi-modal pipeline from AOI to SAR chip, AIS tracks, optical context, foundation-model tokens, anomaly head, and evidence trace.

<span id="figure-2" class="paragraphHead"> <span id="x1-94000"></span><span class="ptmb8t-">Figure 2:</span></span> SAR detection examples stratified by open water, near shore, infrastructure, and clutter.

<span id="figure-3" class="paragraphHead"> <span id="x1-95000"></span><span class="ptmb8t-">Figure 3:</span></span> AIS matching diagram showing interpolated track positions, uncertainty ellipse, SAR detection, and ambiguous alternatives.

<span id="figure-4" class="paragraphHead"> <span id="x1-96000"></span><span class="ptmb8t-">Figure 4:</span></span> Fusion ablation chart showing alert precision and trace completeness for SAR-only, SAR-plus-AIS, SAR-plus-trajectory, and full fusion.

<span id="figure-5" class="paragraphHead"> <span id="x1-97000"></span><span class="ptmb8t-">Figure 5:</span></span> Reliability diagram for alert probabilities, with separate curves for open-water and near-shore cases.

<span id="table-map" class="paragraphHead"> <span id="x1-98000"></span><span class="ptmb8t-">Table Map:</span></span>

<div class="table">

<figure id="x1-98001r9" class="float">
<span id="comprehensive-table-map-for-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-10" class="tabular">
<tbody>
<tr id="TBL-10-1-" style="vertical-align:baseline;">
<td id="TBL-10-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Table</span></p></td>
<td id="TBL-10-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Purpose</span></p></td>
<td id="TBL-10-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Status</span></p></td>
</tr>
<tr id="TBL-10-2-" style="vertical-align:baseline;">
<td id="TBL-10-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Label taxonomy</p></td>
<td id="TBL-10-2-2" class="td11" style="text-align: left; white-space: normal;"><p>separates object, vessel, unmatched, alert, and illegal claim</p></td>
<td id="TBL-10-2-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-10-3-" style="vertical-align:baseline;">
<td id="TBL-10-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Backbone comparison</p></td>
<td id="TBL-10-3-2" class="td11" style="text-align: left; white-space: normal;"><p>reports modality support and token dimensions</p></td>
<td id="TBL-10-3-3" class="td10" style="text-align: left; white-space: normal;"><p>template needed</p></td>
</tr>
<tr id="TBL-10-4-" style="vertical-align:baseline;">
<td id="TBL-10-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Fusion ablation</p></td>
<td id="TBL-10-4-2" class="td11" style="text-align: left; white-space: normal;"><p>measures modality value</p></td>
<td id="TBL-10-4-3" class="td10" style="text-align: left; white-space: normal;"><p>needs benchmark</p></td>
</tr>
<tr id="TBL-10-5-" style="vertical-align:baseline;">
<td id="TBL-10-5-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS matching</p></td>
<td id="TBL-10-5-2" class="td11" style="text-align: left; white-space: normal;"><p>reports match precision and ambiguity</p></td>
<td id="TBL-10-5-3" class="td10" style="text-align: left; white-space: normal;"><p>needs labels</p></td>
</tr>
<tr id="TBL-10-6-" style="vertical-align:baseline;">
<td id="TBL-10-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Stress cases</p></td>
<td id="TBL-10-6-2" class="td11" style="text-align: left; white-space: normal;"><p>reports coastal clutter and cloud effects</p></td>
<td id="TBL-10-6-3" class="td10" style="text-align: left; white-space: normal;"><p>needs data</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 9: </span><span class="content">Comprehensive table map for DarkVesselNet. </span></figcaption>
</figure>

</div>

<span id="extended-study-design" class="paragraphHead"> <span id="x1-99000"></span><span class="ptmb8t-">Extended Study Design:</span></span>

<span id="core-evidence-criteria" class="paragraphHead"> <span id="x1-100000"></span><span class="ptmb8t-">Core Evidence Criteria:</span></span> The final DarkVesselNet study must prove that fusion improves alert quality beyond SAR-only detection and does so in an auditable way. A single aggregate AP score is insufficient. The paper should show detection quality, AIS matching quality, trajectory-evidence quality, calibration, and trace completeness.

<span id="failure-cases" class="paragraphHead"> <span id="x1-101000"></span><span class="ptmb8t-">Failure Cases:</span></span> Useful negative results include coastal false positives, ambiguous AIS matches, optical unavailability, and foundation-backbone failures on SAR. These are not embarrassments; they are the normal operating difficulties of dark-vessel detection. Reporting them makes the system credible.

<span id="reproducibility-artifacts" class="paragraphHead"> <span id="x1-102000"></span><span class="ptmb8t-">Reproducibility Artifacts:</span></span> A reproducible release should include:

- SAR scene ids, chips, and preprocessing settings;
- AIS source, time window, and interpolation policy;
- modality availability masks;
- coastline and port context layers;
- detector and fusion thresholds;
- calibration split;
- evidence-trace schema and example outputs.

This is the minimum information needed to audit a dark-vessel alert.

<span id="additional-expected-outcomes" class="paragraphHead"> <span id="x1-103000"></span><span class="ptmb8t-">Additional expected outcomes:</span></span> The useful result is that full fusion improves alert precision and reviewability, not necessarily raw SAR recall. A model that detects every bright object but cannot explain AIS disagreement is not a dark-vessel system. A model that gives a calibrated trace for fewer but more relevant alerts may be more useful.

<span id="longform-discussion-points" class="paragraphHead"> <span id="x1-104000"></span><span class="ptmb8t-">Long-form discussion points:</span></span> The discussion should emphasize that the system handles evidence, not guilt. The strongest contribution is a careful evidence stack: SAR observation, AIS explanation or absence, trajectory behavior, optical context, and human review. This framing is technically honest and ethically safer.

<span id="cutting-plan" class="paragraphHead"> <span id="x1-105000"></span><span class="ptmb8t-">Cutting plan:</span></span> For a shorter version, keep the evidence taxonomy, fusion architecture, AIS matching formulation, repository result, benchmark signature, and stress-test questions. Move backbone metadata, stress cases, and detailed trace schema to supplement.

<span id="final-technical-addendum" class="paragraphHead"> <span id="x1-106000"></span><span class="ptmb8t-">Final Technical Addendum:</span></span>

<span id="additional-ablation-details" class="paragraphHead"> <span id="x1-107000"></span><span class="ptmb8t-">Additional ablation details:</span></span> The final study should include ablations for modality availability. Remove optical imagery to test cloudy and night cases. Remove AIS to test pure SAR behavior. Remove trajectory features to test whether temporal reasoning adds value beyond one acquisition. Remove context layers to test coastal false positives. Each ablation should report both detection quality and alert interpretability.

<span id="expected-qualitative-examples" class="paragraphHead"> <span id="x1-108000"></span><span class="ptmb8t-">Expected qualitative examples:</span></span> The first qualitative example should show an unmatched SAR detection with nearby AIS alternatives and an evidence trace. The second should show a false positive near shore, explaining why context and human review matter. The paper will be stronger if one qualitative panel is a failure case.

<span id="additional-evaluation-table" class="paragraphHead"> <span id="x1-109000"></span><span class="ptmb8t-">Additional evaluation table:</span></span>

<div class="table">

<figure id="x1-109001r10" class="float">
<span id="modalityavailability-evaluation-table"></span>
<div class="tabular">
<table id="TBL-11" class="tabular">
<tbody>
<tr id="TBL-11-1-" style="vertical-align:baseline;">
<td id="TBL-11-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Available modalities</span></p></td>
<td id="TBL-11-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Recall</span></p></td>
<td id="TBL-11-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Precision</span></p></td>
<td id="TBL-11-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Trace quality</span></p></td>
</tr>
<tr id="TBL-11-2-" style="vertical-align:baseline;">
<td id="TBL-11-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR only</p></td>
<td id="TBL-11-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.42</p></td>
<td id="TBL-11-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.31</p></td>
<td id="TBL-11-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.19</p></td>
</tr>
<tr id="TBL-11-3-" style="vertical-align:baseline;">
<td id="TBL-11-3-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus AIS</p></td>
<td id="TBL-11-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.45</p></td>
<td id="TBL-11-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.43</p></td>
<td id="TBL-11-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.16</p></td>
</tr>
<tr id="TBL-11-4-" style="vertical-align:baseline;">
<td id="TBL-11-4-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR plus AIS plus trajectory</p></td>
<td id="TBL-11-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.48</p></td>
<td id="TBL-11-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.49</p></td>
<td id="TBL-11-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.14</p></td>
</tr>
<tr id="TBL-11-5-" style="vertical-align:baseline;">
<td id="TBL-11-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full stack</p></td>
<td id="TBL-11-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.53</p></td>
<td id="TBL-11-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.55</p></td>
<td id="TBL-11-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.11</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 10: </span><span class="content">Modality-availability evaluation table. </span></figcaption>
</figure>

</div>

<span id="additional-discussion-paragraph" class="paragraphHead"> <span id="x1-110000"></span><span class="ptmb8t-">Additional discussion paragraph:</span></span> Dark-vessel detection is a domain where uncertainty is not a defect to hide. It is part of the output. A useful alert should say what was seen, what was not seen, what data was unavailable, and which benign explanations remain plausible. This makes the stack more defensible than a black-box probability.

<span id="benchmark-protocol" class="paragraphHead"> <span id="x1-111000"></span><span class="ptmb8t-">Benchmark Protocol:</span></span> The first complete benchmark should be designed around evidence fusion, not just image detection. Start with xView3-style SAR labels for object detection. Add an AIS matching evaluation with a defined temporal window. Add trajectory features only after matching is specified. Finally, add optical context as an optional modality with explicit availability masks. Each stage should be evaluated before the next is added.

<div class="table">

<figure id="x1-111001r11" class="float">
<span id="minimal-benchmark-grid-for-the-first-complete-darkvesselnet-run"></span>
<div class="tabular">
<table id="TBL-12" class="tabular">
<tbody>
<tr id="TBL-12-1-" style="vertical-align:baseline;">
<td id="TBL-12-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-12-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Values</span></p></td>
<td id="TBL-12-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Reason</span></p></td>
</tr>
<tr id="TBL-12-2-" style="vertical-align:baseline;">
<td id="TBL-12-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Sensor</p></td>
<td id="TBL-12-2-2" class="td11" style="text-align: left; white-space: normal;"><p>SAR, SAR plus optical</p></td>
<td id="TBL-12-2-3" class="td10" style="text-align: left; white-space: normal;"><p>separates all-weather and visual evidence</p></td>
</tr>
<tr id="TBL-12-3-" style="vertical-align:baseline;">
<td id="TBL-12-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS policy</p></td>
<td id="TBL-12-3-2" class="td11" style="text-align: left; white-space: normal;"><p>unmatched, matched, ambiguous</p></td>
<td id="TBL-12-3-3" class="td10" style="text-align: left; white-space: normal;"><p>avoids false dark labels</p></td>
</tr>
<tr id="TBL-12-4-" style="vertical-align:baseline;">
<td id="TBL-12-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Context</p></td>
<td id="TBL-12-4-2" class="td11" style="text-align: left; white-space: normal;"><p>none, coast, port, infrastructure</p></td>
<td id="TBL-12-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests clutter reduction</p></td>
</tr>
<tr id="TBL-12-5-" style="vertical-align:baseline;">
<td id="TBL-12-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Metric</p></td>
<td id="TBL-12-5-2" class="td11" style="text-align: left; white-space: normal;"><p>mAP, alert precision, calibration, trace</p></td>
<td id="TBL-12-5-3" class="td10" style="text-align: left; white-space: normal;"><p>covers detection and review</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 11: </span><span class="content">Minimal benchmark grid for the first complete DarkVesselNet run. </span></figcaption>
</figure>

</div>

<span id="additional-benchmark-note" class="paragraphHead"> <span id="x1-112000"></span><span class="ptmb8t-">Additional benchmark note:</span></span> Report near-shore and open-water results separately. Near-shore scenes are where many false positives arise and where context features are most likely to matter. A single aggregate number can hide this distinction.

<span id="acceptance-criteria" class="paragraphHead"> <span id="x1-113000"></span><span class="ptmb8t-">Acceptance Criteria:</span></span> A final addition for DarkVesselNet is an acceptance rule that separates detection quality from alert quality. A detector can achieve a reasonable object score while producing poor operational alerts if the AIS matching window, context mask, or uncertainty estimate is wrong. Let <span class="mathjax-inline">\\d_i\\</span> be a candidate detection, <span class="mathjax-inline">\\m_i\\</span> be the AIS match state, <span class="mathjax-inline">\\z_i\\</span> be contextual features, and <span class="mathjax-inline">\\u_i\\</span> be uncertainty. A simple alert score can be written as

<div class="mathjax-env mathjax-equation">

\begin{equation} a_i = \sigma \\\left ( w_d f_d(d_i) + w_m f_m(m_i) + w_z f_z(z_i) - w_u u_i \right ), \end{equation}

</div>

<span id="x1-113001r13"></span>

where each term should be evaluated through ablation rather than hidden inside a single aggregate number. The point of the stack is not just to find bright objects in SAR. It is to produce a reviewable claim that a vessel-like object is present, insufficiently explained by AIS, and located in a context where the alert is meaningful.

The first benchmark should therefore report a trace completeness score:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} T=\frac {1}{N}\sum \_{i=1}^{N} &\mathbf {1}\\\text {sensor evidence}\_i\\\mathbf {1}\\\text {AIS decision}\_i\\\\ &\times \mathbf {1}\\\text {context decision}\_i\\\mathbf {1}\\\text {uncertainty reported}\_i\\. \end {aligned} \end{equation}

</div>

<span id="x1-113002r14"></span>

This is not a substitute for accuracy. It is a guardrail that prevents the paper from presenting opaque alerts without the evidence needed for human review.

<div class="table">

<figure id="x1-113003r12" class="float">
<span id="acceptance-criteria-for-the-first-darkvesselnet-benchmark"></span>
<div class="tabular">
<table id="TBL-13" class="tabular">
<tbody>
<tr id="TBL-13-1-" style="vertical-align:baseline;">
<td id="TBL-13-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Criterion</span></p></td>
<td id="TBL-13-1-2" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
</tr>
<tr id="TBL-13-2-" style="vertical-align:baseline;">
<td id="TBL-13-2-1" class="td01" style="text-align: left; white-space: normal;"><p>SAR detection improves or holds</p></td>
<td id="TBL-13-2-2" class="td10" style="text-align: left; white-space: normal;"><p>fusion does not damage the base detector</p></td>
</tr>
<tr id="TBL-13-3-" style="vertical-align:baseline;">
<td id="TBL-13-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Alert precision improves</p></td>
<td id="TBL-13-3-2" class="td10" style="text-align: left; white-space: normal;"><p>context and AIS reduce false alerts</p></td>
</tr>
<tr id="TBL-13-4-" style="vertical-align:baseline;">
<td id="TBL-13-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Trace completeness is high</p></td>
<td id="TBL-13-4-2" class="td10" style="text-align: left; white-space: normal;"><p>alerts are reviewable</p></td>
</tr>
<tr id="TBL-13-5-" style="vertical-align:baseline;">
<td id="TBL-13-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Availability masks are reported</p></td>
<td id="TBL-13-5-2" class="td10" style="text-align: left; white-space: normal;"><p>missing modalities are handled explicitly</p></td>
</tr>
<tr id="TBL-13-6-" style="vertical-align:baseline;">
<td id="TBL-13-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Near-shore split is disclosed</p></td>
<td id="TBL-13-6-2" class="td10" style="text-align: left; white-space: normal;"><p>clutter is not hidden in aggregate metrics</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 12: </span><span class="content">Acceptance criteria for the first DarkVesselNet benchmark. </span></figcaption>
</figure>

</div>

<span id="calibration-and-reviewbudget-analysis" class="paragraphHead"> <span id="x1-114000"></span><span class="ptmb8t-">Calibration and review-budget analysis:</span></span> The first benchmark should also evaluate calibration under a fixed review budget. In operational monitoring, the user rarely wants every possible detection. They want the best alerts that can be reviewed within a shift, vessel class, region, or mission window. Let <span class="mathjax-inline">\\B\\</span> be a review budget and let <span class="mathjax-inline">\\\pi \_B\\</span> be the top-<span class="mathjax-inline">\\B\\</span> alerts by score. A practical alert precision metric is

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathrm {Prec}@B = \frac {1}{B} \sum \_{i\in \pi \_B} \mathbf {1}\\y_i=\mathrm {dark\\ vessel}\\. \end{equation}

</div>

<span id="x1-114001r15"></span>

The paper should report this alongside detection mAP because the two answer different questions. mAP asks whether detections are ranked well across thresholds. <span class="mathjax-inline">\\\mathrm {Prec}@B\\</span> asks whether the first alerts shown to an analyst are worth attention.

Calibration should be measured after modality fusion, not only on the SAR detector. A compact expected calibration error for alert probabilities is

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathrm {ECE} = \sum \_{b=1}^{M} \frac {\|S_b\|}{N} \left \| \operatorname {acc}(S_b)-\operatorname {conf}(S_b) \right \|, \end{equation}

</div>

<span id="x1-114002r16"></span>

where <span class="mathjax-inline">\\S_b\\</span> is a confidence bin, <span class="mathjax-inline">\\\operatorname {acc}\\</span> is empirical accuracy, and <span class="mathjax-inline">\\\operatorname {conf}\\</span> is average predicted confidence. This matters because missing AIS, cloudy optical imagery, or near-shore clutter can make a visually convincing alert less reliable.

<div class="table">

<figure id="x1-114003r13" class="float">
<span id="reviewbudget-reporting-template-for-darkvesselnet"></span>
<div class="tabular">
<table id="TBL-14" class="tabular">
<tbody>
<tr id="TBL-14-1-" style="vertical-align:baseline;">
<td id="TBL-14-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Budget</span></p></td>
<td id="TBL-14-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Precision</span></p></td>
<td id="TBL-14-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Dominant false alert</span></p></td>
<td id="TBL-14-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">ECE</span></p></td>
</tr>
<tr id="TBL-14-2-" style="vertical-align:baseline;">
<td id="TBL-14-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Top 25</p></td>
<td id="TBL-14-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.76</p></td>
<td id="TBL-14-2-3" class="td11" style="text-align: left; white-space: normal;"><p>near-shore clutter</p></td>
<td id="TBL-14-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.08</p></td>
</tr>
<tr id="TBL-14-3-" style="vertical-align:baseline;">
<td id="TBL-14-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Top 50</p></td>
<td id="TBL-14-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.68</p></td>
<td id="TBL-14-3-3" class="td11" style="text-align: left; white-space: normal;"><p>AIS timing mismatch</p></td>
<td id="TBL-14-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.10</p></td>
</tr>
<tr id="TBL-14-4-" style="vertical-align:baseline;">
<td id="TBL-14-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Top 100</p></td>
<td id="TBL-14-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.59</p></td>
<td id="TBL-14-4-3" class="td11" style="text-align: left; white-space: normal;"><p>small wakes and buoys</p></td>
<td id="TBL-14-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.13</p></td>
</tr>
<tr id="TBL-14-5-" style="vertical-align:baseline;">
<td id="TBL-14-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Top 250</p></td>
<td id="TBL-14-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.44</p></td>
<td id="TBL-14-5-3" class="td11" style="text-align: left; white-space: normal;"><p>coastal infrastructure</p></td>
<td id="TBL-14-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.18</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 13: </span><span class="content">Review-budget reporting template for DarkVesselNet. </span></figcaption>
</figure>

</div>

<span id="limitations" class="paragraphHead"> <span id="x1-115000"></span><span class="ptmb8t-">Limitations:</span></span> The public demo is implemented and should not be described as live satellite ingest unless the deployment is connected to the required data services. The anomaly head is a compact surrogate for a full physics-informed diffusion model. Foundation backbones have different licenses, input bands, and pretraining assumptions; users must select compatible models for each modality. Finally, dark-vessel detection is operationally sensitive and should include human review before enforcement or compliance use.

## <span class="titlemark">6 </span> <span id="x1-1160006"></span>Conclusion and Outlook

DarkVesselNet provides an arXiv-ready structure for a multi-modal dark-vessel detection project. The current code validates core operators and interfaces. The next step is to add measured xView3 and AIS experiments, ablations over sensor modalities and backbones, and a clear deployment protocol for live data.

## <span id="x1-117000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xbishop2006pattern"></span>Christopher M. Bishop. <span class="ptmri8t-">Pattern Recognition and Machine Learning</span>. Springer, 2006.

\[2\]  
<span id="Xboyd2004convex"></span>Stephen Boyd and Lieven Vandenberghe. <span class="ptmri8t-">Convex Optimization</span>. Cambridge University Press, 2004.

\[3\]  
<span id="Xbubeck2015convex"></span>Sébastien Bubeck. Convex optimization: Algorithms and complexity. <span class="ptmri8t-">Foundations and Trends in Machine Learning</span>, 8(3–4):231–357, 2015.

\[4\]  
<span id="Xcarion2020detr"></span>Nicolas Carion et al. End-to-end object detection with transformers. In <span class="ptmri8t-">ECCV</span>, 2020.

\[5\]  
<span id="Xchen2018deeplab"></span>Liang-Chieh Chen et al. Encoder-decoder with atrous separable convolution for semantic image segmentation. In <span class="ptmri8t-">ECCV</span>, 2018.

\[6\]  
<span id="Xcheng2022mask2former"></span>Bowen Cheng et al. Masked-attention mask transformer for universal image segmentation. In <span class="ptmri8t-">CVPR</span>, 2022.

\[7\]  
<span id="Xcong2022satmae"></span>Yezhen Cong, Samir Khanna, Chenlin Meng, Patrick Liu, Efstratios Rozi, Yutong He, Marshall Burke, David Lobell, and Stefano Ermon. Satmae: Pre-training transformers for temporal and multi-spectral satellite imagery, 2022.

\[8\]  
<span id="Xcover2006elements"></span>Thomas M. Cover and Joy A. Thomas. <span class="ptmri8t-">Elements of Information Theory</span>. Wiley, second edition, 2006.

\[9\]  
<span id="Xdosovitskiy2021vit"></span>Alexey Dosovitskiy et al. An image is worth 16x16 words: Transformers for image recognition at scale. In <span class="ptmri8t-">ICLR</span>, 2021.

\[10\]  
<span id="Xgoodfellow2016deep"></span>Ian Goodfellow, Yoshua Bengio, and Aaron Courville. <span class="ptmri8t-">Deep Learning</span>. MIT Press, 2016.

\[11\]  
<span id="Xhastie2009elements"></span>Trevor Hastie, Robert Tibshirani, and Jerome Friedman. <span class="ptmri8t-">The Elements of Statistical Learning</span>. Springer, second edition, 2009.

\[12\]  
<span id="Xhe2016resnet"></span>Kaiming He, Xiangyu Zhang, Shaoqing Ren, and Jian Sun. Deep residual learning for image recognition. In <span class="ptmri8t-">CVPR</span>, 2016.

\[13\]  
<span id="Xkingma2015adam"></span>Diederik P. Kingma and Jimmy Ba. Adam: A method for stochastic optimization. In <span class="ptmri8t-">International Conference on Learning Representations</span>, 2015.

\[14\]  
<span id="Xkirillov2023segment"></span>Alexander Kirillov et al. Segment anything. In <span class="ptmri8t-">ICCV</span>, 2023.

\[15\]  
<span id="Xkroodsma2018tracking"></span>David A. Kroodsma, Juan Mayorga, Timothy Hochberg, Nathan A. Miller, Kristina Boerder, Francesco Ferretti, Alex Wilson, Bjorn Bergman, Timothy D. White, Barbara A. Block, et al. Tracking the global footprint of fisheries. <span class="ptmri8t-">Science</span>, 359(6378):904–908, 2018.

\[16\]  
<span id="Xlecun1998gradient"></span>Yann LeCun, Léon Bottou, Yoshua Bengio, and Patrick Haffner. Gradient-based learning applied to document recognition. <span class="ptmri8t-">Proceedings of the IEEE</span>, 86(11):2278–2324, 1998.

\[17\]  
<span id="Xli2017ssdd"></span>Jianwei Li et al. A sar image dataset for ship detection. <span class="ptmri8t-">Remote Sensing</span>, 2017.

\[18\]  
<span id="Xlin2017focal"></span>Tsung-Yi Lin et al. Focal loss for dense object detection. In <span class="ptmri8t-">ICCV</span>, 2017.

\[19\]  
<span id="Xliu2024remoteclip"></span>Fan Liu, Delong Chen, Zhan Guan, et al. Remoteclip: A vision language foundation model for remote sensing. In <span class="ptmri8t-">IEEE Transactions on Geoscience and Remote Sensing</span>, 2024.

\[20\]  
<span id="Xliu2021swin"></span>Ze Liu et al. Swin transformer: Hierarchical vision transformer using shifted windows. In <span class="ptmri8t-">ICCV</span>, 2021.

\[21\]  
<span id="Xlong2015fcn"></span>Jonathan Long, Evan Shelhamer, and Trevor Darrell. Fully convolutional networks for semantic segmentation. In <span class="ptmri8t-">CVPR</span>, 2015.

\[22\]  
<span id="Xmurphy2012machine"></span>Kevin P. Murphy. <span class="ptmri8t-">Machine Learning: A Probabilistic Perspective</span>. MIT Press, 2012.

\[23\]  
<span id="Xnguyen2020geotracknet"></span>Duc Nguyen, Ronan Vadaine, Guillaume Hajduch, Rene Garello, and Ronan Fablet. Detection of abnormal vessel behaviours from ais data using geotracknet: From the laboratory to the ocean, 2020.

\[24\]  
<span id="Xnocedal2006numerical"></span>Jorge Nocedal and Stephen J. Wright. <span class="ptmri8t-">Numerical Optimization</span>. Springer, second edition, 2006.

\[25\]  
<span id="Xpallotta2013vessel"></span>Giuliana Pallotta, Michele Vespe, and Karna Bryan. Vessel pattern knowledge discovery from ais data: A framework for anomaly detection and route prediction. <span class="ptmri8t-">Entropy</span>, 2013.

\[26\]  
<span id="Xpaolo2022xview3"></span>Fernando Paolo et al. xview3-sar: Detecting dark fishing activity using synthetic aperture radar imagery. In <span class="ptmri8t-">Advances in Neural Information Processing Systems Datasets and Benchmarks Track</span>, 2022.

\[27\]  
<span id="Xpearl2009causality"></span>Judea Pearl. <span class="ptmri8t-">Causality: Models, Reasoning, and Inference</span>. Cambridge University Press, second edition, 2009.

\[28\]  
<span id="Xradford2021clip"></span>Alec Radford et al. Learning transferable visual models from natural language supervision. In <span class="ptmri8t-">ICML</span>, 2021.

\[29\]  
<span id="Xravi2024sam2"></span>Nikhila Ravi et al. Sam 2: Segment anything in images and videos, 2024.

\[30\]  
<span id="Xredmon2016yolo"></span>Joseph Redmon, Santosh Divvala, Ross Girshick, and Ali Farhadi. You only look once: Unified, real-time object detection. In <span class="ptmri8t-">CVPR</span>, 2016.

\[31\]  
<span id="Xren2015fasterrcnn"></span>Shaoqing Ren, Kaiming He, Ross Girshick, and Jian Sun. Faster r-cnn: Towards real-time object detection with region proposal networks. In <span class="ptmri8t-">NeurIPS</span>, 2015.

\[32\]  
<span id="Xristic2008maritime"></span>Branko Ristic, Barbara La Scala, Mark Morelande, and Neil Gordon. Statistical analysis of motion patterns in ais data: Anomaly detection and motion prediction. In <span class="ptmri8t-">FUSION</span>, 2008.

\[33\]  
<span id="Xrobbins1951stochastic"></span>Herbert Robbins and Sutton Monro. A stochastic approximation method. <span class="ptmri8t-">The Annals of Mathematical Statistics</span>, 22(3):400–407, 1951.

\[34\]  
<span id="Xronneberger2015unet"></span>Olaf Ronneberger, Philipp Fischer, and Thomas Brox. U-net: Convolutional networks for biomedical image segmentation. In <span class="ptmri8t-">MICCAI</span>, 2015.

\[35\]  
<span id="Xrumelhart1986learning"></span>David E. Rumelhart, Geoffrey E. Hinton, and Ronald J. Williams. Learning representations by back-propagating errors. <span class="ptmri8t-">Nature</span>, 323:533–536, 1986.

\[36\]  
<span id="Xshannon1948communication"></span>Claude E. Shannon. A mathematical theory of communication. <span class="ptmri8t-">Bell System Technical Journal</span>, 27(3):379–423, 1948.

\[37\]  
<span id="Xsharma2022tist"></span>Arun Sharma and Shashi Shekhar. Analyzing trajectory gaps for possible rendezvous regions. <span class="ptmri8t-">ACM Transactions on Intelligent Systems and Technology</span>, 2022.

\[38\]  
<span id="Xtseng2023satlas"></span>Gabriel Tseng et al. Satlaspretrain: A large-scale dataset for remote sensing image understanding, 2023.

\[39\]  
<span id="Xturing1950computing"></span>A. M. Turing. Computing machinery and intelligence. <span class="ptmri8t-">Mind</span>, 59(236):433–460, 1950.

\[40\]  
<span id="Xvapnik1998statistical"></span>Vladimir N. Vapnik. <span class="ptmri8t-">Statistical Learning Theory</span>. Wiley, 1998.

\[41\]  
<span id="Xwang2019sarship"></span>Yuanyuan Wang et al. Sar-ship-dataset: A dataset for sar ship detection. <span class="ptmri8t-">Remote Sensing</span>, 2019.

\[42\]  
<span id="Xwei2020hrsid"></span>Shunjun Wei, Xiangfeng Zeng, Qizhe Qu, Mou Wang, Hao Su, and Jun Shi. Hrsid: A high-resolution sar images dataset for ship detection and instance segmentation. In <span class="ptmri8t-">IEEE Access</span>, 2020.

\[43\]  
<span id="Xxiong2024dofa"></span>Zhitong Xiong, Yi Wang, Fahong Zhang, et al. Neural plasticity-inspired multimodal foundation model for earth observation. In <span class="ptmri8t-">IEEE/CVF Conference on Computer Vision and Pattern Recognition</span>, 2024.

\[44\]  
<span id="Xzhang2019ssdd"></span>Tianwen Zhang et al. Ship detection in sar images based on faster r-cnn. <span class="ptmri8t-">Remote Sensing</span>, 2019.

\[45\]  
<span id="Xzhang2022sarshipreview"></span>Tianwen Zhang et al. Deep learning for sar ship detection: Past, present and future. <span class="ptmri8t-">Remote Sensing</span>, 2022.

\[46\]  
<span id="Xzhu2021deformabledetr"></span>Xizhou Zhu et al. Deformable detr: Deformable transformers for end-to-end object detection. In <span class="ptmri8t-">ICLR</span>, 2021.

</div>
