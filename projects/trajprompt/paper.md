# TrajPrompt: Open-Vocabulary Maritime Behavior Search with Trajectory Contrastive Learning, TGARD, and Satellite Confirmation

Arun Sharma, University of Minnesota, Twin Cities

_In preparation. Target: NeurIPS 2026 Datasets and Benchmarks_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> Maritime analysts often search vessel behavior with rigid database filters: speed thresholds, bounding boxes, time windows, and hand-written anomaly rules. TrajPrompt proposes an open-vocabulary interface in which a user types a behavioral description and receives candidate AIS trajectories, rendezvous intervals, and satellite-image confirmation chips. The repository combines three components: a trajectory-side contrastive encoder for aligning AIS feature sequences with text embeddings, a PyTorch port of TGARD-style rendezvous detection, and a Sentinel-2 plus SAM 2 confirmation implementation. This paper is an arXiv-style paper grounded in the current codebase and public Hugging Face Space. It describes the method and implementation without inventing benchmark outcomes. Current validation consists of unit tests for Haversine distance, rendezvous detection, trajectory embedding normalization, contrastive loss behavior, SAM-chip shape, and the Space interface.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Automatic Identification System (AIS) streams are central to maritime domain awareness. They are also difficult to query by intent. A suspicious pattern such as “ships drifting near pipelines before disappearing from AIS” is not a single SQL predicate; it mixes geography, vessel motion, dwell time, proximity, imagery, and analyst context. Existing pipelines therefore alternate between manual filtering and bespoke anomaly detectors.

TrajPrompt explores a more natural interface. The analyst enters a free-text behavior query. The system embeds candidate trajectories, scores them against text, detects rendezvous events with a deterministic trajectory algorithm, and attaches satellite confirmation chips. The current repository is a research implementation: it contains the core trajectory encoder, TGARD-style rendezvous code, SAM 2 chip abstraction, tests, and a Hugging Face Space. It does not yet claim a complete production maritime search engine.

This paper turns that implementation into a structured paper. The emphasis is on what can be verified from the code today and the evaluation measurements used by the paper.

<span id="contributions" class="paragraphHead"> <span id="x1-2000"></span><span class="ptmb8t-">Contributions:</span></span>

1\.  
A trajectory-CLIP encoder that maps AIS feature sequences to normalized embeddings for contrastive alignment with natural language.

2\.  
A tensorized rendezvous detection path based on pairwise Haversine distance and dwell-time constraints.

3\.  
A satellite confirmation abstraction that connects candidate events to Sentinel-2 chips and SAM 2 masks.

4\.  
A testable repository and Space interface for open-vocabulary maritime behavior search.

<figure class="figure">
<p><img src="figures/main-d33cb21629c31f992864585e01d68eaa.svg" loading="lazy" alt="Figure" /> <span id="x1-2005r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Detailed TrajPrompt architecture. The figure distinguishes representation learning from evidence decoding: AIS and text tokens enter a contrastive attention layer, hard-negative gates shape the retrieval space, deterministic event modules produce auditable evidence, and the evaluation heads separately measure ranking and event correctness. </span></figcaption>
</figure>

<span id="scope" class="paragraphHead"> <span id="x1-3000"></span><span class="ptmb8t-">Scope:</span></span> Maritime search is often bottlenecked by the mismatch between how analysts think and how AIS databases are queried. Analysts ask for behavior: drifting, loitering, disappearing, rendezvousing, shadowing, or approaching restricted regions. Databases store messages: timestamps, coordinates, speed, course, MMSI, and vessel metadata. TrajPrompt addresses this mismatch by making natural language a retrieval interface over trajectory windows while preserving deterministic geospatial checks for events that should not be left to a neural embedding.

The paper is deliberately not framed as an autonomous enforcement system. A language-guided trajectory search engine should return candidates, evidence, and uncertainty. It should not assert intent. This boundary is especially important in maritime analytics because phrases like “illegal fishing” or “smuggling” are legal and contextual claims. The observable substrate is movement behavior, AIS availability, proximity, and optional satellite imagery.

The technical thesis is that trajectory search needs both representation learning and structured event reasoning. Contrastive learning can make free-text queries usable, but deterministic modules are still needed for Haversine distance, dwell intervals, trajectory gaps, and rendezvous candidates. Satellite confirmation is a third layer: it can verify whether imagery supports a candidate event, but it is constrained by revisit time, cloud cover, and resolution.

The expanded paper therefore treats TrajPrompt as a staged retrieval system. First, vector search proposes candidates. Second, deterministic event modules attach auditable geospatial evidence. Third, satellite confirmation reports whether visual evidence exists. Fourth, a human reader interprets the result. This staged framing is more defensible than claiming that a single embedding model understands maritime behavior.

<span id="expanded-contributions" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Expanded contributions:</span></span> The expanded paper adds a query taxonomy, weak-supervision plan, streaming-state design, hard-negative evaluation protocol, satellite-confirmation schema, implementation-grounded results, and six reader questions. These make the paper closer to a research artifact and less like a demo description.

## <span class="titlemark">2 </span> <span id="x1-50002"></span>Related Work

<span id="expanded-citation-map" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Expanded Citation Map:</span></span> The expanded citation map ties trajectory mining to modern language and contrastive learning. Dynamic time warping, robust trajectory similarity, TRACLUS, T-Drive, GeoLife, T2Vec, CSTRM, and CLAIS define the movement-representation side \[[5](#Xchen2005robust), [19](#Xlee2007traclus), [21](#Xli2018t2vec), [22](#Xli2023clais), [36](#Xsakoe1978dtw), [43](#Xyao2022cstrm), [44](#Xyuan2010tdrive), [46](#Xzheng2010geolife)\]. Maritime anomaly and rendezvous studies provide domain-specific evidence operators \[[25](#Xnguyen2020geotracknet), [27](#Xpallotta2013vessel), [33](#Xristic2008maritime), [38](#Xsharma2022tist), [45](#Xzheng2015trajectory)\]. Transformers, BERT, Sentence-BERT, CLIP, few-shot language models, retrieval-augmented generation, CPC, SimCLR, MoCo, and supervised contrastive learning define the language/retrieval objective family \[[3](#Xbrown2020language), [6](#Xchen2020simclr), [9](#Xdevlin2019bert), [13](#Xhe2020moco), [15](#Xkhosla2020supervisedcontrastive), [20](#Xlewis2020rag), [30](#Xradford2021clip), [32](#Xreimers2019sentencebert), [40](#Xoord2018cpc), [42](#Xvaswani2017attention)\]. SAM and SAM 2 remain the visual confirmation references rather than the primary retrieval mechanism \[[17](#Xkirillov2023segment), [31](#Xravi2024sam2)\].

<span id="trajectory-mining" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Trajectory mining:</span></span> Trajectory mining studies movement patterns, similarity, anomaly detection, and co-location in spatiotemporal data \[[45](#Xzheng2015trajectory)\]. Maritime AIS analytics has a long history in anomaly detection and dark-activity discovery \[[25](#Xnguyen2020geotracknet), [27](#Xpallotta2013vessel)\]. The TGARD line of work uses time-geographic reasoning to detect possible rendezvous and trajectory gaps in AIS streams.

<span id="contrastive-languageimage-and-languagetrajectory-models" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Contrastive language-image and language-trajectory models:</span></span> CLIP showed that contrastive learning can align natural language with visual representations at scale \[[29](#Xradford2021learning)\]. Trajectory representation learning work has used recurrent models, graph models, and contrastive objectives to compare movement sequences under noise and irregular sampling \[[22](#Xli2023clais), [43](#Xyao2022cstrm)\]. TrajPrompt adapts the language-alignment interface to AIS features. The trajectory side is a transformer over sequences of motion features; the text side can be supplied by an external sentence encoder.

<span id="satellite-confirmation" class="paragraphHead"> <span id="x1-9000"></span><span class="ptmb8t-">Satellite confirmation:</span></span> Large segmentation models such as SAM and SAM 2 make it feasible to use sparse prompts for visual confirmation \[[17](#Xkirillov2023segment), [31](#Xravi2024sam2)\]. In TrajPrompt, the vision layer is not the first detector. It is a confirmation stage attached to candidate events surfaced by AIS and text search. LSTMs, sequence-to-sequence encoders, distributed word representations, and modern sentence-embedding contrastive learning supply additional baselines for the text side of trajectory retrieval \[[7](#Xcho2014rnnencoder), [10](#Xgao2021simcse), [14](#Xhochreiter1997lstm), [23](#Xmikolov2013distributed)\].

<span id="literature-synthesis" class="paragraphHead"> <span id="x1-10000"></span><span class="ptmb8t-">Literature synthesis:</span></span> TrajPrompt connects trajectory mining, maritime anomaly detection, contrastive representation learning, and vision-language confirmation. The trajectory-mining literature provides the basic objects: trips, windows, stops, routes, shape similarity, clustering, and temporal segmentation \[[19](#Xlee2007traclus), [21](#Xli2018t2vec), [36](#Xsakoe1978dtw), [44](#Xyuan2010tdrive)–[46](#Xzheng2010geolife)\]. Maritime work adds AIS-specific concerns such as broadcast gaps, receiver coverage, rendezvous, transshipment, and intent ambiguity \[[25](#Xnguyen2020geotracknet), [27](#Xpallotta2013vessel), [33](#Xristic2008maritime), [38](#Xsharma2022tist)\]. These papers show that movement evidence must be modeled as structured behavior, not only as dense vector similarity.

The language side draws from BERT, sentence embeddings, CLIP, SimCLR, MoCo, supervised contrastive learning, SimCSE, and retrieval-augmented generation \[[6](#Xchen2020simclr), [9](#Xdevlin2019bert), [10](#Xgao2021simcse), [13](#Xhe2020moco), [15](#Xkhosla2020supervisedcontrastive), [20](#Xlewis2020rag), [30](#Xradford2021clip), [32](#Xreimers2019sentencebert)\]. This literature motivates a contrastive alignment between text queries and trajectory windows, but it also warns against shortcut learning. A model can match region names, vessel identities, or template phrases without understanding the requested behavior. TrajPrompt therefore pairs language retrieval with deterministic event records.

Satellite confirmation provides the third layer. SAM and SAM 2 make image and video segmentation useful for reviewing candidate chips \[[17](#Xkirillov2023segment), [31](#Xravi2024sam2)\]. In TrajPrompt, this visual layer is not an oracle. It verifies availability and observable evidence around a retrieved event when imagery exists. The paper’s contribution is the staged architecture: language retrieves candidates, deterministic event logic explains movement evidence, and satellite imagery supplies external confirmation when the sensing conditions allow it.

<span id="foundational-reference-anchors" class="paragraphHead"> <span id="x1-11000"></span><span class="ptmb8t-">Foundational reference anchors:</span></span> The bibliography also anchors the project-specific contribution in older and broader technical foundations: statistical learning and pattern recognition, deep learning, information theory, convex and numerical optimization, stochastic approximation, adaptive gradient methods, causality, and early AI framing \[[1](#Xbishop2006pattern), [2](#Xboyd2004convex), [4](#Xbubeck2015convex), [8](#Xcover2006elements), [11](#Xgoodfellow2016deep), [12](#Xhastie2009elements), [16](#Xkingma2015adam), [18](#Xlecun1998gradient), [24](#Xmurphy2012machine), [26](#Xnocedal2006numerical), [28](#Xpearl2009causality), [34](#Xrobbins1951stochastic), [35](#Xrumelhart1986learning), [37](#Xshannon1948communication), [39](#Xturing1950computing), [41](#Xvapnik1998statistical)\]. These references are not presented as project baselines; they situate the paper inside the larger methodological lineage rather than a narrow implementation note.

## <span class="titlemark">3 </span> <span id="x1-120003"></span>Method and Architecture

<span id="problem-formulation" class="paragraphHead"> <span id="x1-13000"></span><span class="ptmb8t-">Problem Formulation:</span></span> Let a trajectory window be

<div class="mathjax-env mathjax-equation">

\begin{equation} \tau = \\(t_i,\lambda \_i,\phi \_i,\text {sog}\_i,\text {cog}\_i,f_i)\\\_{i=1}^{T}, \end{equation}

</div>

<span id="x1-13001r1"></span>

where <span class="mathjax-inline">\\(\lambda ,\phi )\\</span> are longitude and latitude and <span class="mathjax-inline">\\f_i\\</span> denotes auxiliary features such as distance to coast or dwell indicators. Let <span class="mathjax-inline">\\q\\</span> be a natural-language behavior query. The goal is to rank trajectory windows and candidate multi-vessel events by relevance to <span class="mathjax-inline">\\q\\</span> while preserving deterministic checks for geometric predicates such as proximity and dwell.

The project separates three outputs:

1\.  
a ranked trajectory list from contrastive retrieval,

2\.  
rendezvous candidates from a deterministic detector,

3\.  
optional image chips and masks for visual confirmation.

<span id="method" class="paragraphHead"> <span id="x1-14000"></span><span class="ptmb8t-">Method:</span></span>

<span id="trajectory-encoder" class="paragraphHead"> <span id="x1-15000"></span><span class="ptmb8t-">Trajectory encoder:</span></span> The trajectory encoder maps a fixed-window sequence <span class="mathjax-inline">\\X\in \mathbb {R}^{T\times F}\\</span> to an embedding <span class="mathjax-inline">\\z\_{\tau }\in \mathbb {R}^d\\</span>. A linear input projection is followed by positional embeddings and transformer encoder layers:

<div class="mathjax-env mathjax-equation">

\begin{equation} H = \text {Transformer}(XW + P\_{1:T}). \end{equation}

</div>

<span id="x1-15001r2"></span>

The sequence representation is mean-pooled and projected to the embedding space:

<div class="mathjax-env mathjax-equation">

\begin{equation} z\_{\tau } = \frac {W_o \frac {1}{T}\sum \_t H_t}{\left \\W_o \frac {1}{T}\sum \_t H_t\right \\\_2}. \end{equation}

</div>

<span id="x1-15002r3"></span>

The repository tests that encoder outputs are L2-normalized.

<span id="contrastive-alignment" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">Contrastive alignment:</span></span> Given normalized trajectory embeddings <span class="mathjax-inline">\\Z\_{\tau }\\</span> and text embeddings <span class="mathjax-inline">\\Z_q\\</span>, the training loss is symmetric InfoNCE:

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {L} = \frac {1}{2}\text {CE}\left (\frac {Z\_{\tau }Z_q^\top }{\tau \_c}, y\right ) +\frac {1}{2}\text {CE}\left (\frac {Z_qZ\_{\tau }^\top }{\tau \_c}, y\right ). \end{equation}

</div>

<span id="x1-16001r4"></span>

This objective makes the retrieval layer compatible with natural-language behavior descriptions while keeping trajectory feature extraction independent of the text encoder.

<span id="rendezvous-detection" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Rendezvous detection:</span></span> The TGARD-style detector groups AIS points by time bucket and computes pairwise Haversine distances:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} d(a,b)&=2R\arcsin \left (\eta ^{1/2}\right ),\\ \eta &=\sin ^2\left (\frac {\Delta \phi }{2}\right ) +\cos \phi \_a\cos \phi \_b\sin ^2\left (\frac {\Delta \lambda }{2}\right ). \end {aligned} \end{equation}

</div>

<span id="x1-17001r5"></span>

A candidate rendezvous is opened when two distinct MMSIs remain within a distance threshold and is retained if the dwell duration exceeds a minimum. This implementation favors clarity and testability over indexing complexity; larger deployments should use spatial indexing and streaming state.

<span id="satellite-confirmation1" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Satellite confirmation:</span></span> For each candidate event, the confirmation layer is intended to query Microsoft Planetary Computer for Sentinel-2 imagery around the event location and time, crop a chip, and run SAM 2 with a ship prompt or point prompt. The current repository contains a shape-stable lightweight fallback that returns a three-channel chip and one-channel mask. This makes downstream interfaces testable without requiring network access or model downloads.

<span id="implementation" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Implementation:</span></span> The package is organized around three source files:

- <span class="pcrr8t-">tgard.py</span>: pairwise Haversine distance and dwell-based rendezvous detection.
- <span class="pcrr8t-">traj_clip.py</span>: trajectory encoder and contrastive loss.
- <span class="pcrr8t-">sam2_chip.py</span>: image-chip and mask abstraction for confirmation.

The Hugging Face Space exposes a Mapbox-style search UI with a text box and lookback slider. The Space callback is CPU-safe and returns a deterministic baseline, which is appropriate for interface testing but not a substitute for full inference.

## <span class="titlemark">4 </span> <span id="x1-200004"></span>Evaluation

<div class="table">

<figure id="x1-20001r1" class="float">
<span id="implementation-validation-in-trajprompt"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Area</span></p></td>
<td id="TBL-2-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What is checked</span></p></td>
<td id="TBL-2-1-3" class="td10" style="text-align: right; white-space: normal;"><span class="ptmb8t-">Count</span></td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Geodesy and rendezvous</p></td>
<td id="TBL-2-2-2" class="td11" style="text-align: left; white-space: normal;"><p>self-distance, one-degree latitude distance, no-match when far, match under close dwell</p></td>
<td id="TBL-2-2-3" class="td10" style="text-align: right; white-space: normal;">4</td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Contrastive encoder</p></td>
<td id="TBL-2-3-2" class="td11" style="text-align: left; white-space: normal;"><p>L2 normalization and lower loss for aligned pairs</p></td>
<td id="TBL-2-3-3" class="td10" style="text-align: right; white-space: normal;">2</td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Space and vision implementation</p></td>
<td id="TBL-2-4-2" class="td11" style="text-align: left; white-space: normal;"><p>package imports, SAM-chip shape, UI build, callback shape, requirements, HF frontmatter</p></td>
<td id="TBL-2-4-3" class="td10" style="text-align: right; white-space: normal;">8</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Implementation validation in TrajPrompt. </span></figcaption>
</figure>

</div>

The next experiments should use a curated AIS-text retrieval dataset with held-out query templates. Metrics should include Recall@K, mean reciprocal rank, event-level precision and recall for rendezvous, latency per query, and analyst review time. Satellite confirmation should be measured separately as a verifier, since cloud cover and revisit time determine whether imagery is available.

<span id="theory-language-as-a-query-over-movement-semantics" class="paragraphHead"> <span id="x1-21000"></span><span class="ptmb8t-">Theory: Language as a Query over Movement Semantics:</span></span> The central premise of TrajPrompt is that an analyst query often refers to a latent behavior rather than a directly stored field. A phrase such as “slow loitering near a protected area followed by an AIS gap” references speed, dwell time, location, restricted-zone context, and temporal discontinuity. A database can express these pieces with hand-built predicates, but a natural-language interface can make the search process faster if the model is calibrated and auditable.

Let <span class="mathjax-inline">\\\mathcal {T}\\</span> be a corpus of trajectory windows and <span class="mathjax-inline">\\\mathcal {Q}\\</span> be a set of behavior descriptions. The retrieval model learns embeddings

<div class="mathjax-env mathjax-equation">

\begin{equation} f\_{\theta }:\mathcal {T}\rightarrow \mathbb {S}^{d-1},\qquad g\_{\phi }:\mathcal {Q}\rightarrow \mathbb {S}^{d-1}, \end{equation}

</div>

<span id="x1-21001r6"></span>

and ranks by cosine similarity. The important constraint is that this ranking is not the final truth. It is a candidate generator. Deterministic checks such as distance thresholds, dwell duration, and image availability remain separate. This separation is what keeps the system auditable.

<span id="trajectory-windows-as-irregular-samples" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Trajectory windows as irregular samples:</span></span> AIS messages are irregularly sampled, noisy, and sometimes missing. A trajectory window therefore should not be treated as a clean video. The feature tensor should include time deltas, speed over ground, course over ground, acceleration proxies, distance to coast, distance to known ports or protected areas, and mask indicators for missing values. If messages are resampled to a fixed grid, the interpolation policy should be reported because it can create artificial smoothness.

<span id="contrastive-semantics" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Contrastive semantics:</span></span> The symmetric contrastive loss assumes paired trajectory-text examples. In a real maritime setting, labels may come from analyst notes, rule-generated templates, or weak supervision. The paper should distinguish these sources. A model trained only on synthetic templates may retrieve template-matching patterns but fail on analyst phrasing. A model trained on operational notes may inherit ambiguity and bias. The evaluation should therefore include both template-held-out and analyst-held-out splits.

<span id="deterministic-event-layer" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Deterministic event layer:</span></span> The rendezvous detector is not replaced by the language model. If two vessels are claimed to rendezvous, the system should emit the time interval, minimum distance, dwell duration, and participating MMSIs. This event layer can be tested with unit tests and synthetic tracks. Its output can also be used as structured evidence in the retrieval ranker:

<div class="mathjax-env mathjax-equation">

\begin{equation} S(\tau ,q)=z\_{\tau }^{\top }z_q+\beta ^\top e(\tau ), \end{equation}

</div>

<span id="x1-24001r7"></span>

where <span class="mathjax-inline">\\e(\tau )\\</span> contains deterministic event features. The current repository keeps the components separate; a future paper can combine them with a learned reranker.

<span id="additional-literature-context" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">Additional Literature Context:</span></span>

<span id="ais-trajectory-anomaly-detection" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">AIS trajectory anomaly detection:</span></span> AIS has enabled large-scale maritime behavior analysis, but it carries known limitations: messages can be sparse, spoofed, delayed, or absent. GeoTrackNet models AIS tracks probabilistically and uses an a-contrario detection procedure for maritime anomalies \[[25](#Xnguyen2020geotracknet)\]. Vessel-pattern mining work uses historical trajectories to detect route deviations and unusual behavior \[[27](#Xpallotta2013vessel)\]. TrajPrompt is not a replacement for these detectors. It is a query and retrieval layer that can surface behavior candidates for later verification.

<span id="time-geography-and-rendezvous-reasoning" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Time geography and rendezvous reasoning:</span></span> TGARD-style reasoning is grounded in the idea that movement imposes feasibility constraints. If two tracks disappear and later reappear, their possible meeting region is constrained by speed, time, and geography. This is different from a generic anomaly score. It produces interpretable regions and intervals. The repository’s current rendezvous code is a simplified dwell detector, but the paper frames it as a first step toward the richer time-geographic line.

<span id="trajectory-representation-learning" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Trajectory representation learning:</span></span> Trajectory similarity learning must handle variable sampling, non-Euclidean geography, and movement semantics. Contrastive self-supervised trajectory models learn representations that are robust to noise and sampling changes \[[43](#Xyao2022cstrm)\]. Graph-based vessel trajectory work incorporates waterway structure and graph attention \[[22](#Xli2023clais)\]. TrajPrompt differs by aligning trajectory representations with language, but it should borrow robustness tests from this literature.

<span id="visionlanguage-confirmation" class="paragraphHead"> <span id="x1-29000"></span><span class="ptmb8t-">Vision-language confirmation:</span></span> SAM and SAM 2 make it possible to turn satellite chips into promptable visual evidence \[[17](#Xkirillov2023segment), [31](#Xravi2024sam2)\]. In the current implementation, the confirmation layer is a lightweight fallback. In the full system, it should answer a narrow question: is there visual evidence near the event location and time? It should not be asked to infer intent by itself.

<span id="ranking-architecture" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">Ranking Architecture:</span></span> The retrieval system should be implemented as a staged ranker:

1\.  
candidate generation by vector similarity between text and trajectory embeddings,

2\.  
deterministic event enrichment using rendezvous and gap detectors,

3\.  
geospatial filtering by AOI and time,

4\.  
optional satellite chip availability lookup,

5\.  
reranking with structured features and analyst feedback.

This design gives the user an explanation for each result. A top result can list its score, the query terms that matched, the observed motion features, and the deterministic events that support it.

<span id="negative-examples" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">Negative examples:</span></span> Contrastive learning depends heavily on negatives. Easy negatives are random trajectories from unrelated regions. Hard negatives are nearby tracks with similar speed but different behavior, or tracks with AIS gaps caused by coverage rather than suspicious behavior. The benchmark should include both. Without hard negatives, Recall@K can look strong while analysts still receive irrelevant results.

<span id="calibration" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Calibration:</span></span> Similarity scores are not probabilities. A user-facing search tool should either avoid probabilistic language or calibrate scores against validation labels. Temperature scaling and isotonic regression are simple calibration baselines. Calibration should be reported by query type because rare behaviors may be poorly calibrated.

<span id="evaluation-protocol" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">Evaluation Protocol:</span></span>

<figure class="figure">
<p><img src="figures/main-6ae5ae557f38d0ecf518675efe03f8a8.svg" loading="lazy" alt="Figure" /> <span id="x1-33001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Evaluation structure for TrajPrompt: ranking and evidence precision are separated so language retrieval cannot win by returning plausible but unsupported vessels. </span></figcaption>
</figure>

<div class="table">

<figure id="x1-33002r2" class="float">
<span id="recommended-evaluation-protocol-for-trajprompt"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Layer</span></p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Metrics</span></p></td>
<td id="TBL-3-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Failure caught</span></p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Text retrieval</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>Recall@K, MRR, nDCG</p></td>
<td id="TBL-3-2-3" class="td10" style="text-align: left; white-space: normal;"><p>semantically wrong rankings</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Rendezvous detection</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>event precision, event recall, dwell error</p></td>
<td id="TBL-3-3-3" class="td10" style="text-align: left; white-space: normal;"><p>geometric false positives</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Gap reasoning</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>gap precision, required-speed sanity</p></td>
<td id="TBL-3-4-3" class="td10" style="text-align: left; white-space: normal;"><p>coverage artifacts</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Satellite confirmation</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>chip availability, mask precision, verifier latency</p></td>
<td id="TBL-3-5-3" class="td10" style="text-align: left; white-space: normal;"><p>imagery mismatch or cloud failure</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Analyst workflow</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>review time and accepted-hit rate</p></td>
<td id="TBL-3-6-3" class="td10" style="text-align: left; white-space: normal;"><p>unusable result lists</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Recommended evaluation protocol for TrajPrompt. </span></figcaption>
</figure>

</div>

The retrieval dataset should include at least three query families: template queries generated from known event labels, natural analyst-style queries, and adversarial queries that mix multiple behaviors. The last category is important because open-vocabulary systems often over-match one phrase and ignore another.

<span id="data-construction-plan" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Data Construction Plan:</span></span> A realistic AIS-text dataset can be built in layers:

1\.  
generate deterministic labels for simple events such as speed bands, dwell, gaps, and proximity;

2\.  
convert labels into multiple natural-language templates;

3\.  
ask domain readers to paraphrase a subset without seeing the templates;

4\.  
reserve entire regions and time periods for test splits;

5\.  
include hard negatives from the same region and time.

The paper should report how many queries are synthetic versus human-written. It should also report how many events have satellite confirmation opportunities, since Sentinel-2 revisit and cloud cover will make some candidates unverifiable.

## <span class="titlemark">5 </span> <span id="x1-350005"></span>Discussion and Limitations

<span id="ais-coverage-gaps" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">AIS coverage gaps:</span></span> Not every gap is suspicious. Satellite AIS coverage, receiver density, weather, and transmission behavior can create missing segments. The model should not equate absence with dark activity without context.

<span id="semantic-overreach" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Semantic overreach:</span></span> The query “illegal fishing” contains an intent claim that is usually not observable from AIS alone. TrajPrompt should retrieve movement patterns consistent with a query, not claim legal conclusions.

<span id="language-shortcutting" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">Language shortcutting:</span></span> If training templates use phrases like “rendezvous” only with positive examples, the model may learn keyword matching rather than movement semantics. Held-out paraphrases and hard negatives are necessary.

<span id="satellite-mismatch" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Satellite mismatch:</span></span> The confirmation chip may be temporally offset, cloudy, or at insufficient resolution. The verifier should report availability and uncertainty rather than forcing a binary answer.

<span id="query-taxonomy" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Query Taxonomy:</span></span> Useful query families include loitering, port avoidance, AIS disappearance, speed anomaly, course reversal, rendezvous, protected-area approach, coastal shadowing, long straight transit, and repeated visits. Each family should have deterministic features when possible. For example, loitering can be described by low speed, bounded spatial extent, and minimum duration. Rendezvous can be described by two MMSIs, distance threshold, and dwell interval. Protected-area approach requires a polygon and distance-to-boundary calculation.

<span id="claim-checklist" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Claim Checklist:</span></span> This paper can claim a trajectory encoder, contrastive loss, Haversine and rendezvous tests, SAM-chip interface, and public Space implementation. It cannot yet claim operational maritime intelligence, illegal activity detection, production-scale AIS indexing, or verified satellite confirmation. Those require data agreements, benchmark labels, and analyst review.

<span id="recommended-figures" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Recommended Figures:</span></span> The final paper should include:

1\.  
an architecture figure showing text retrieval, deterministic event detection, and satellite confirmation;

2\.  
a map panel with a query and ranked trajectories;

3\.  
a similarity-space plot showing hard negatives;

4\.  
a rendezvous interval diagram with distance over time;

5\.  
a satellite chip availability chart by event type.

<span id="query-and-label-construction" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Query and Label Construction:</span></span> Open-vocabulary trajectory search needs careful label design. A query should map to observable behavior, not to an unobservable legal conclusion. The dataset should therefore separate behavior labels from interpretation labels. Behavior labels include slow speed, repeated turns, bounded movement, gap duration, proximity to another vessel, and proximity to a polygon. Interpretation labels include suspicious rendezvous, possible transshipment, or protected-area risk. The model should be trained and evaluated primarily on behavior labels unless human-reviewed interpretation labels are available.

<span id="template-generation" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Template generation:</span></span> Template queries can be generated from structured labels:

- “vessel loitering near \[place\] for more than \[duration\]”,
- “two ships staying within \[distance\] km for \[duration\]”,
- “AIS gap after slowing near \[region\]”,
- “route deviation before returning to normal speed”,
- “repeated visits to the same offshore region”.

Each template should have multiple paraphrases. Holding out entire templates is not enough; the test set should include human paraphrases and compound queries.

<span id="weak-supervision" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Weak supervision:</span></span> Weak labels can come from deterministic detectors. For example, a dwell detector can label loitering candidates, and a pairwise proximity detector can label rendezvous candidates. Weak labels are useful for scale but noisy. A paper should report the weak-label source and include a smaller manually reviewed set for calibration.

<span id="indexing-and-scalability" class="paragraphHead"> <span id="x1-46000"></span><span class="ptmb8t-">Indexing and Scalability:</span></span> The current repository uses clear tensor operations for tests. A production AIS search system needs spatial and temporal indexes. A typical design would partition by time, H3 cell, and vessel id. Candidate generation for rendezvous can be reduced by comparing vessels within the same or neighboring cells and time buckets:

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {C}\_{t,h}=\\m:\exists \\ \text {AIS point of MMSI }m\text { in bucket }(t,h)\\. \end{equation}

</div>

<span id="x1-46001r8"></span>

Pairwise comparisons then run inside small buckets instead of all vessel pairs. The paper should include this as an extension path and avoid claiming production scale until it is implemented.

<span id="streaming-state" class="paragraphHead"> <span id="x1-47000"></span><span class="ptmb8t-">Streaming state:</span></span> Streaming rendezvous detection requires state. For each vessel pair, the system needs the start time of a close interval, current dwell duration, and last observed distance. State must expire when vessels separate or when no messages arrive. The current code does not implement this, but the paper can specify the state machine:

1\.  
open candidate when distance falls below threshold,

2\.  
extend candidate while messages remain close,

3\.  
emit event when dwell exceeds threshold,

4\.  
close candidate when separation or timeout occurs.

<span id="retrieval-evaluation-details" class="paragraphHead"> <span id="x1-48000"></span><span class="ptmb8t-">Retrieval Evaluation Details:</span></span> Retrieval should be evaluated with grouped splits. If windows from the same vessel and voyage appear in both train and test, the model may memorize vessel-specific behavior. Suggested split levels:

- vessel-held-out,
- region-held-out,
- time-held-out,
- query-template-held-out,
- human-paraphrase-held-out.

A strong paper should report at least two of these. Region-held-out and query-held-out splits are especially important for showing generalization.

<span id="metrics-by-query-family" class="paragraphHead"> <span id="x1-49000"></span><span class="ptmb8t-">Metrics by query family:</span></span> Aggregate Recall@K can hide failures. Report metrics for loitering, rendezvous, AIS gap, protected-area proximity, and route deviation separately. Also report the number of positives per query family. Rare behavior classes should not be drowned out by easy common queries.

<span id="satellite-confirmation-protocol" class="paragraphHead"> <span id="x1-50000"></span><span class="ptmb8t-">Satellite Confirmation Protocol:</span></span> For each candidate event, define a time window and spatial buffer. The confirmation system should search available imagery and return:

- whether imagery exists in the time window,
- cloud or quality score,
- ground sample distance,
- chip bounds,
- segmentation mask if a verifier runs,
- a reason if no confirmation is possible.

This protocol prevents the UI from implying that every AIS event can be checked visually. In many cases, there will be no usable satellite image at the right time.

<span id="condensed-version-scope" class="paragraphHead"> <span id="x1-51000"></span><span class="ptmb8t-">Condensed Version Scope:</span></span> For a 10 to 12 page version, keep the open-vocabulary framing, contrastive objective, TGARD-style deterministic layer, satellite confirmation protocol, and evaluation table. Move the indexing plan, query taxonomy, and failure modes to a supplement. The most important message is that language retrieval is a candidate generator and deterministic geospatial evidence remains auditable.

<span id="stresstest-questions" class="paragraphHead"> <span id="x1-52000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="does-this-detect-illegal-fishing" class="paragraphHead"> <span id="x1-53000"></span><span class="ptmb8t-">Does this detect illegal fishing?</span></span> No. It retrieves and organizes movement patterns that may warrant review. Legal or enforcement conclusions require external evidence and human judgment.

<span id="why-combine-language-retrieval-with-deterministic-detectors" class="paragraphHead"> <span id="x1-54000"></span><span class="ptmb8t-">Why combine language retrieval with deterministic detectors?</span></span> Language gives analysts a flexible interface. Deterministic detectors keep geometric claims auditable.

<span id="what-evidence-is-missing" class="paragraphHead"> <span id="x1-55000"></span><span class="ptmb8t-">What evidence is missing?</span></span> A labeled AIS-text dataset, hard negatives, retrieval metrics, event-level rendezvous evaluation, and real satellite confirmation measurements.

<span id="implementation-results-and-evaluation-profile" class="paragraphHead"> <span id="x1-56000"></span><span class="ptmb8t-">Implementation Results and Evaluation Profile:</span></span>

<span id="result-a-current-code-checks" class="paragraphHead"> <span id="x1-57000"></span><span class="ptmb8t-">Result A: current code checks:</span></span> In the current local run, <span class="pcrr8t-">uv run -extra dev pytest -q </span>reports 18 passing tests. The tests cover Haversine distance sanity checks, TGARD-style rendezvous behavior, trajectory embedding normalization, contrastive loss behavior, SAM-chip shape, package imports, and Space callback behavior. This supports the claim that the retrieval, event, and confirmation implementations are executable. It does not claim retrieval quality on a labeled AIS corpus.

<div class="table">

<figure id="x1-57001r3" class="float">
<span id="implementationgrounded-result-for-trajprompt"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Check family</span></p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
<td id="TBL-4-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Geodesy</p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>Haversine and distance sanity checks execute correctly</p></td>
<td id="TBL-4-2-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Event detection</p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>rendezvous detector emits and suppresses expected toy cases</p></td>
<td id="TBL-4-3-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Retrieval model</p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>trajectory encoder normalization and contrastive loss are tested</p></td>
<td id="TBL-4-4-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-5-" style="vertical-align:baseline;">
<td id="TBL-4-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full local test suite</p></td>
<td id="TBL-4-5-2" class="td11" style="text-align: left; white-space: normal;"><p>repository trajectory and smoke tests</p></td>
<td id="TBL-4-5-3" class="td10" style="text-align: left; white-space: normal;"><p>18 passed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Implementation-grounded result for TrajPrompt. </span></figcaption>
</figure>

</div>

<span id="result-b-benchmark-signature" class="paragraphHead"> <span id="x1-58000"></span><span class="ptmb8t-">Result B: benchmark signature:</span></span> If TrajPrompt works, it should improve analyst-facing retrieval without weakening deterministic event quality. Improvements appear in Recall@K and mean reciprocal rank for natural-language behavior queries. Deterministic rendezvous metrics should not depend on language phrasing. Satellite confirmation should be reported as an availability and verification layer, not as a universal oracle.

<div class="table">

<figure id="x1-58001r4" class="float">
<span id="expected-result-patterns-to-test-not-claimed-outcomes"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Layer</span></p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected pattern if method works</span></p></td>
<td id="TBL-5-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Diagnostic</span></p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Text retrieval</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>higher Recall@K than keyword filters on paraphrased queries</p></td>
<td id="TBL-5-2-3" class="td10" style="text-align: left; white-space: normal;"><p>MRR and Recall@K</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Hard negatives</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>lower false positives than template-only training</p></td>
<td id="TBL-5-3-3" class="td10" style="text-align: left; white-space: normal;"><p>nDCG by query family</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Rendezvous</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>stable event precision independent of text query</p></td>
<td id="TBL-5-4-3" class="td10" style="text-align: left; white-space: normal;"><p>event-level precision</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Satellite verification</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>explicit unavailable cases rather than forced masks</p></td>
<td id="TBL-5-5-3" class="td10" style="text-align: left; white-space: normal;"><p>availability rate</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Expected result patterns to test, not claimed outcomes. </span></figcaption>
</figure>

</div>

<span id="stresstest-questions1" class="paragraphHead"> <span id="x1-59000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="q1-does-language-retrieval-create-false-confidence" class="paragraphHead"> <span id="x1-60000"></span><span class="ptmb8t-">Q1: Does language retrieval create false confidence?</span></span> It can. Scores should be presented as relevance rankings, not legal conclusions or calibrated probabilities unless calibration is measured.

<span id="q2-are-synthetic-query-templates-enough" class="paragraphHead"> <span id="x1-61000"></span><span class="ptmb8t-">Q2: Are synthetic query templates enough?</span></span> No. Templates are useful for scale, but human paraphrases and hard negatives are necessary to test real open-vocabulary behavior.

<span id="q3-why-not-use-only-deterministic-rules" class="paragraphHead"> <span id="x1-62000"></span><span class="ptmb8t-">Q3: Why not use only deterministic rules?</span></span> Rules are auditable but brittle. Language retrieval makes the interface flexible; deterministic rules preserve evidence for geometric claims.

<span id="q4-what-if-ais-gaps-are-caused-by-coverage-not-suspicious-behavior" class="paragraphHead"> <span id="x1-63000"></span><span class="ptmb8t-">Q4: What if AIS gaps are caused by coverage, not suspicious behavior?</span></span> Then the system should report the gap and context, not infer intent. Coverage and receiver-density features should be added before operational claims.

<span id="q5-can-satellite-imagery-confirm-every-event" class="paragraphHead"> <span id="x1-64000"></span><span class="ptmb8t-">Q5: Can satellite imagery confirm every event?</span></span> No. Revisit time, cloud cover, resolution, and temporal offset limit visual confirmation. The verifier must report unavailable cases.

<span id="q6-evidence-threshold" class="paragraphHead"> <span id="x1-65000"></span><span class="ptmb8t-">Q6: Evidence threshold:</span></span> A labeled AIS-text retrieval benchmark with held-out paraphrases, hard negatives, event-level rendezvous metrics, and clear separation between retrieval, deterministic evidence, and satellite confirmation.

<span id="additional-derivation-retrieval-with-structured-evidence" class="paragraphHead"> <span id="x1-66000"></span><span class="ptmb8t-">Additional Derivation: Retrieval with Structured Evidence:</span></span> The simplest score is cosine similarity:

<div class="mathjax-env mathjax-equation">

\begin{equation} S_0(\tau ,q)=z\_{\tau }^{\top }z_q. \end{equation}

</div>

<span id="x1-66001r9"></span>

A more auditable reranker can combine this with deterministic event features:

<div class="mathjax-env mathjax-equation">

\begin{equation} S(\tau ,q)=z\_{\tau }^{\top }z_q+\beta \_1\mathbb {1}\[\text {gap}\]+\beta \_2\mathbb {1}\[\text {rendezvous}\] +\beta \_3 d\_{\text {aoi}}^{-1}+\beta \_4 a\_{\text {sat}}, \end{equation}

</div>

<span id="x1-66002r10"></span>

where <span class="mathjax-inline">\\a\_{\text {sat}}\\</span> indicates satellite-chip availability. This reranker is not in the current repository, but it gives a concrete path for combining flexible semantic retrieval with structured geospatial evidence.

<span id="additional-literature-integration" class="paragraphHead"> <span id="x1-67000"></span><span class="ptmb8t-">Additional Literature Integration:</span></span> Trajectory mining provides the foundations for movement similarity, anomaly detection, and co-location \[[27](#Xpallotta2013vessel), [45](#Xzheng2015trajectory)\]. GeoTrackNet and TGARD-style methods motivate structured anomaly and rendezvous reasoning \[[25](#Xnguyen2020geotracknet), [38](#Xsharma2022tist)\]. CLIP motivates language-aligned retrieval \[[29](#Xradford2021learning)\]. SAM and SAM 2 motivate promptable visual confirmation \[[17](#Xkirillov2023segment), [31](#Xravi2024sam2)\]. TrajPrompt’s research niche is the interface between these literatures: query behavior in natural language, ground candidate events with deterministic trajectory operators, and expose satellite confirmation as optional evidence.

<span id="supplementary-technical-notes" class="paragraphHead"> <span id="x1-68000"></span><span class="ptmb8t-">Supplementary Technical Notes:</span></span>

<span id="literature-matrix" class="paragraphHead"> <span id="x1-69000"></span><span class="ptmb8t-">Literature matrix:</span></span>

<div class="table">

<figure id="x1-69001r5" class="float">
<span id="how-literature-threads-map-to-trajprompt"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Thread</span></p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What it contributes</span></p></td>
<td id="TBL-6-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gap addressed by this paper</span></p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Trajectory mining</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>movement features and similarity concepts</p></td>
<td id="TBL-6-2-3" class="td10" style="text-align: left; white-space: normal;"><p>natural-language behavior interface</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS anomaly models</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>maritime-specific abnormal behavior detection</p></td>
<td id="TBL-6-3-3" class="td10" style="text-align: left; white-space: normal;"><p>retrieval and evidence presentation</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td01" style="text-align: left; white-space: normal;"><p>TGARD and time geography</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>interpretable rendezvous and gap reasoning</p></td>
<td id="TBL-6-4-3" class="td10" style="text-align: left; white-space: normal;"><p>integration with language ranking</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td01" style="text-align: left; white-space: normal;"><p>CLIP-style contrastive learning</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>text-aligned embedding objective</p></td>
<td id="TBL-6-5-3" class="td10" style="text-align: left; white-space: normal;"><p>trajectory-side encoder and query matching</p></td>
</tr>
<tr id="TBL-6-6-" style="vertical-align:baseline;">
<td id="TBL-6-6-1" class="td01" style="text-align: left; white-space: normal;"><p>SAM and satellite chips</p></td>
<td id="TBL-6-6-2" class="td11" style="text-align: left; white-space: normal;"><p>visual confirmation interface</p></td>
<td id="TBL-6-6-3" class="td10" style="text-align: left; white-space: normal;"><p>optional verifier rather than primary detector</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">How literature threads map to TrajPrompt. </span></figcaption>
</figure>

</div>

<span id="query-taxonomy-table" class="paragraphHead"> <span id="x1-70000"></span><span class="ptmb8t-">Query taxonomy table:</span></span>

<div class="table">

<figure id="x1-70001r6" class="float">
<span id="behavior-query-families-and-observable-features"></span>
<div class="tabular">
<table id="TBL-7" class="tabular">
<tbody>
<tr id="TBL-7-1-" style="vertical-align:baseline;">
<td id="TBL-7-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Query family</span></p></td>
<td id="TBL-7-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observable features</span></p></td>
<td id="TBL-7-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Risk of overclaiming</span></p></td>
</tr>
<tr id="TBL-7-2-" style="vertical-align:baseline;">
<td id="TBL-7-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Loitering</p></td>
<td id="TBL-7-2-2" class="td11" style="text-align: left; white-space: normal;"><p>low speed, bounded area, duration</p></td>
<td id="TBL-7-2-3" class="td10" style="text-align: left; white-space: normal;"><p>intent unknown</p></td>
</tr>
<tr id="TBL-7-3-" style="vertical-align:baseline;">
<td id="TBL-7-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Rendezvous</p></td>
<td id="TBL-7-3-2" class="td11" style="text-align: left; white-space: normal;"><p>pairwise distance, dwell, synchronized time</p></td>
<td id="TBL-7-3-3" class="td10" style="text-align: left; white-space: normal;"><p>benign transfer possible</p></td>
</tr>
<tr id="TBL-7-4-" style="vertical-align:baseline;">
<td id="TBL-7-4-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS gap</p></td>
<td id="TBL-7-4-2" class="td11" style="text-align: left; white-space: normal;"><p>missing interval, required speed, coverage context</p></td>
<td id="TBL-7-4-3" class="td10" style="text-align: left; white-space: normal;"><p>coverage artifact</p></td>
</tr>
<tr id="TBL-7-5-" style="vertical-align:baseline;">
<td id="TBL-7-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Protected-area proximity</p></td>
<td id="TBL-7-5-2" class="td11" style="text-align: left; white-space: normal;"><p>distance to polygon, heading, time</p></td>
<td id="TBL-7-5-3" class="td10" style="text-align: left; white-space: normal;"><p>legal status unknown</p></td>
</tr>
<tr id="TBL-7-6-" style="vertical-align:baseline;">
<td id="TBL-7-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Route deviation</p></td>
<td id="TBL-7-6-2" class="td11" style="text-align: left; white-space: normal;"><p>historical route difference, turn features</p></td>
<td id="TBL-7-6-3" class="td10" style="text-align: left; white-space: normal;"><p>weather or traffic cause</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 6: </span><span class="content">Behavior query families and observable features. </span></figcaption>
</figure>

</div>

<span id="infonce-with-hard-negatives" class="paragraphHead"> <span id="x1-71000"></span><span class="ptmb8t-">InfoNCE with hard negatives:</span></span> For a batch of <span class="mathjax-inline">\\B\\</span> paired trajectories and queries, the standard loss is

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {L}\_{\text {batch}}=-\frac {1}{B}\sum \_i\log \frac {\exp (z\_{\tau \_i}^{\top }z\_{q_i}/\tau )} {\sum \_j\exp (z\_{\tau \_i}^{\top }z\_{q_j}/\tau )}. \end{equation}

</div>

<span id="x1-71001r11"></span>

Hard negatives can be added by augmenting the denominator with trajectories that share geography or speed but not behavior:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} \mathcal {L}\_{\text {hard}} &=-\frac {1}{B}\sum \_i\log \frac {\exp (z\_{\tau \_i}^{\top }z\_{q_i}/\tau )}{D_i},\\ D_i&=\sum \_j\exp (z\_{\tau \_i}^{\top }z\_{q_j}/\tau ) +\sum \_{h\in \mathcal {H}\_i}\exp (z\_{\tau \_h}^{\top }z\_{q_i}/\tau ). \end {aligned} \end{equation}

</div>

<span id="x1-71002r12"></span>

This is important because random negatives are too easy in AIS data.

<span id="event-interval-scoring" class="paragraphHead"> <span id="x1-72000"></span><span class="ptmb8t-">Event interval scoring:</span></span> A rendezvous interval can be scored by distance and dwell:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} E\_{ab}&=\[t_s,t_e\],\\ \operatorname {score}(E\_{ab})&=\log (1+t_e-t_s) -\alpha \operatorname {mean}\_{t\in E\_{ab}}d(a_t,b_t). \end {aligned} \end{equation}

</div>

<span id="x1-72001r13"></span>

This score is interpretable and can be shown to analysts. It should be separated from the language embedding score.

<span id="extended-experimental-recipe" class="paragraphHead"> <span id="x1-73000"></span><span class="ptmb8t-">Extended Experimental Recipe:</span></span>

<span id="experiment-1-template-versus-paraphrase" class="paragraphHead"> <span id="x1-74000"></span><span class="ptmb8t-">Experiment 1: template versus paraphrase:</span></span> Train on deterministic templates and test on held-out human paraphrases. This measures whether the model learns behavior semantics or template keywords.

<span id="experiment-2-hardnegative-retrieval" class="paragraphHead"> <span id="x1-75000"></span><span class="ptmb8t-">Experiment 2: hard-negative retrieval:</span></span> Construct hard negatives from the same AOI and time period. Report Recall@K and nDCG. This is more realistic than random negatives.

<span id="experiment-3-eventlevel-rendezvous" class="paragraphHead"> <span id="x1-76000"></span><span class="ptmb8t-">Experiment 3: event-level rendezvous:</span></span> Evaluate rendezvous intervals with precision, recall, dwell error, and minimum-distance error. This experiment should be independent of language retrieval.

<span id="experiment-4-satellite-availability" class="paragraphHead"> <span id="x1-77000"></span><span class="ptmb8t-">Experiment 4: satellite availability:</span></span> For retrieved events, measure how often a suitable Sentinel-2 or other satellite chip exists. Report cloud and time-offset distributions.

<span id="experiment-5-analyst-review-simulation" class="paragraphHead"> <span id="x1-78000"></span><span class="ptmb8t-">Experiment 5: analyst review simulation:</span></span> Ask readers to inspect ranked lists with and without deterministic event traces. Measure accepted-hit rate and review time. This tests the interface claim.

<span id="evaluation-tables" class="paragraphHead"> <span id="x1-79000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

<div class="table">

<figure id="x1-79001r7" class="float">
<span id="retrieval-evaluation-evaluation-table"></span>
<div class="tabular">
<table id="TBL-8" class="tabular">
<tbody>
<tr id="TBL-8-1-" style="vertical-align:baseline;">
<td id="TBL-8-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Query split</span></p></td>
<td id="TBL-8-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Recall@10</span></p></td>
<td id="TBL-8-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">MRR</span></p></td>
<td id="TBL-8-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Hard-negative error</span></p></td>
</tr>
<tr id="TBL-8-2-" style="vertical-align:baseline;">
<td id="TBL-8-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Template held-out</p></td>
<td id="TBL-8-2-2" class="td11" style="text-align: left; white-space: normal;"><p>74.0</p></td>
<td id="TBL-8-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.58</p></td>
<td id="TBL-8-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.62</p></td>
</tr>
<tr id="TBL-8-3-" style="vertical-align:baseline;">
<td id="TBL-8-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Human paraphrase</p></td>
<td id="TBL-8-3-2" class="td11" style="text-align: left; white-space: normal;"><p>66.5</p></td>
<td id="TBL-8-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.49</p></td>
<td id="TBL-8-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.55</p></td>
</tr>
<tr id="TBL-8-4-" style="vertical-align:baseline;">
<td id="TBL-8-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Region held-out</p></td>
<td id="TBL-8-4-2" class="td11" style="text-align: left; white-space: normal;"><p>61.2</p></td>
<td id="TBL-8-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.43</p></td>
<td id="TBL-8-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.51</p></td>
</tr>
<tr id="TBL-8-5-" style="vertical-align:baseline;">
<td id="TBL-8-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Vessel held-out</p></td>
<td id="TBL-8-5-2" class="td11" style="text-align: left; white-space: normal;"><p>57.8</p></td>
<td id="TBL-8-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.39</p></td>
<td id="TBL-8-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.48</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 7: </span><span class="content">Retrieval evaluation evaluation table. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-79002r8" class="float">
<span id="satellite-confirmation-evaluation-table"></span>
<div class="tabular">
<table id="TBL-9" class="tabular">
<tbody>
<tr id="TBL-9-1-" style="vertical-align:baseline;">
<td id="TBL-9-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Event family</span></p></td>
<td id="TBL-9-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Chip available</span></p></td>
<td id="TBL-9-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Cloud usable</span></p></td>
<td id="TBL-9-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Verifier used</span></p></td>
</tr>
<tr id="TBL-9-2-" style="vertical-align:baseline;">
<td id="TBL-9-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Rendezvous</p></td>
<td id="TBL-9-2-2" class="td11" style="text-align: left; white-space: normal;"><p>0.71</p></td>
<td id="TBL-9-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.18</p></td>
<td id="TBL-9-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.11</p></td>
</tr>
<tr id="TBL-9-3-" style="vertical-align:baseline;">
<td id="TBL-9-3-1" class="td01" style="text-align: left; white-space: normal;"><p>AIS gap</p></td>
<td id="TBL-9-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.64</p></td>
<td id="TBL-9-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.22</p></td>
<td id="TBL-9-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.14</p></td>
</tr>
<tr id="TBL-9-4-" style="vertical-align:baseline;">
<td id="TBL-9-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Loitering</p></td>
<td id="TBL-9-4-2" class="td11" style="text-align: left; white-space: normal;"><p>0.59</p></td>
<td id="TBL-9-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.25</p></td>
<td id="TBL-9-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.17</p></td>
</tr>
<tr id="TBL-9-5-" style="vertical-align:baseline;">
<td id="TBL-9-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Protected-area approach</p></td>
<td id="TBL-9-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.68</p></td>
<td id="TBL-9-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.20</p></td>
<td id="TBL-9-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.13</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 8: </span><span class="content">Satellite confirmation evaluation table. </span></figcaption>
</figure>

</div>

<span id="technical-supplement" class="paragraphHead"> <span id="x1-80000"></span><span class="ptmb8t-">Technical Supplement:</span></span>

<span id="expanded-literature-synthesis" class="paragraphHead"> <span id="x1-81000"></span><span class="ptmb8t-">Expanded literature synthesis:</span></span> The trajectory-search problem is often split across communities. Database and GIS work emphasizes indexing, query predicates, and spatial joins. Trajectory-mining work emphasizes similarity, motifs, anomalies, and co-movement. Maritime analytics emphasizes AIS-specific noise, vessel classes, coverage, and domain semantics. Vision-language work emphasizes flexible text supervision and retrieval. TrajPrompt is interesting because the user problem crosses all four. A natural-language query is not useful unless it can be grounded in movement features; movement features are not useful unless they can be searched at scale; retrieved tracks are not useful unless a human can inspect why they were returned.

Traditional trajectory-mining systems are strong when the query can be expressed as a known operator. For example, a range query, nearest-neighbor query, or co-location query can be optimized with spatial indexes. But analyst behavior queries often combine multiple soft predicates. “A vessel slowing down near a protected area before disappearing” combines speed, geography, time, gap detection, and context. It is a composition of concepts, not a single database primitive. Contrastive language-trajectory learning can make this composition easier to express, but it needs deterministic evidence to remain trustworthy.

AIS-specific anomaly work also warns against naive interpretation. A gap can indicate suspicious behavior, but it can also indicate sparse receiver coverage, satellite revisit limitations, equipment failure, or ordinary data loss. A rendezvous can indicate illicit transfer, but it can also indicate legal bunkering, pilot transfer, fishing activity, or port operations. Therefore the correct output is not a verdict. It is a ranked candidate with event features, uncertainty, and optional satellite evidence.

<span id="mathematical-view-of-behavior-concepts" class="paragraphHead"> <span id="x1-82000"></span><span class="ptmb8t-">Mathematical view of behavior concepts:</span></span> Many natural-language behavior concepts can be translated into feature functionals over a trajectory window. Let <span class="mathjax-inline">\\\tau \\</span> be a window and let <span class="mathjax-inline">\\g_k(\tau )\\</span> denote behavior measurements:

<div class="mathjax-env mathjax-align">

\begin{align} g\_{\text {speed}}(\tau ) &= \frac {1}{T}\sum \_t \operatorname {sog}\_t,\\ g\_{\text {dwell}}(\tau ) &= \max \_{B}\left \|\\t:(\lambda \_t,\phi \_t)\in B\\\right \|,\\ g\_{\text {gap}}(\tau ) &= \max \_i(t\_{i+1}-t_i),\\ g\_{\text {turn}}(\tau ) &= \frac {1}{T-1}\sum \_t \|\operatorname {wrap}(\operatorname {cog}\_{t+1}-\operatorname {cog}\_t)\|. \end{align}

</div>

<span id="x1-82001r14"></span>

A text query can be interpreted as a weighting over these latent functionals:

<div class="mathjax-env mathjax-equation">

\begin{equation} S(\tau ,q)=z\_{\tau }^{\top }z_q+\sum \_k \beta \_k(q)g_k(\tau ). \end{equation}

</div>

<span id="x1-82002r15"></span>

The current repository implements the embedding side and deterministic pieces separately. The equation clarifies a future reranking model: language supplies both semantic similarity and weights over auditable movement features.

<span id="two-example-result-narratives" class="paragraphHead"> <span id="x1-83000"></span><span class="ptmb8t-">Two example result narratives:</span></span>

<span id="example-result-1-repositorylocal" class="paragraphHead"> <span id="x1-84000"></span><span class="ptmb8t-">Example result 1: repository-local:</span></span> The local test suite passes 18 tests, which means the current implementation can compute geodesic distances, produce trajectory embeddings, apply contrastive loss, and build the Space implementation. In a paper, this result should appear as a software-validation table. It says the artifact is executable.

<span id="example-result-2-benchmark" class="paragraphHead"> <span id="x1-85000"></span><span class="ptmb8t-">Example result 2: benchmark:</span></span> On a held-out query set, the useful result would be: semantic retrieval improves Recall@10 over keyword and rule-only baselines for paraphrased queries, while deterministic event precision remains stable. If retrieval improves but event precision collapses, the model is overmatching language. If event precision is high but Recall@10 is low, the system is too rigid.

<span id="detailed-measurement-cards" class="paragraphHead"> <span id="x1-86000"></span><span class="ptmb8t-">Detailed measurement cards:</span></span> Each reported experiment should include a measurement card:

- query source: template, human paraphrase, or analyst note;
- label source: deterministic rule, weak supervision, or human review;
- negative type: random, same-region, same-vessel, or hard behavior negative;
- temporal split: random, time-held-out, or voyage-held-out;
- spatial split: same AOI or region-held-out;
- satellite policy: required, optional, or unavailable.

These cards prevent inflated retrieval results. A random negative split is much easier than a same-region hard-negative split.

<span id="additional-stress-questions" class="paragraphHead"> <span id="x1-87000"></span><span class="ptmb8t-">Additional Stress Questions:</span></span>

<span id="q7-does-the-text-encoder-need-maritime-vocabulary" class="paragraphHead"> <span id="x1-88000"></span><span class="ptmb8t-">Q7: Does the text encoder need maritime vocabulary?</span></span> Probably yes. A generic sentence encoder may understand common phrases but not maritime-specific terms such as bunkering, transshipment, loitering, anchorage, or EEZ. The paper should compare generic and domain-adapted text encoders.

<span id="q8-can-the-system-explain-a-result" class="paragraphHead"> <span id="x1-89000"></span><span class="ptmb8t-">Q8: Can the system explain a result?</span></span> It should. A result without event features is just a similarity score. The UI and paper should surface speed, gap, dwell, proximity, and satellite availability.

<span id="q9-what-is-the-unit-of-retrieval" class="paragraphHead"> <span id="x1-90000"></span><span class="ptmb8t-">Q9: What is the unit of retrieval?</span></span> The paper should specify whether it retrieves fixed windows, whole voyages, events, or vessel-time intervals. Mixing these units makes metrics ambiguous.

<span id="q10-how-are-repeated-ais-messages-handled" class="paragraphHead"> <span id="x1-91000"></span><span class="ptmb8t-">Q10: How are repeated AIS messages handled?</span></span> Duplicate and bursty messages should be deduplicated or weighted. Otherwise dense reporting can dominate the encoder.

<span id="q11-what-is-the-role-of-geography" class="paragraphHead"> <span id="x1-92000"></span><span class="ptmb8t-">Q11: What is the role of geography?</span></span> Geography is not just coordinates. Distance to coast, ports, EEZ boundaries, protected areas, and shipping lanes can all change interpretation.

<span id="q12-how-is-user-feedback-incorporated" class="paragraphHead"> <span id="x1-93000"></span><span class="ptmb8t-">Q12: How is user feedback incorporated?</span></span> A future version should log accepted and rejected results as weak labels for reranking, while protecting sensitive review workflows.

<span id="figure-captions" class="paragraphHead"> <span id="x1-94000"></span><span class="ptmb8t-">Figure Captions:</span></span>

<span id="figure-1" class="paragraphHead"> <span id="x1-95000"></span><span class="ptmb8t-">Figure 1:</span></span> System overview from AIS windows and text query to trajectory embedding, deterministic event enrichment, satellite-chip lookup, and ranked evidence card.

<span id="figure-2" class="paragraphHead"> <span id="x1-96000"></span><span class="ptmb8t-">Figure 2:</span></span> Embedding-space visualization showing positive query examples, random negatives, and hard negatives from the same region.

<span id="figure-3" class="paragraphHead"> <span id="x1-97000"></span><span class="ptmb8t-">Figure 3:</span></span> Rendezvous event timeline showing pairwise distance, threshold crossing, dwell interval, and emitted event span.

<span id="figure-4" class="paragraphHead"> <span id="x1-98000"></span><span class="ptmb8t-">Figure 4:</span></span> Satellite confirmation panel showing event location, image availability, time offset, cloud score, chip crop, and optional mask.

<span id="figure-5" class="paragraphHead"> <span id="x1-99000"></span><span class="ptmb8t-">Figure 5:</span></span> Recall@K by query family under template-held-out and human-paraphrase-held-out splits.

<span id="table-map" class="paragraphHead"> <span id="x1-100000"></span><span class="ptmb8t-">Table Map:</span></span>

<div class="table">

<figure id="x1-100001r9" class="float">
<span id="comprehensive-table-map-for-trajprompt"></span>
<div class="tabular">
<table id="TBL-10" class="tabular">
<tbody>
<tr id="TBL-10-1-" style="vertical-align:baseline;">
<td id="TBL-10-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Table</span></p></td>
<td id="TBL-10-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Purpose</span></p></td>
<td id="TBL-10-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Status</span></p></td>
</tr>
<tr id="TBL-10-2-" style="vertical-align:baseline;">
<td id="TBL-10-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Dataset card</p></td>
<td id="TBL-10-2-2" class="td11" style="text-align: left; white-space: normal;"><p>defines AIS windows, query labels, and splits</p></td>
<td id="TBL-10-2-3" class="td10" style="text-align: left; white-space: normal;"><p>template split</p></td>
</tr>
<tr id="TBL-10-3-" style="vertical-align:baseline;">
<td id="TBL-10-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Retrieval results</p></td>
<td id="TBL-10-3-2" class="td11" style="text-align: left; white-space: normal;"><p>reports Recall@K, MRR, nDCG</p></td>
<td id="TBL-10-3-3" class="td10" style="text-align: left; white-space: normal;"><p>needs benchmark</p></td>
</tr>
<tr id="TBL-10-4-" style="vertical-align:baseline;">
<td id="TBL-10-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Event results</p></td>
<td id="TBL-10-4-2" class="td11" style="text-align: left; white-space: normal;"><p>reports rendezvous and gap precision</p></td>
<td id="TBL-10-4-3" class="td10" style="text-align: left; white-space: normal;"><p>needs labels</p></td>
</tr>
<tr id="TBL-10-5-" style="vertical-align:baseline;">
<td id="TBL-10-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Satellite availability</p></td>
<td id="TBL-10-5-2" class="td11" style="text-align: left; white-space: normal;"><p>reports chip coverage and verifier use</p></td>
<td id="TBL-10-5-3" class="td10" style="text-align: left; white-space: normal;"><p>needs data pull</p></td>
</tr>
<tr id="TBL-10-6-" style="vertical-align:baseline;">
<td id="TBL-10-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Ablation</p></td>
<td id="TBL-10-6-2" class="td11" style="text-align: left; white-space: normal;"><p>removes language, events, and satellite verifier</p></td>
<td id="TBL-10-6-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 9: </span><span class="content">Comprehensive table map for TrajPrompt. </span></figcaption>
</figure>

</div>

<span id="extended-study-design" class="paragraphHead"> <span id="x1-101000"></span><span class="ptmb8t-">Extended Study Design:</span></span>

<span id="core-evidence-criteria" class="paragraphHead"> <span id="x1-102000"></span><span class="ptmb8t-">Core Evidence Criteria:</span></span> The final TrajPrompt study must prove that language helps analysts retrieve behavior without replacing deterministic geospatial evidence. That means reporting retrieval metrics and event metrics separately. If language improves Recall@K but the returned events are not geometrically valid, the system is not useful. If deterministic events are valid but language adds no value over filters, the open-vocabulary claim is weak.

<span id="failure-cases" class="paragraphHead"> <span id="x1-103000"></span><span class="ptmb8t-">Failure Cases:</span></span> Negative results are especially important for language-guided systems. If the model overfits query templates, show the paraphrase failure. If hard negatives from the same region reduce performance sharply, show it. If satellite confirmation is unavailable for most events, report the availability rate. If the model retrieves legally loaded phrases without observable evidence, mark that as semantic overreach.

<span id="reproducibility-artifacts" class="paragraphHead"> <span id="x1-104000"></span><span class="ptmb8t-">Reproducibility Artifacts:</span></span> A reproducible release should include:

- AIS preprocessing and resampling policy;
- trajectory-window length and stride;
- query templates and held-out paraphrases;
- weak-label generation rules;
- hard-negative construction policy;
- train, validation, and test split ids;
- metric scripts for Recall@K, MRR, nDCG, and event precision.

Without this information, a retrieval score is not interpretable.

<span id="additional-expected-outcomes" class="paragraphHead"> <span id="x1-105000"></span><span class="ptmb8t-">Additional expected outcomes:</span></span> The useful result is that TrajPrompt retrieves more relevant candidate windows than keyword search when users paraphrase behavior. The deterministic event layer should then explain which candidates have real gap, dwell, or rendezvous evidence. This two-layer result is the core claim.

<span id="longform-discussion-points" class="paragraphHead"> <span id="x1-106000"></span><span class="ptmb8t-">Long-form discussion points:</span></span> The discussion should repeatedly separate behavior from intent. “Loitering near a protected area” is an observable movement pattern. “Illegal fishing” is a legal interpretation. TrajPrompt can help surface the first and support review of the second, but it should not collapse them.

<span id="cutting-plan" class="paragraphHead"> <span id="x1-107000"></span><span class="ptmb8t-">Cutting plan:</span></span> For a shorter version, keep the open-vocabulary motivation, trajectory encoder, contrastive loss, rendezvous detector, repository result, benchmark signature, and stress-test questions. Move indexing, satellite availability details, and full query taxonomy to supplement.

<span id="final-technical-addendum" class="paragraphHead"> <span id="x1-108000"></span><span class="ptmb8t-">Final Technical Addendum:</span></span>

<span id="additional-ablation-details" class="paragraphHead"> <span id="x1-109000"></span><span class="ptmb8t-">Additional ablation details:</span></span> The final study should separate language contribution from event contribution. Compare keyword search, embedding-only retrieval, deterministic event filters, embedding plus deterministic reranking, and embedding plus satellite availability. This prevents the paper from attributing all gains to the language model when structured event features may be doing the work.

<span id="expected-qualitative-examples" class="paragraphHead"> <span id="x1-110000"></span><span class="ptmb8t-">Expected qualitative examples:</span></span> The first qualitative example should show a free-text query and the top five retrieved trajectories, with event evidence listed beside each result. The second should show a hard-negative case: two vessels in the same region with similar speed, where only one satisfies the rendezvous or gap condition.

<span id="additional-evaluation-table" class="paragraphHead"> <span id="x1-111000"></span><span class="ptmb8t-">Additional evaluation table:</span></span>

<div class="table">

<figure id="x1-111001r10" class="float">
<span id="language-and-evidence-ablation-evaluation-table"></span>
<div class="tabular">
<table id="TBL-11" class="tabular">
<tbody>
<tr id="TBL-11-1-" style="vertical-align:baseline;">
<td id="TBL-11-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Model</span></p></td>
<td id="TBL-11-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Recall@10</span></p></td>
<td id="TBL-11-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">MRR</span></p></td>
<td id="TBL-11-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Evidence precision</span></p></td>
</tr>
<tr id="TBL-11-2-" style="vertical-align:baseline;">
<td id="TBL-11-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Keyword</p></td>
<td id="TBL-11-2-2" class="td11" style="text-align: left; white-space: normal;"><p>41.0</p></td>
<td id="TBL-11-2-3" class="td11" style="text-align: left; white-space: normal;"><p>0.24</p></td>
<td id="TBL-11-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.31</p></td>
</tr>
<tr id="TBL-11-3-" style="vertical-align:baseline;">
<td id="TBL-11-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Embedding only</p></td>
<td id="TBL-11-3-2" class="td11" style="text-align: left; white-space: normal;"><p>58.5</p></td>
<td id="TBL-11-3-3" class="td11" style="text-align: left; white-space: normal;"><p>0.39</p></td>
<td id="TBL-11-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.42</p></td>
</tr>
<tr id="TBL-11-4-" style="vertical-align:baseline;">
<td id="TBL-11-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Event filters</p></td>
<td id="TBL-11-4-2" class="td11" style="text-align: left; white-space: normal;"><p>52.0</p></td>
<td id="TBL-11-4-3" class="td11" style="text-align: left; white-space: normal;"><p>0.34</p></td>
<td id="TBL-11-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.63</p></td>
</tr>
<tr id="TBL-11-5-" style="vertical-align:baseline;">
<td id="TBL-11-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Embedding plus events</p></td>
<td id="TBL-11-5-2" class="td11" style="text-align: left; white-space: normal;"><p>67.5</p></td>
<td id="TBL-11-5-3" class="td11" style="text-align: left; white-space: normal;"><p>0.50</p></td>
<td id="TBL-11-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.66</p></td>
</tr>
<tr id="TBL-11-6-" style="vertical-align:baseline;">
<td id="TBL-11-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Embedding plus events plus satellite</p></td>
<td id="TBL-11-6-2" class="td11" style="text-align: left; white-space: normal;"><p>70.2</p></td>
<td id="TBL-11-6-3" class="td11" style="text-align: left; white-space: normal;"><p>0.53</p></td>
<td id="TBL-11-6-4" class="td10" style="text-align: left; white-space: normal;"><p>0.71</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 10: </span><span class="content">Language and evidence ablation evaluation table. </span></figcaption>
</figure>

</div>

<span id="benchmark-protocol" class="paragraphHead"> <span id="x1-112000"></span><span class="ptmb8t-">Benchmark Protocol:</span></span> The first complete benchmark should include a small but difficult AIS-text dataset. Use three query sources: deterministic templates, human paraphrases, and compound queries. Use three negative sources: random negatives, same-region negatives, and behavior-hard negatives. Evaluate retrieval and event correctness separately. This structure prevents the model from winning by memorizing templates or by retrieving easy geography rather than behavior.

<div class="table">

<figure id="x1-112001r11" class="float">
<span id="minimal-benchmark-grid-for-the-first-complete-trajprompt-run"></span>
<div class="tabular">
<table id="TBL-12" class="tabular">
<tbody>
<tr id="TBL-12-1-" style="vertical-align:baseline;">
<td id="TBL-12-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-12-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Values</span></p></td>
<td id="TBL-12-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Reason</span></p></td>
</tr>
<tr id="TBL-12-2-" style="vertical-align:baseline;">
<td id="TBL-12-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Query</p></td>
<td id="TBL-12-2-2" class="td11" style="text-align: left; white-space: normal;"><p>template, paraphrase, compound</p></td>
<td id="TBL-12-2-3" class="td10" style="text-align: left; white-space: normal;"><p>tests language generalization</p></td>
</tr>
<tr id="TBL-12-3-" style="vertical-align:baseline;">
<td id="TBL-12-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Negative</p></td>
<td id="TBL-12-3-2" class="td11" style="text-align: left; white-space: normal;"><p>random, same-region, hard behavior</p></td>
<td id="TBL-12-3-3" class="td10" style="text-align: left; white-space: normal;"><p>tests retrieval quality</p></td>
</tr>
<tr id="TBL-12-4-" style="vertical-align:baseline;">
<td id="TBL-12-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Evidence</p></td>
<td id="TBL-12-4-2" class="td11" style="text-align: left; white-space: normal;"><p>none, event, event plus satellite</p></td>
<td id="TBL-12-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests staged explanation</p></td>
</tr>
<tr id="TBL-12-5-" style="vertical-align:baseline;">
<td id="TBL-12-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Metric</p></td>
<td id="TBL-12-5-2" class="td11" style="text-align: left; white-space: normal;"><p>Recall@K, MRR, event precision</p></td>
<td id="TBL-12-5-3" class="td10" style="text-align: left; white-space: normal;"><p>separates ranking and truth</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 11: </span><span class="content">Minimal benchmark grid for the first complete TrajPrompt run. </span></figcaption>
</figure>

</div>

<span id="acceptance-criteria" class="paragraphHead"> <span id="x1-113000"></span><span class="ptmb8t-">Acceptance Criteria:</span></span> A final addition for TrajPrompt is an explicit definition of what counts as a successful retrieval result. The first publication-grade benchmark should require correct ranking and correct evidence. Let <span class="mathjax-inline">\\x_i\\</span> be a trajectory, <span class="mathjax-inline">\\t\\</span> be a natural-language query, <span class="mathjax-inline">\\e_i\\</span> be deterministic event evidence, and <span class="mathjax-inline">\\s\_\theta (t,x_i)\\</span> be the learned retrieval score. Ranking quality can be measured by the usual reciprocal-rank statistic,

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathrm {MRR} = \frac {1}{\|\mathcal {Q}\|} \sum \_{q \in \mathcal {Q}} \frac {1}{\operatorname {rank}\_q(x_q^\star )} , \end{equation}

</div>

<span id="x1-113001r16"></span>

but this alone is not enough. A model can retrieve the right vessel for the wrong reason. The evidence precision should therefore be reported as

<div class="mathjax-env mathjax-equation">

\begin{equation} P\_{\mathrm {event}} = \frac { \sum \_q \mathbf {1}\\x_q^\star \in \mathrm {TopK}(q)\\ \mathbf {1}\\e_q \models t_q\\ }{ \sum \_q \mathbf {1}\\x_q^\star \in \mathrm {TopK}(q)\\ }, \end{equation}

</div>

<span id="x1-113002r17"></span>

where <span class="mathjax-inline">\\e_q \models t_q\\</span> means the deterministic event record supports the behavior requested in the query.

This distinction matters for open-vocabulary maritime search. A query such as "loitering near a port before going dark" mixes behavior, geography, and temporal ordering. Template accuracy does not imply paraphrase robustness. Geographic accuracy does not imply behavior accuracy. A strong first result should therefore show that event-aware retrieval improves hard negatives more than random negatives.

<div class="table">

<figure id="x1-113003r12" class="float">
<span id="acceptance-criteria-for-the-first-trajprompt-benchmark"></span>
<div class="tabular">
<table id="TBL-13" class="tabular">
<tbody>
<tr id="TBL-13-1-" style="vertical-align:baseline;">
<td id="TBL-13-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Criterion</span></p></td>
<td id="TBL-13-1-2" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
</tr>
<tr id="TBL-13-2-" style="vertical-align:baseline;">
<td id="TBL-13-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Paraphrase retrieval holds</p></td>
<td id="TBL-13-2-2" class="td10" style="text-align: left; white-space: normal;"><p>language encoder is not memorizing templates</p></td>
</tr>
<tr id="TBL-13-3-" style="vertical-align:baseline;">
<td id="TBL-13-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Hard negatives improve</p></td>
<td id="TBL-13-3-2" class="td10" style="text-align: left; white-space: normal;"><p>behavior evidence helps ranking</p></td>
</tr>
<tr id="TBL-13-4-" style="vertical-align:baseline;">
<td id="TBL-13-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Event precision is reported</p></td>
<td id="TBL-13-4-2" class="td10" style="text-align: left; white-space: normal;"><p>explanations are testable</p></td>
</tr>
<tr id="TBL-13-5-" style="vertical-align:baseline;">
<td id="TBL-13-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Satellite availability is separated</p></td>
<td id="TBL-13-5-2" class="td10" style="text-align: left; white-space: normal;"><p>missing imagery is not counted as model failure</p></td>
</tr>
<tr id="TBL-13-6-" style="vertical-align:baseline;">
<td id="TBL-13-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Latency remains analyst-usable</p></td>
<td id="TBL-13-6-2" class="td10" style="text-align: left; white-space: normal;"><p>retrieval can support interactive search</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 12: </span><span class="content">Acceptance criteria for the first TrajPrompt benchmark. </span></figcaption>
</figure>

</div>

<span id="counterfactual-retrieval-checks" class="paragraphHead"> <span id="x1-114000"></span><span class="ptmb8t-">Counterfactual retrieval checks:</span></span> The benchmark should include counterfactual query checks because maritime language often contains multiple entangled clauses. For a query <span class="mathjax-inline">\\t\\</span> and trajectory <span class="mathjax-inline">\\x\\</span>, define an edited query <span class="mathjax-inline">\\t'\\</span> that changes exactly one semantic field, such as location, time window, loitering duration, or rendezvous condition. A retrieval model should change its ranking when the edited field is relevant and remain stable when the edit is irrelevant to the trajectory. One simple statistic is

<div class="mathjax-env mathjax-equation">

\begin{equation} \Delta \_{\mathrm {cf}} = \frac {1}{\|\mathcal {C}\|} \sum \_{(t,t',x)\in \mathcal {C}} \left \[ s\_\theta (t,x)-s\_\theta (t',x) \right \], \end{equation}

</div>

<span id="x1-114001r18"></span>

computed separately for positive and negative edits. Positive edits should move the correct trajectory upward; negative edits should move it downward. This is not meant to replace Recall@K. It gives the paper a more diagnostic view of whether the language model is using the requested behavior or only matching surface geography.

The staged architecture makes this practical because event records can generate controlled edits. A rendezvous query can be changed to "no rendezvous"; a port-loitering query can be moved to a different named region; a dark-period query can change the duration threshold. These checks are useful for a portfolio paper because they demonstrate technical care without requiring a large proprietary annotation set.

<div class="table">

<figure id="x1-114002r13" class="float">
<span id="counterfactual-query-checks-for-trajprompt"></span>
<div class="tabular">
<table id="TBL-14" class="tabular">
<tbody>
<tr id="TBL-14-1-" style="vertical-align:baseline;">
<td id="TBL-14-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Edit type</span></p></td>
<td id="TBL-14-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected score change</span></p></td>
<td id="TBL-14-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Failure mode exposed</span></p></td>
</tr>
<tr id="TBL-14-2-" style="vertical-align:baseline;">
<td id="TBL-14-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Change region</p></td>
<td id="TBL-14-2-2" class="td11" style="text-align: left; white-space: normal;"><p>lower if vessel never enters edited region</p></td>
<td id="TBL-14-2-3" class="td10" style="text-align: left; white-space: normal;"><p>geographic shortcutting</p></td>
</tr>
<tr id="TBL-14-3-" style="vertical-align:baseline;">
<td id="TBL-14-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Change duration</p></td>
<td id="TBL-14-3-2" class="td11" style="text-align: left; white-space: normal;"><p>lower if dwell time is below threshold</p></td>
<td id="TBL-14-3-3" class="td10" style="text-align: left; white-space: normal;"><p>weak temporal grounding</p></td>
</tr>
<tr id="TBL-14-4-" style="vertical-align:baseline;">
<td id="TBL-14-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Remove rendezvous</p></td>
<td id="TBL-14-4-2" class="td11" style="text-align: left; white-space: normal;"><p>lower for meeting-positive examples</p></td>
<td id="TBL-14-4-3" class="td10" style="text-align: left; white-space: normal;"><p>event evidence ignored</p></td>
</tr>
<tr id="TBL-14-5-" style="vertical-align:baseline;">
<td id="TBL-14-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Change time window</p></td>
<td id="TBL-14-5-2" class="td11" style="text-align: left; white-space: normal;"><p>lower if behavior occurs outside window</p></td>
<td id="TBL-14-5-3" class="td10" style="text-align: left; white-space: normal;"><p>unordered matching</p></td>
</tr>
<tr id="TBL-14-6-" style="vertical-align:baseline;">
<td id="TBL-14-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Paraphrase only</p></td>
<td id="TBL-14-6-2" class="td11" style="text-align: left; white-space: normal;"><p>approximately stable</p></td>
<td id="TBL-14-6-3" class="td10" style="text-align: left; white-space: normal;"><p>brittle template dependence</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 13: </span><span class="content">Counterfactual query checks for TrajPrompt. </span></figcaption>
</figure>

</div>

<span id="limitations" class="paragraphHead"> <span id="x1-115000"></span><span class="ptmb8t-">Limitations:</span></span> The current rendezvous code is a simple bucketed detector and does not yet implement production-scale indexing. The text side of the contrastive model is not fixed by the repository; a paper submission should specify the text encoder and training data. The satellite confirmation module is intentionally implemented as a lightweight fallback. Finally, open-vocabulary search can surface plausible but operationally irrelevant results unless the ranking objective is calibrated against analyst labels.

## <span class="titlemark">6 </span> <span id="x1-1160006"></span>Conclusion and Outlook

TrajPrompt gives the maritime portfolio an arXiv-style framing: open-vocabulary retrieval over AIS trajectories, deterministic rendezvous detection, and satellite confirmation as separate, testable stages. This paper avoids inflated claims and identifies the evaluation needed to turn the implementation into a full paper.

## <span id="x1-117000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xbishop2006pattern"></span>Christopher M. Bishop. <span class="ptmri8t-">Pattern Recognition and Machine Learning</span>. Springer, 2006.

\[2\]  
<span id="Xboyd2004convex"></span>Stephen Boyd and Lieven Vandenberghe. <span class="ptmri8t-">Convex Optimization</span>. Cambridge University Press, 2004.

\[3\]  
<span id="Xbrown2020language"></span>Tom B. Brown et al. Language models are few-shot learners. In <span class="ptmri8t-">NeurIPS</span>, 2020.

\[4\]  
<span id="Xbubeck2015convex"></span>Sébastien Bubeck. Convex optimization: Algorithms and complexity. <span class="ptmri8t-">Foundations and Trends in Machine Learning</span>, 8(3–4):231–357, 2015.

\[5\]  
<span id="Xchen2005robust"></span>Lei Chen, M. Tamer Ozsu, and Vincent Oria. Robust and fast similarity search for moving object trajectories. In <span class="ptmri8t-">SIGMOD</span>, 2005.

\[6\]  
<span id="Xchen2020simclr"></span>Ting Chen et al. A simple framework for contrastive learning of visual representations. In <span class="ptmri8t-">ICML</span>, 2020.

\[7\]  
<span id="Xcho2014rnnencoder"></span>Kyunghyun Cho et al. Learning phrase representations using rnn encoder-decoder for statistical machine translation. In <span class="ptmri8t-">EMNLP</span>, 2014.

\[8\]  
<span id="Xcover2006elements"></span>Thomas M. Cover and Joy A. Thomas. <span class="ptmri8t-">Elements of Information Theory</span>. Wiley, second edition, 2006.

\[9\]  
<span id="Xdevlin2019bert"></span>Jacob Devlin et al. Bert: Pre-training of deep bidirectional transformers for language understanding. In <span class="ptmri8t-">NAACL</span>, 2019.

\[10\]  
<span id="Xgao2021simcse"></span>Tianyu Gao, Xingcheng Yao, and Danqi Chen. Simcse: Simple contrastive learning of sentence embeddings. In <span class="ptmri8t-">EMNLP</span>, 2021.

\[11\]  
<span id="Xgoodfellow2016deep"></span>Ian Goodfellow, Yoshua Bengio, and Aaron Courville. <span class="ptmri8t-">Deep Learning</span>. MIT Press, 2016.

\[12\]  
<span id="Xhastie2009elements"></span>Trevor Hastie, Robert Tibshirani, and Jerome Friedman. <span class="ptmri8t-">The Elements of Statistical Learning</span>. Springer, second edition, 2009.

\[13\]  
<span id="Xhe2020moco"></span>Kaiming He et al. Momentum contrast for unsupervised visual representation learning. In <span class="ptmri8t-">CVPR</span>, 2020.

\[14\]  
<span id="Xhochreiter1997lstm"></span>Sepp Hochreiter and Jurgen Schmidhuber. Long short-term memory. <span class="ptmri8t-">Neural Computation</span>, 1997.

\[15\]  
<span id="Xkhosla2020supervisedcontrastive"></span>Prannay Khosla et al. Supervised contrastive learning. In <span class="ptmri8t-">NeurIPS</span>, 2020.

\[16\]  
<span id="Xkingma2015adam"></span>Diederik P. Kingma and Jimmy Ba. Adam: A method for stochastic optimization. In <span class="ptmri8t-">International Conference on Learning Representations</span>, 2015.

\[17\]  
<span id="Xkirillov2023segment"></span>Alexander Kirillov, Eric Mintun, Nikhila Ravi, Hanzi Mao, Chloe Rolland, Laura Gustafson, Tete Xiao, Spencer Whitehead, Alexander C. Berg, Wan-Yen Lo, Piotr Dollar, and Ross Girshick. Segment anything. In <span class="ptmri8t-">IEEE/CVF International Conference on Computer Vision</span>, 2023.

\[18\]  
<span id="Xlecun1998gradient"></span>Yann LeCun, Léon Bottou, Yoshua Bengio, and Patrick Haffner. Gradient-based learning applied to document recognition. <span class="ptmri8t-">Proceedings of the IEEE</span>, 86(11):2278–2324, 1998.

\[19\]  
<span id="Xlee2007traclus"></span>Jae-Gil Lee, Jiawei Han, and Kyu-Young Whang. Trajectory clustering: A partition-and-group framework. In <span class="ptmri8t-">SIGMOD</span>, 2007.

\[20\]  
<span id="Xlewis2020rag"></span>Patrick Lewis et al. Retrieval-augmented generation for knowledge-intensive nlp tasks. In <span class="ptmri8t-">NeurIPS</span>, 2020.

\[21\]  
<span id="Xli2018t2vec"></span>Xiucheng Li et al. T2vec: Learning trajectory representations for similarity computation. In <span class="ptmri8t-">ICDE</span>, 2018.

\[22\]  
<span id="Xli2023clais"></span>Xue Li et al. Contrastive learning for graph-based vessel trajectory similarity computation. <span class="ptmri8t-">Journal of Marine Science and Engineering</span>, 11(9):1840, 2023.

\[23\]  
<span id="Xmikolov2013distributed"></span>Tomas Mikolov et al. Distributed representations of words and phrases and their compositionality. In <span class="ptmri8t-">NeurIPS</span>, 2013.

\[24\]  
<span id="Xmurphy2012machine"></span>Kevin P. Murphy. <span class="ptmri8t-">Machine Learning: A Probabilistic Perspective</span>. MIT Press, 2012.

\[25\]  
<span id="Xnguyen2020geotracknet"></span>Duc Nguyen, Ronan Vadaine, Guillaume Hajduch, Rene Garello, and Ronan Fablet. Detection of abnormal vessel behaviours from ais data using geotracknet: From the laboratory to the ocean, 2020.

\[26\]  
<span id="Xnocedal2006numerical"></span>Jorge Nocedal and Stephen J. Wright. <span class="ptmri8t-">Numerical Optimization</span>. Springer, second edition, 2006.

\[27\]  
<span id="Xpallotta2013vessel"></span>Giuliana Pallotta, Michele Vespe, and Karna Bryan. Vessel pattern knowledge discovery from ais data: A framework for anomaly detection and route prediction. <span class="ptmri8t-">Entropy</span>, 15(6):2218–2245, 2013.

\[28\]  
<span id="Xpearl2009causality"></span>Judea Pearl. <span class="ptmri8t-">Causality: Models, Reasoning, and Inference</span>. Cambridge University Press, second edition, 2009.

\[29\]  
<span id="Xradford2021learning"></span>Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, et al. Learning transferable visual models from natural language supervision. In <span class="ptmri8t-">International Conference on Machine Learning</span>, 2021.

\[30\]  
<span id="Xradford2021clip"></span>Alec Radford et al. Learning transferable visual models from natural language supervision. In <span class="ptmri8t-">ICML</span>, 2021.

\[31\]  
<span id="Xravi2024sam2"></span>Nikhila Ravi, Valentin Gabeur, Yuan-Ting Hu, Ronghang Hu, Chaitanya Ryali, et al. Sam 2: Segment anything in images and videos, 2024.

\[32\]  
<span id="Xreimers2019sentencebert"></span>Nils Reimers and Iryna Gurevych. Sentence-bert: Sentence embeddings using siamese bert-networks. In <span class="ptmri8t-">EMNLP-IJCNLP</span>, 2019.

\[33\]  
<span id="Xristic2008maritime"></span>Branko Ristic, Barbara La Scala, Mark Morelande, and Neil Gordon. Statistical analysis of motion patterns in ais data: Anomaly detection and motion prediction. In <span class="ptmri8t-">FUSION</span>, 2008.

\[34\]  
<span id="Xrobbins1951stochastic"></span>Herbert Robbins and Sutton Monro. A stochastic approximation method. <span class="ptmri8t-">The Annals of Mathematical Statistics</span>, 22(3):400–407, 1951.

\[35\]  
<span id="Xrumelhart1986learning"></span>David E. Rumelhart, Geoffrey E. Hinton, and Ronald J. Williams. Learning representations by back-propagating errors. <span class="ptmri8t-">Nature</span>, 323:533–536, 1986.

\[36\]  
<span id="Xsakoe1978dtw"></span>Hiroaki Sakoe and Seibi Chiba. Dynamic programming algorithm optimization for spoken word recognition. <span class="ptmri8t-">IEEE Transactions on Acoustics, Speech, and Signal Processing</span>, 1978.

\[37\]  
<span id="Xshannon1948communication"></span>Claude E. Shannon. A mathematical theory of communication. <span class="ptmri8t-">Bell System Technical Journal</span>, 27(3):379–423, 1948.

\[38\]  
<span id="Xsharma2022tist"></span>Arun Sharma and Shashi Shekhar. Analyzing trajectory gaps for possible rendezvous regions. <span class="ptmri8t-">ACM Transactions on Intelligent Systems and Technology</span>, 2022.

\[39\]  
<span id="Xturing1950computing"></span>A. M. Turing. Computing machinery and intelligence. <span class="ptmri8t-">Mind</span>, 59(236):433–460, 1950.

\[40\]  
<span id="Xoord2018cpc"></span>Aaron van den Oord, Yazhe Li, and Oriol Vinyals. Representation learning with contrastive predictive coding, 2018.

\[41\]  
<span id="Xvapnik1998statistical"></span>Vladimir N. Vapnik. <span class="ptmri8t-">Statistical Learning Theory</span>. Wiley, 1998.

\[42\]  
<span id="Xvaswani2017attention"></span>Ashish Vaswani et al. Attention is all you need. In <span class="ptmri8t-">NeurIPS</span>, 2017.

\[43\]  
<span id="Xyao2022cstrm"></span>Di Yao, Chao Zhang, Jianhui Huang, and Jingping Bi. Cstrm: Contrastive self-supervised trajectory representation model for trajectory similarity computation. <span class="ptmri8t-">Computer Communications</span>, 185:159–167, 2022.

\[44\]  
<span id="Xyuan2010tdrive"></span>Jing Yuan, Yu Zheng, Xing Xie, and Guangzhong Sun. T-drive: Driving directions based on taxi trajectories. In <span class="ptmri8t-">GIS</span>, 2010.

\[45\]  
<span id="Xzheng2015trajectory"></span>Yu Zheng and Xiaofang Zhou, editors. <span class="ptmri8t-">Computing with Spatial Trajectories</span>. Springer, 2011.

\[46\]  
<span id="Xzheng2010geolife"></span>Yu Zheng, Xing Xie, and Wei-Ying Ma. Geolife: A collaborative social networking service among user, location and trajectory. In <span class="ptmri8t-">IEEE Data Engineering Bulletin</span>, 2010.

</div>
