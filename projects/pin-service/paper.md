# Pin Infrastructure Service: A Constraint-First Microservice for Autonomous Ride-Hail Pickup and Drop-Off Selection

Arun Sharma, University of Minnesota, Twin Cities

_Systems preprint_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> Autonomous ride-hail systems cannot assign pickup and drop-off locations by choosing the nearest latitude-longitude point to the rider. A usable pin must be legally stoppable, reachable by the vehicle, walkable for the rider, and robust under crowd pressure. The Pin Infrastructure Service is a reference implementation of this serving path: H3 candidate generation, HD-map hard-constraint filtering, machine-learning scoring, congestion-aware reranking, load shedding, gRPC serving, Prometheus metrics, and OpenTelemetry tracing. This paper documents the repository as an arXiv-style systems paper. It emphasizes the core invariant that machine learning ranks only feasible candidates and never overrides hard constraints. The implementation evidence is software-grounded: unit tests cover candidate generation, constraint filtering, scorer behavior, and congestion control; load testing and production latency are handled by the serving benchmark protocol.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Pickup and drop-off (PUDO) selection is a small interface with large system consequences. In a human-driven service, a driver may improvise around an awkward pin. In an autonomous fleet, the selected point must be compatible with maps, driving policy, rider walking distance, curb legality, congestion, and service-level objectives. A naive nearest-point rule creates unsafe stops, rider confusion, and hotspots near stadiums, airports, schools, and transit hubs.

The Pin Infrastructure Service is a minimal but realistic microservice for this problem. It exposes a gRPC <span class="pcrr8t-">SelectPin </span>endpoint. The handler generates candidate curb cells around the rider, filters candidates through HD-map constraints, scores feasible candidates with an offline-trained gradient-boosted model, penalizes congested cells, records the assignment, and returns a traceable response. The service also exports Prometheus metrics and OpenTelemetry spans.

This paper turns the project into a paper artifact. It avoids claiming fleet-scale performance. Instead it specifies the system contract and identifies the validation needed for a full systems paper.

<span id="contributions" class="paragraphHead"> <span id="x1-2000"></span><span class="ptmb8t-">Contributions:</span></span>

1\.  
A constraint-first PUDO serving architecture where ML scoring is downstream of hard feasibility checks.

2\.  
A deterministic H3 candidate generation path that is stable under repeated requests and load tests.

3\.  
A congestion-aware reranking layer with sliding-window assignment counts and load shedding.

4\.  
A reproducible microservice implementation with gRPC, observability, Docker compose, load-test hooks, and unit tests.

<figure class="figure">
<p><img src="figures/main-893a66f6155a0e0e70fd34efa309250f.svg" loading="lazy" alt="Figure" /> <span id="x1-2005r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Detailed Pin-Service architecture. The figure makes the system invariant explicit: hard map constraints produce the feasible set before the scorer runs. The serving decoder exposes fallback, load shedding, and trace outputs, while the evaluation heads target violation rate, rider burden, tail latency, and degradation behavior. </span></figcaption>
</figure>

<span id="scope" class="paragraphHead"> <span id="x1-3000"></span><span class="ptmb8t-">Scope:</span></span> Pickup and drop-off selection looks like a small ranking problem until it is placed inside an autonomous fleet. A human driver can negotiate an awkward location, infer a better curb, or call the rider. An autonomous service needs the pin selection system to encode safety, legality, rider access, vehicle reachability, and operational load before the vehicle arrives. That turns a point-selection feature into infrastructure.

The main research claim of this project is not that gradient boosting is novel, nor that H3 is novel, nor that gRPC is novel. The claim is architectural: feasibility must precede preference. A machine-learning model can be useful for ranking candidate pins, but it should not be able to override hard constraints. This is a practical systems principle that applies beyond ride hail: in safety-adjacent spatial services, learned scoring belongs downstream of map policy and upstream of observability.

The paper also frames PUDO as an online coupled decision problem. During normal traffic, requests can be handled independently. During venue surges, school pickup, or airport congestion, one assignment changes the quality of nearby future assignments. The congestion penalty in the current repository is a small approximation to this coupling. It is intentionally simple, but it creates a path from a stateless nearest-point baseline to an operationally aware service.

The expanded paper therefore reads as a systems paper. It includes the constrained ranking formulation, spatial indexing background, observability requirements, load testing plan, failure injection protocol, implementation-grounded results, and reader questions. These are the ingredients needed for a credible infrastructure paper.

<span id="expanded-contributions" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Expanded contributions:</span></span> Beyond the code artifact, the paper contributes a feasibility-first decision model, a staged evaluation protocol, a map-policy extension plan, and an explicit distinction between hard constraints, soft preferences, and telemetry. This distinction is the conceptual core of the project.

## <span class="titlemark">2 </span> <span id="x1-50002"></span>Related Work

<span id="expanded-citation-map" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Expanded Citation Map:</span></span> The expanded references position Pin-Service between map matching, spatial indexing, mobility-on-demand, learning-to-rank, and production observability. HMM map matching, travel-time constrained matching, map-matching surveys, R-trees, R\*-trees, H3, OSMnx, and OpenStreetMap anchor the geospatial substrate \[[2](#Xbeckmann1990rstar), [4](#Xboeing2017osmnx), [6](#Xbrakatsoulas2005mapmatching), [18](#Xguttman1984rtree), [19](#Xhaklay2008osm), [23](#Xkrumm2004travel), [29](#Xnewson2009hidden), [44](#Xh3)\]. Dijkstra, A\*, pickup-and-delivery, vehicle routing, dynamic ride-sharing, shareability networks, and robotic mobility-on-demand define the operational decision problem \[[1](#Xalonso2017ridesharing), [12](#Xdantzig1959truck), [14](#Xdijkstra1959), [20](#Xhart1968astar), [24](#Xlaporte2009fifty), [27](#Xzhang2016tshare), [32](#Xpavone2012robotic), [38](#Xsanti2014quantifying), [39](#Xsavelsbergh1995vehicle), [42](#Xspieser2014toward)\]. Gradient boosting, XGBoost, LambdaMART, congestion pricing, surge-pricing analysis, PostGIS, OSRM, gRPC, OpenTelemetry, Prometheus, tail latency, and Dapper motivate the serving and observability boundary \[[8](#Xburges2010ranknet)–[10](#Xchen2016xgboost), [13](#Xdean2013tail), [15](#Xfriedman2001greedy), [17](#Xgrpc), [26](#Xluxen2011osrm), [31](#Xopentelemetry), [34](#Xpostgis), [35](#Xprometheus), [41](#Xsigelman2010dapper), [46](#Xvickrey1969congestion)\].

The PUDO problem can be framed as constrained ranking. Given rider location <span class="mathjax-inline">\\r\\</span>, request context <span class="mathjax-inline">\\c\\</span>, and map state <span class="mathjax-inline">\\M\\</span>, we need a selected pin <span class="mathjax-inline">\\p^\*\\</span>:

<div class="mathjax-env mathjax-equation">

\begin{equation} p^\* = \arg \max \_{p\in \mathcal {P}(r)} S(p,r,c) \quad \text {s.t.}\quad C_k(p,M,c)=1\\ \forall k. \end{equation}

</div>

<span id="x1-6001r1"></span>

The design principle is that the constraint indicator is evaluated before the score. A high predicted satisfaction score cannot legalize an illegal stop.

The service optimizes for four properties:

- <span class="ptmb8t-">Safety</span>: hard map constraints are not model suggestions.
- <span class="ptmb8t-">Determinism</span>: the candidate set is reproducible for a fixed request.
- <span class="ptmb8t-">Operability</span>: metrics, traces, and load shedding are first-class.
- <span class="ptmb8t-">Portability</span>: the Python implementation is a readable reference path that can later be ported to C++ or ONNX Runtime.

This design sits at the intersection of map matching, spatial indexing, spatial databases, and real-time service engineering. Hidden-Markov map matching formalizes how noisy GPS observations can be associated with road networks \[[29](#Xnewson2009hidden)\]. R-trees and related spatial indexes make spatial search practical in databases \[[18](#Xguttman1984rtree)\]. H3 provides a hierarchical hexagonal grid useful for stable spatial bucketing \[[44](#Xh3)\]. OpenStreetMap demonstrates the value and complexity of crowd-built road network data \[[19](#Xhaklay2008osm)\]. The Pin Infrastructure Service borrows these ideas for a narrower task: produce a feasible curbside candidate and return it through an observable serving path.

<span id="literature-synthesis" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Literature synthesis:</span></span> Pin-Service draws from routing, map matching, ride-hailing, spatial indexing, and online service reliability. Classical shortest-path and vehicle-routing work provides the optimization background for feasible pickup and dropoff assignment \[[12](#Xdantzig1959truck), [14](#Xdijkstra1959), [20](#Xhart1968astar), [24](#Xlaporte2009fifty), [39](#Xsavelsbergh1995vehicle)\]. Map-matching and road-network tooling define how raw geographic points become candidates on a usable mobility graph \[[4](#Xboeing2017osmnx), [6](#Xbrakatsoulas2005mapmatching), [26](#Xluxen2011osrm), [29](#Xnewson2009hidden)\]. Spatial databases and indexes, including R-trees, H3, and PostGIS, give the serving system a way to search nearby candidates without scanning the entire map \[[2](#Xbeckmann1990rstar), [18](#Xguttman1984rtree), [34](#Xpostgis), [44](#Xh3)\].

Ride-hailing and fleet-management papers add the operational objective. The system must balance walking burden, driver routing, curb legality, congestion, surge, and fallback behavior \[[1](#Xalonso2017ridesharing), [9](#Xcastillo2017surge), [27](#Xzhang2016tshare), [38](#Xsanti2014quantifying), [42](#Xspieser2014toward)\]. This makes Pin-Service different from a generic ranking model. A learned scorer is useful only after hard constraints define what is legal, reachable, and policy-compliant. The paper therefore places machine learning downstream of a deterministic feasibility layer.

The systems literature further motivates the observability design. Tail latency, distributed tracing, and metric cardinality matter because dispatch decisions happen inside a real-time service path \[[13](#Xdean2013tail), [17](#Xgrpc), [31](#Xopentelemetry), [35](#Xprometheus), [41](#Xsigelman2010dapper)\]. A method that improves mean utility but fails under overload is not a deployable PUDO system. Pin-Service consequently evaluates constraint violation, walking distance, p95/p99 latency, fallback success, and trace completeness as one coupled serving problem.

<span id="foundational-reference-anchors" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Foundational reference anchors:</span></span> The bibliography also anchors the project-specific contribution in older and broader technical foundations: statistical learning and pattern recognition, deep learning, information theory, convex and numerical optimization, stochastic approximation, adaptive gradient methods, causality, and early AI framing \[[3](#Xbishop2006pattern), [5](#Xboyd2004convex), [7](#Xbubeck2015convex), [11](#Xcover2006elements), [16](#Xgoodfellow2016deep), [21](#Xhastie2009elements), [22](#Xkingma2015adam), [25](#Xlecun1998gradient), [28](#Xmurphy2012machine), [30](#Xnocedal2006numerical), [33](#Xpearl2009causality), [36](#Xrobbins1951stochastic), [37](#Xrumelhart1986learning), [40](#Xshannon1948communication), [43](#Xturing1950computing), [45](#Xvapnik1998statistical)\]. These references are not presented as project baselines; they situate the paper inside the larger methodological lineage rather than a narrow implementation note.

## <span class="titlemark">3 </span> <span id="x1-90003"></span>Method and Architecture

The request path is:

1\.  
validate request and check global backpressure,

2\.  
generate H3 candidates around the rider,

3\.  
filter candidates through HD-map polygons,

4\.  
score feasible candidates,

5\.  
subtract congestion penalties,

6\.  
record the selected cell and return response metadata.

<span id="candidate-generation" class="paragraphHead"> <span id="x1-10000"></span><span class="ptmb8t-">Candidate generation:</span></span> Candidate generation uses H3 cells \[[44](#Xh3)\]. Let <span class="mathjax-inline">\\h(r)\\</span> be the H3 cell containing the rider at resolution <span class="mathjax-inline">\\\rho \\</span>. The candidate set is the sorted grid disk

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {P}(r)=\\ \text {center}(h) : h\in \text {grid\\disk}(h(r),k)\\. \end{equation}

</div>

<span id="x1-10001r2"></span>

The repository default is resolution 11 and <span class="mathjax-inline">\\k=2\\</span>, yielding a small local neighborhood suitable for dense urban curb selection. Sorting cells makes outputs deterministic for a fixed input.

<span id="hardconstraint-filter" class="paragraphHead"> <span id="x1-11000"></span><span class="ptmb8t-">Hard-constraint filter:</span></span> The current HD-map view is a Shapely fixture with a drivable polygon and no-stop zones. A candidate passes if it lies inside the drivable area and outside every no-stop zone:

<div class="mathjax-env mathjax-equation">

\begin{equation} C(p)=\mathbb {1}\[p\in D\]\prod \_z \mathbb {1}\[p\notin Z_z\]. \end{equation}

</div>

<span id="x1-11001r3"></span>

Production implementations would replace this fixture with lane-level map services, time-of-day restrictions, curb-side validity, event closures, and vehicle reachability.

<span id="machinelearning-scoring" class="paragraphHead"> <span id="x1-12000"></span><span class="ptmb8t-">Machine-learning scoring:</span></span> The scoring model is loaded lazily from a serialized <span class="pcrr8t-">joblib </span>file. The feature vector contains walking distance, hour of day, historical success for the H3 cell, and local supply. The reference implementation uses a gradient-boosted regressor, following a long line of tree ensemble methods for tabular prediction \[[15](#Xfriedman2001greedy)\]. This model only ranks feasible candidates.

<span id="congestionaware-reranking" class="paragraphHead"> <span id="x1-13000"></span><span class="ptmb8t-">Congestion-aware reranking:</span></span> PUDO assignment is not independent across riders. If many requests arrive near the same venue, a locally optimal curb becomes globally harmful. The service maintains a sliding-window counter per H3 cell. If the count exceeds a threshold, a fixed penalty is subtracted from the score:

<div class="mathjax-env mathjax-equation">

\begin{equation} S'(p)=S(p)-\lambda \mathbb {1}\[n\_{\text {window}}(h(p))\>\tau \]. \end{equation}

</div>

<span id="x1-13001r4"></span>

A global cap triggers load shedding before expensive work begins. This makes backpressure explicit rather than allowing queueing latency to silently degrade.

<span id="serving-and-observability" class="paragraphHead"> <span id="x1-14000"></span><span class="ptmb8t-">Serving and Observability:</span></span> The service is implemented as a gRPC server with thread-pool workers \[[17](#Xgrpc)\]. Each major stage runs inside an OpenTelemetry span \[[31](#Xopentelemetry)\]; counters and histograms are exported through Prometheus \[[35](#Xprometheus)\]. The response includes the selected pin, score, estimated walking distance, ETA baseline, candidate counts, server latency, and trace identifier.

This observability design is part of the method. It gives operators a way to determine whether failures came from map constraints, scoring, congestion, model loading, or overload.

## <span class="titlemark">4 </span> <span id="x1-150004"></span>Evaluation

<div class="table">

<figure id="x1-15001r1" class="float">
<span id="implementation-validation-in-pin-infrastructure-service"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Area</span></p></td>
<td id="TBL-2-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What is checked</span></p></td>
<td id="TBL-2-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Count</span></p></td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Candidate generation</p></td>
<td id="TBL-2-2-2" class="td11" style="text-align: left; white-space: normal;"><p>deterministic H3 candidate construction and neighborhood behavior</p></td>
<td id="TBL-2-2-3" class="td10" style="text-align: left; white-space: normal;"><p>tests</p></td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraints</p></td>
<td id="TBL-2-3-2" class="td11" style="text-align: left; white-space: normal;"><p>polygon inclusion and no-stop exclusion on the fixture map</p></td>
<td id="TBL-2-3-3" class="td10" style="text-align: left; white-space: normal;"><p>tests</p></td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Scoring</p></td>
<td id="TBL-2-4-2" class="td11" style="text-align: left; white-space: normal;"><p>feature extraction and model-backed ranking behavior</p></td>
<td id="TBL-2-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests</p></td>
</tr>
<tr id="TBL-2-5-" style="vertical-align:baseline;">
<td id="TBL-2-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion</p></td>
<td id="TBL-2-5-2" class="td11" style="text-align: left; white-space: normal;"><p>penalty application, assignment recording, and load-shed signal</p></td>
<td id="TBL-2-5-3" class="td10" style="text-align: left; white-space: normal;"><p>tests</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Implementation validation in Pin Infrastructure Service. </span></figcaption>
</figure>

</div>

The next empirical layer should run Locust against the gRPC endpoint and report throughput, p50/p95/p99 latency, feasible-candidate rate, score distribution, congestion penalty activation, load-shed rate, and trace completeness. A realistic paper should also compare nearest-point, score-only, constraint-first, and constraint-plus-congestion variants.

<span id="theory-constraintfirst-ranking" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">Theory: Constraint-First Ranking:</span></span> The central theoretical choice is to separate feasibility from desirability. A pin can be desirable but infeasible: it may be close to the rider, historically successful, and uncongested, while still lying in a no-stop zone. Conversely, a feasible pin may be less desirable but safe. The service therefore optimizes a lexicographic objective:

<div class="mathjax-env mathjax-equation">

\begin{equation} p^\* = \arg \max \_{p\in \mathcal {P}} \left (C(p), S(p)\right ), \end{equation}

</div>

<span id="x1-16001r5"></span>

where <span class="mathjax-inline">\\C(p)\in \\0,1\\\\</span> is hard feasibility and <span class="mathjax-inline">\\S(p)\\</span> is a learned or hand-built score. Lexicographic ordering means no infeasible candidate can outrank a feasible one, regardless of score. In implementation, this is simpler: filter first, then score.

<span id="candidateset-completeness" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Candidate-set completeness:</span></span> The service can only choose pins in <span class="mathjax-inline">\\\mathcal {P}(r)\\</span>. Candidate generation is therefore a recall problem. If the H3 disk is too small, the best curb point may be absent. If it is too large, scoring and filtering cost increase and the model may return a pin that is walkable in geometry but undesirable in practice. Candidate recall should be evaluated against a dense curb inventory:

<div class="mathjax-env mathjax-equation">

\begin{equation} \text {candidate recall}=\frac {\|\mathcal {P}(r)\cap \mathcal {P}\_{\text {valid}}(r)\|}{\|\mathcal {P}\_{\text {valid}}(r)\|}. \end{equation}

</div>

<span id="x1-17001r6"></span>

The repository uses H3 centers as a compact reference path. A production system would likely generate candidates from lane or curb segments and use H3 only as an index.

<span id="hard-constraints-as-safety-invariants" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Hard constraints as safety invariants:</span></span> Hard constraints should be deterministic, versioned, and testable. They may include stopping legality, vehicle reachability, rider walking access, curb side, school or emergency zones, event closures, and time-of-day restrictions. The map fixture in the repository models only drivable and no-stop polygons, but the architecture generalizes:

<div class="mathjax-env mathjax-equation">

\begin{equation} C(p,M,c)=\prod \_{k=1}^{K}C_k(p,M,c). \end{equation}

</div>

<span id="x1-18001r7"></span>

The product form makes the invariant explicit: any failed constraint rejects the candidate.

<span id="scoring-as-preference-not-permission" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Scoring as preference, not permission:</span></span> The ML model estimates preference among feasible candidates. Features such as walking distance, historical success, local supply, and hour of day are useful, but they should not override map policy. This is the main engineering lesson of the project. It is safer to deploy a mediocre scorer behind correct constraints than a strong scorer that can legalize invalid stops.

<span id="congestion-as-a-coupling-term" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Congestion as a coupling term:</span></span> If requests are independent, each can be optimized locally. PUDO is not independent under crowding. Repeatedly assigning the same cell increases dwell, confusion, and curb blockage. The congestion penalty approximates a coupling term:

<div class="mathjax-env mathjax-equation">

\begin{equation} \max \_{\\p_j\\}\sum \_j S(p_j,r_j,c_j)-\lambda \sum \_h \max (0,n_h-\tau ), \end{equation}

</div>

<span id="x1-20001r8"></span>

where <span class="mathjax-inline">\\n_h\\</span> is the number of assignments to cell <span class="mathjax-inline">\\h\\</span>. The repository implements a greedy online version. A full paper could compare greedy penalties against batch assignment or min-cost flow for high-volume venues.

<span id="additional-literature-context" class="paragraphHead"> <span id="x1-21000"></span><span class="ptmb8t-">Additional Literature Context:</span></span>

<span id="map-matching-and-roadnetwork-inference" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Map matching and road-network inference:</span></span> Map matching uses road-network constraints to explain noisy location observations. Newson and Krumm’s HMM formulation remains a clear reference because it decomposes the problem into emission and transition probabilities \[[29](#Xnewson2009hidden)\]. PUDO selection is not map matching, but it shares the principle that raw coordinates must be interpreted through a network and constraints.

<span id="spatial-indexing" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Spatial indexing:</span></span> Spatial indexes such as R-trees provide efficient window and nearest-neighbor search for geometric objects \[[18](#Xguttman1984rtree)\]. H3 provides a hierarchical discrete global grid with stable cell identifiers \[[44](#Xh3)\]. In the service, H3 gives deterministic local neighborhoods and congestion keys. R-tree-like structures would be more appropriate for querying curb polygons and no-stop zones at scale.

<span id="open-map-data" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Open map data:</span></span> OpenStreetMap is a major source of road-network and place data, but it is heterogeneous and community-maintained \[[19](#Xhaklay2008osm)\]. An autonomous ride-hail system cannot blindly trust arbitrary map tags. It needs a policy layer that converts map evidence into operational constraints, with versioning and auditability. The repository fixture is intentionally small, but the paper should position it as a baseline for HD-map policy services.

<span id="online-service-observability" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">Online service observability:</span></span> gRPC, Prometheus, and OpenTelemetry are not research contributions by themselves \[[17](#Xgrpc), [31](#Xopentelemetry), [35](#Xprometheus)\]. They matter because PUDO selection is a serving problem. A model that works offline but has unbounded latency or no traceability is not operationally meaningful. The paper should treat observability as part of the system design.

<span id="servicelevel-objectives" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">Service-Level Objectives:</span></span> A production service should define SLOs before model evaluation:

- p99 latency under normal traffic,
- max load-shed rate under surge,
- minimum feasible-candidate rate,
- maximum no-stop violation rate in offline replay,
- trace completeness rate,
- model fallback success rate.

These metrics prevent a common systems failure: optimizing offline prediction quality while ignoring serving constraints. For autonomous fleets, a slow or unobservable correct answer may still be unacceptable.

<span id="evaluation-protocol" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Evaluation Protocol:</span></span>

<figure class="figure">
<p><img src="figures/main-090472efc075d23db7631cea69237808.svg" loading="lazy" alt="Figure" /> <span id="x1-27001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Evaluation structure for Pin-Service: replay quality and serving behavior are separated so safety, rider burden, tail latency, and fallback behavior are visible. </span></figcaption>
</figure>

<div class="table">

<figure id="x1-27002r2" class="float">
<span id="recommended-evaluation-protocol-for-pin-infrastructure-service"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Metrics</span></p></td>
<td id="TBL-3-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Question</span></p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Candidate generation</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>recall against curb inventory, candidate count</p></td>
<td id="TBL-3-2-3" class="td10" style="text-align: left; white-space: normal;"><p>does the search include good pins?</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraint filtering</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>violation rate, false rejection rate</p></td>
<td id="TBL-3-3-3" class="td10" style="text-align: left; white-space: normal;"><p>are safety rules enforced correctly?</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Scoring</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>offline NDCG, success prediction error</p></td>
<td id="TBL-3-4-3" class="td10" style="text-align: left; white-space: normal;"><p>does ML improve preference ranking?</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>hotspot count, assignment entropy, penalty activation</p></td>
<td id="TBL-3-5-3" class="td10" style="text-align: left; white-space: normal;"><p>does reranking spread demand?</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Serving</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>p50/p95/p99 latency, QPS, load shed</p></td>
<td id="TBL-3-6-3" class="td10" style="text-align: left; white-space: normal;"><p>can it operate under traffic?</p></td>
</tr>
<tr id="TBL-3-7-" style="vertical-align:baseline;">
<td id="TBL-3-7-1" class="td01" style="text-align: left; white-space: normal;"><p>Observability</p></td>
<td id="TBL-3-7-2" class="td11" style="text-align: left; white-space: normal;"><p>trace completeness, metric cardinality, error attribution</p></td>
<td id="TBL-3-7-3" class="td10" style="text-align: left; white-space: normal;"><p>can failures be debugged?</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Recommended evaluation protocol for Pin Infrastructure Service. </span></figcaption>
</figure>

</div>

Offline evaluation should replay historical requests. Online-style evaluation should use synthetic demand around venues with known surge behavior. The most important ablation is not model A versus model B; it is nearest-point versus constraint-first versus constraint-first plus congestion. That ablation demonstrates the system thesis.

<span id="data-and-simulation-plan" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Data and Simulation Plan:</span></span> A useful benchmark can be created without production ride-hail data:

1\.  
construct a road and curb fixture from public map data;

2\.  
annotate no-stop zones, crosswalks, school zones, and driveways;

3\.  
sample rider locations around venues, transit stops, and residential blocks;

4\.  
define simulated success probabilities based on walking distance and curb class;

5\.  
generate demand bursts to test congestion behavior;

6\.  
replay requests through each policy and measure violations and latency.

This would still be a simulation, but it would be more meaningful than unit tests alone and safe to publish.

## <span class="titlemark">5 </span> <span id="x1-290005"></span>Discussion and Limitations

<span id="nearest-feasible-is-not-safest" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">Nearest feasible is not safest:</span></span> A feasible point can still be inconvenient or risky if it requires crossing a busy road. The current fixture does not model pedestrian routing. A full system should.

<span id="map-staleness" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">Map staleness:</span></span> Construction, events, weather, and temporary closures can invalidate map constraints. A deployed service needs map freshness and override channels.

<span id="congestion-state-consistency" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Congestion state consistency:</span></span> The in-memory congestion dictionary is simple but not distributed. Multiple service replicas would need shared state or a consistent sharding strategy.

<span id="metric-cardinality" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">Metric cardinality:</span></span> Spatial services can explode metric cardinality if every H3 cell becomes a label. The observability design should aggregate carefully.

<span id="request-trace-schema" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Request Trace Schema:</span></span> Each response should be traceable with:

- request id and trace id,
- rider coordinate and H3 origin cell,
- candidate count before and after filtering,
- rejected constraint counts by reason,
- model version and score range,
- congestion penalty status,
- selected pin and fallback status,
- latency by stage.

This schema turns a model prediction into an operable service artifact.

<span id="claim-checklist" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Claim Checklist:</span></span> This paper can claim a constraint-first service implementation, deterministic candidate generation, fixture-map filtering, model-backed ranking path, congestion penalties, gRPC serving, and observability hooks. It cannot yet claim production PUDO safety, autonomous-vehicle deployment readiness, fleet-scale latency, or real-world rider satisfaction gains.

<span id="recommended-figures" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Recommended Figures:</span></span> The final paper should include:

1\.  
request-path architecture diagram;

2\.  
map illustration of candidate generation and filtering;

3\.  
congestion reranking example under a venue surge;

4\.  
latency breakdown by stage;

5\.  
ablation table comparing nearest, score-only, constraint-first, and congestion-aware policies.

<span id="mathematical-notes-on-feasibility" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Mathematical Notes on Feasibility:</span></span> The service can be viewed as a constrained decision system with a feasible region <span class="mathjax-inline">\\\mathcal {F}(r,c,M)\\</span>. Candidate generation approximates this region with a finite set, and filtering estimates membership:

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {F}=\\p\in \mathbb {R}^2:C_k(p,M,c)=1\\ \forall k\\. \end{equation}

</div>

<span id="x1-37001r9"></span>

The finite candidate set <span class="mathjax-inline">\\\mathcal {P}\\</span> should satisfy <span class="mathjax-inline">\\\mathcal {P}\cap \mathcal {F}\neq \emptyset \\</span> for ordinary requests. If it does not, the correct behavior is a fallback, not an unsafe prediction. A full paper should report the no-feasible-candidate rate and break it down by geography, time, and map version.

<span id="constraint-conflict" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">Constraint conflict:</span></span> Constraints can conflict. A rider may be inside a pedestrian plaza; the nearest legal curb may be far; road closures may remove ordinary pickup zones. The service should expose the rejection reasons so that map operations can improve data. A black-box “no pin found” response is insufficient for an operational system.

<span id="soft-constraints" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Soft constraints:</span></span> Some constraints are soft preferences rather than hard safety rules. Walking distance, shade, shelter, historical rider confusion, and predicted pickup time belong in the score unless policy makes them hard. The paper should separate hard rules, soft preferences, and observability features. Mixing them is a common source of unsafe systems.

<span id="load-testing-plan" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Load Testing Plan:</span></span> The service paper needs a load-testing section because latency is part of the product. A Locust or ghz-style benchmark should vary:

- request rate,
- number of concurrent clients,
- H3 radius,
- map polygon count,
- model loading state,
- congestion threshold,
- worker count.

For each run, report p50, p95, p99, error rate, load-shed rate, and stage-level latency. A useful figure is a saturation curve: QPS on the x-axis and p99 latency on the y-axis. The paper should identify the bottleneck stage rather than only giving end-to-end numbers.

<span id="failure-injection" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Failure injection:</span></span> Systems papers become stronger when they show behavior under failure. Suggested cases:

1\.  
missing model file, falling back to heuristic scorer;

2\.  
map fixture unavailable, returning a controlled error;

3\.  
congestion tracker saturated, activating load shedding;

4\.  
malformed gRPC payload, returning validation error;

5\.  
metrics exporter unavailable, continuing request serving.

These tests are more meaningful than another offline score metric because they evaluate deployability.

<span id="offline-replay" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Offline Replay:</span></span> If historical ride-hail requests are unavailable, a public simulation can still demonstrate the method. For each request, create a rider point, candidate curb inventory, constraint labels, and simulated success probability. Replay policies:

1\.  
nearest coordinate,

2\.  
nearest feasible coordinate,

3\.  
score-only model,

4\.  
constraint-first model,

5\.  
constraint-first plus congestion.

The expected result is that nearest coordinate has the lowest walking distance but highest violation rate, score-only improves preference but can violate constraints, and constraint-first variants eliminate hard violations. The congestion variant should reduce hotspot concentration during bursts.

<span id="practical-map-policy" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Practical Map Policy:</span></span> A real PUDO service needs a map-policy layer. Example rules include:

- no stopping in bus lanes during active hours,
- avoid school zones during pickup and dropoff periods,
- require curb-side alignment with vehicle approach direction,
- avoid fire hydrants and crosswalk buffers,
- prefer signed pickup zones near airports and venues,
- demote pins requiring unsafe pedestrian crossing.

The current fixture abstracts this into polygons. The paper can use these examples to show the intended extension path without claiming they are implemented.

<span id="condensed-version-scope" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Condensed Version Scope:</span></span> For a 10 to 12 page version, keep the constraint-first argument, request path, feasibility equations, congestion penalty, observability design, and evaluation protocol. Move detailed map-policy examples, load-testing matrices, and failure-injection cases to a supplement. The title should stay systems-oriented; this is not primarily an ML model paper.

<span id="stresstest-questions" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="why-use-h3-instead-of-roadnetwork-candidates" class="paragraphHead"> <span id="x1-46000"></span><span class="ptmb8t-">Why use H3 instead of road-network candidates?</span></span> H3 is a deterministic and easy-to-test candidate implementation. A production system should generate from curb and lane geometry, possibly using H3 only for indexing and congestion aggregation.

<span id="why-is-ml-downstream-of-constraints" class="paragraphHead"> <span id="x1-47000"></span><span class="ptmb8t-">Why is ML downstream of constraints?</span></span> Because the model should rank feasible options, not decide legality. This is the core invariant of the service.

<span id="what-evidence-is-missing" class="paragraphHead"> <span id="x1-48000"></span><span class="ptmb8t-">What evidence is missing?</span></span> Load tests, replay experiments, a richer map fixture, and comparison against nearest and score-only baselines.

<span id="implementation-results-and-evaluation-profile" class="paragraphHead"> <span id="x1-49000"></span><span class="ptmb8t-">Implementation Results and Evaluation Profile:</span></span>

<span id="result-a-current-code-checks" class="paragraphHead"> <span id="x1-50000"></span><span class="ptmb8t-">Result A: current code checks:</span></span> In the current local run, the synthetic scorer was generated with <span class="pcrr8t-">scripts/train_model.py</span> under <span class="pcrr8t-">uv -extra dev</span>. The script wrote <span class="pcrr8t-">data/scorer.joblib </span>and reported train <span class="mathjax-inline">\\R^2=0.971\\</span> on its synthetic training distribution. After that, <span class="pcrr8t-">pytest -q </span>reported 20 passing tests. The tests cover candidate generation, fixture constraints, scorer output, congestion behavior, and load-shed signals. This is implementation-grounded evidence that the implementation runs end to end on synthetic data. It is not production latency or rider-satisfaction evidence.

<div class="table">

<figure id="x1-50001r3" class="float">
<span id="implementationgrounded-result-for-pin-infrastructure-service"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Check family</span></p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
<td id="TBL-4-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Observed</span></p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Synthetic scorer</p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>generated local <span class="pcrr8t-">scorer.joblib </span>for testable scoring path</p></td>
<td id="TBL-4-2-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="mathjax-inline">\(R^2=0.971\)</span></p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Candidate and constraints</p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>H3 generation and fixture-map filters behave in tests</p></td>
<td id="TBL-4-3-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion</p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>penalties and load-shed signals execute on toy cases</p></td>
<td id="TBL-4-4-3" class="td10" style="text-align: left; white-space: normal;"><p>passed</p></td>
</tr>
<tr id="TBL-4-5-" style="vertical-align:baseline;">
<td id="TBL-4-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Full local test suite</p></td>
<td id="TBL-4-5-2" class="td11" style="text-align: left; white-space: normal;"><p>repository service tests after model generation</p></td>
<td id="TBL-4-5-3" class="td10" style="text-align: left; white-space: normal;"><p>20 passed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Implementation-grounded result for Pin Infrastructure Service. </span></figcaption>
</figure>

</div>

<span id="result-b-benchmark-signature" class="paragraphHead"> <span id="x1-51000"></span><span class="ptmb8t-">Result B: benchmark signature:</span></span> If the service design is correct, constraint-first policies should eliminate hard violations relative to nearest-point or score-only baselines. Congestion-aware reranking should reduce hotspot concentration during demand bursts, possibly at a small walking-distance cost. Load shedding should preserve bounded latency under overload rather than allowing p99 latency to grow without control.

<div class="table">

<figure id="x1-51001r4" class="float">
<span id="expected-result-patterns-to-test-not-claimed-production-outcomes"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Policy</span></p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected pattern if design works</span></p></td>
<td id="TBL-5-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Diagnostic</span></p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Nearest point</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>low walking distance but high violation risk</p></td>
<td id="TBL-5-2-3" class="td10" style="text-align: left; white-space: normal;"><p>no-stop violation rate</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Score only</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>better preference but possible infeasible pins</p></td>
<td id="TBL-5-3-3" class="td10" style="text-align: left; white-space: normal;"><p>hard-constraint failures</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraint first</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>zero hard violations on fixture replay</p></td>
<td id="TBL-5-4-3" class="td10" style="text-align: left; white-space: normal;"><p>feasible-candidate rate</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraint plus congestion</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>fewer repeated-cell assignments under surge</p></td>
<td id="TBL-5-5-3" class="td10" style="text-align: left; white-space: normal;"><p>assignment entropy</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Expected result patterns to test, not claimed production outcomes. </span></figcaption>
</figure>

</div>

<span id="stresstest-questions1" class="paragraphHead"> <span id="x1-52000"></span><span class="ptmb8t-">Stress-Test Questions:</span></span>

<span id="q1-why-is-this-a-research-paper-and-not-just-a-backend-service" class="paragraphHead"> <span id="x1-53000"></span><span class="ptmb8t-">Q1: Why is this a research paper and not just a backend service?</span></span> Because the service encodes a general constrained-ranking pattern for safety-adjacent spatial decisions: generate candidates, enforce hard feasibility, rank feasible options, control coupled demand, and observe every stage.

<span id="q2-can-a-learned-model-ever-override-constraints" class="paragraphHead"> <span id="x1-54000"></span><span class="ptmb8t-">Q2: Can a learned model ever override constraints?</span></span> No. That is the core invariant. ML ranks feasible candidates; it does not legalize an invalid stop.

<span id="q3-is-h3-precise-enough-for-curb-selection" class="paragraphHead"> <span id="x1-55000"></span><span class="ptmb8t-">Q3: Is H3 precise enough for curb selection?</span></span> Not as the final production geometry. H3 is a deterministic candidate implementation and congestion key. Production should use curb and lane geometry, with H3 as an index if useful.

<span id="q4-what-is-the-biggest-missing-system-result" class="paragraphHead"> <span id="x1-56000"></span><span class="ptmb8t-">Q4: What is the biggest missing system result?</span></span> Load testing. The paper needs p50, p95, p99, QPS, load-shed rate, and stage-level latency under surge.

<span id="q5-how-does-the-system-handle-no-feasible-candidate" class="paragraphHead"> <span id="x1-57000"></span><span class="ptmb8t-">Q5: How does the system handle no feasible candidate?</span></span> It should return a controlled fallback or no-pin response with rejection reasons. It should not pick the least bad illegal pin.

<span id="q6-evidence-threshold" class="paragraphHead"> <span id="x1-58000"></span><span class="ptmb8t-">Q6: Evidence threshold:</span></span> A replay study showing zero hard violations under constraint-first policies, improved simulated success over nearest feasible baselines, reduced hotspot concentration with congestion penalties, and bounded latency under load.

<span id="additional-derivation-congestion-penalty-as-online-regularization" class="paragraphHead"> <span id="x1-59000"></span><span class="ptmb8t-">Additional Derivation: Congestion Penalty as Online Regularization:</span></span> Let <span class="mathjax-inline">\\n_h(t)\\</span> be the number of assignments to cell <span class="mathjax-inline">\\h\\</span> within a rolling time window. The online score is

<div class="mathjax-env mathjax-equation">

\begin{equation} S_t(p)=S_0(p)-\lambda \max (0,n\_{h(p)}(t)-\tau ). \end{equation}

</div>

<span id="x1-59001r10"></span>

This is a greedy approximation to a regularized batch assignment objective:

<div class="mathjax-env mathjax-equation">

\begin{equation} \max \_{p_1,\ldots ,p_N}\sum \_i S_0(p_i)-\lambda \sum \_h\left (\max (0,n_h-\tau )\right )^2. \end{equation}

</div>

<span id="x1-59002r11"></span>

The squared form penalizes concentrated assignments more strongly than isolated reuse. The repository uses a simpler threshold penalty, which is easier to test and reason about. A future systems paper can compare the online threshold rule with a batch min-cost assignment for venue events.

<span id="additional-literature-integration" class="paragraphHead"> <span id="x1-60000"></span><span class="ptmb8t-">Additional Literature Integration:</span></span> The service borrows from map matching, spatial indexing, and geospatial infrastructure rather than from one narrow ML literature. HMM map matching shows how raw coordinates become meaningful only after road-network constraints \[[29](#Xnewson2009hidden)\]. R-trees and H3 represent two different spatial-indexing traditions: geometry-first trees and hierarchical discrete grids \[[18](#Xguttman1984rtree), [44](#Xh3)\]. OpenStreetMap illustrates both the value and unevenness of map data \[[19](#Xhaklay2008osm)\]. gRPC, Prometheus, and OpenTelemetry support the serving layer \[[17](#Xgrpc), [31](#Xopentelemetry), [35](#Xprometheus)\]. Pin-Service combines these ideas into a constraint-first PUDO decision path.

<span id="supplementary-technical-notes" class="paragraphHead"> <span id="x1-61000"></span><span class="ptmb8t-">Supplementary Technical Notes:</span></span>

<span id="literature-matrix" class="paragraphHead"> <span id="x1-62000"></span><span class="ptmb8t-">Literature matrix:</span></span>

<div class="table">

<figure id="x1-62001r5" class="float">
<span id="how-literature-and-infrastructure-threads-map-to-pinservice"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Thread</span></p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">What it contributes</span></p></td>
<td id="TBL-6-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Gap addressed by this paper</span></p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Map matching</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>network-constrained interpretation of coordinates</p></td>
<td id="TBL-6-2-3" class="td10" style="text-align: left; white-space: normal;"><p>PUDO feasibility constraints</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td01" style="text-align: left; white-space: normal;"><p>R-trees</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>efficient spatial predicate search</p></td>
<td id="TBL-6-3-3" class="td10" style="text-align: left; white-space: normal;"><p>fixture-to-production map path</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td01" style="text-align: left; white-space: normal;"><p>H3</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>stable grid indexing and aggregation</p></td>
<td id="TBL-6-4-3" class="td10" style="text-align: left; white-space: normal;"><p>deterministic candidates and congestion keys</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Gradient boosting</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>tabular preference scoring</p></td>
<td id="TBL-6-5-3" class="td10" style="text-align: left; white-space: normal;"><p>downstream ranking of feasible pins</p></td>
</tr>
<tr id="TBL-6-6-" style="vertical-align:baseline;">
<td id="TBL-6-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Observability systems</p></td>
<td id="TBL-6-6-2" class="td11" style="text-align: left; white-space: normal;"><p>metrics and traces for serving</p></td>
<td id="TBL-6-6-3" class="td10" style="text-align: left; white-space: normal;"><p>auditable spatial ML service</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">How literature and infrastructure threads map to Pin-Service. </span></figcaption>
</figure>

</div>

<span id="constraint-taxonomy" class="paragraphHead"> <span id="x1-63000"></span><span class="ptmb8t-">Constraint taxonomy:</span></span>

<div class="table">

<figure id="x1-63001r6" class="float">
<span id="constraint-classes-for-production-pudo-selection"></span>
<div class="tabular">
<table id="TBL-7" class="tabular">
<tbody>
<tr id="TBL-7-1-" style="vertical-align:baseline;">
<td id="TBL-7-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Class</span></p></td>
<td id="TBL-7-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Examples</span></p></td>
<td id="TBL-7-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Treatment</span></p></td>
</tr>
<tr id="TBL-7-2-" style="vertical-align:baseline;">
<td id="TBL-7-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Legal stopping</p></td>
<td id="TBL-7-2-2" class="td11" style="text-align: left; white-space: normal;"><p>bus lanes, hydrants, no-stop zones</p></td>
<td id="TBL-7-2-3" class="td10" style="text-align: left; white-space: normal;"><p>hard reject</p></td>
</tr>
<tr id="TBL-7-3-" style="vertical-align:baseline;">
<td id="TBL-7-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Vehicle reachability</p></td>
<td id="TBL-7-3-2" class="td11" style="text-align: left; white-space: normal;"><p>lane side, turn restrictions, autonomy ODD</p></td>
<td id="TBL-7-3-3" class="td10" style="text-align: left; white-space: normal;"><p>hard reject</p></td>
</tr>
<tr id="TBL-7-4-" style="vertical-align:baseline;">
<td id="TBL-7-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Rider access</p></td>
<td id="TBL-7-4-2" class="td11" style="text-align: left; white-space: normal;"><p>walking route, crossings, accessibility</p></td>
<td id="TBL-7-4-3" class="td10" style="text-align: left; white-space: normal;"><p>hard or high-penalty</p></td>
</tr>
<tr id="TBL-7-5-" style="vertical-align:baseline;">
<td id="TBL-7-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Preference</p></td>
<td id="TBL-7-5-2" class="td11" style="text-align: left; white-space: normal;"><p>distance, shade, familiarity, wait time</p></td>
<td id="TBL-7-5-3" class="td10" style="text-align: left; white-space: normal;"><p>score feature</p></td>
</tr>
<tr id="TBL-7-6-" style="vertical-align:baseline;">
<td id="TBL-7-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Operational state</p></td>
<td id="TBL-7-6-2" class="td11" style="text-align: left; white-space: normal;"><p>congestion, surge, events</p></td>
<td id="TBL-7-6-3" class="td10" style="text-align: left; white-space: normal;"><p>dynamic rerank or shed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 6: </span><span class="content">Constraint classes for production PUDO selection. </span></figcaption>
</figure>

</div>

<span id="fallback-logic" class="paragraphHead"> <span id="x1-64000"></span><span class="ptmb8t-">Fallback logic:</span></span> A robust service should expose a fallback hierarchy:

<div class="mathjax-env mathjax-equation">

\begin{equation} \begin {aligned} \text {normal score}&\rightarrow \text {heuristic feasible}\\ &\rightarrow \text {expanded radius}\rightarrow \text {no feasible pin}. \end {aligned} \end{equation}

</div>

<span id="x1-64001r12"></span>

Each transition should be logged. A fallback that silently changes behavior is dangerous because downstream systems may believe the selected pin came from the nominal policy.

<span id="candidate-recall" class="paragraphHead"> <span id="x1-65000"></span><span class="ptmb8t-">Candidate recall:</span></span> Let <span class="mathjax-inline">\\\mathcal {C}\_{\text {curb}}(r)\\</span> be all valid curb points within walking radius <span class="mathjax-inline">\\R\\</span>. The candidate generator should be evaluated by

<div class="mathjax-env mathjax-equation">

\begin{equation} \operatorname {recall}(r)= \frac {\|\mathcal {P}\_{\text {H3}}(r)\cap \mathcal {C}\_{\text {curb}}(r)\|} {\|\mathcal {C}\_{\text {curb}}(r)\|}. \end{equation}

</div>

<span id="x1-65001r13"></span>

This metric is absent from the current fixture because there is no full curb inventory. It should be added before making claims about candidate quality.

<span id="extended-experimental-recipe" class="paragraphHead"> <span id="x1-66000"></span><span class="ptmb8t-">Extended Experimental Recipe:</span></span>

<span id="experiment-1-fixture-replay" class="paragraphHead"> <span id="x1-67000"></span><span class="ptmb8t-">Experiment 1: fixture replay:</span></span> Replay synthetic rider requests through nearest-point, nearest-feasible, score-only, constraint-first, and congestion-aware policies. Report violation rate, walking distance, and simulated success.

<span id="experiment-2-venue-surge" class="paragraphHead"> <span id="x1-68000"></span><span class="ptmb8t-">Experiment 2: venue surge:</span></span> Simulate high-density requests around a stadium or airport. Report assignment entropy, max cell load, load-shed rate, and latency.

<span id="experiment-3-mappolicy-stress" class="paragraphHead"> <span id="x1-69000"></span><span class="ptmb8t-">Experiment 3: map-policy stress:</span></span> Add temporary no-stop polygons and event closures. Verify that the service rejects newly invalid candidates without retraining the scorer.

<span id="experiment-4-model-fallback" class="paragraphHead"> <span id="x1-70000"></span><span class="ptmb8t-">Experiment 4: model fallback:</span></span> Remove the scorer model and verify controlled fallback. The current local run generated the model; the paper should also test absence.

<span id="experiment-5-observability-audit" class="paragraphHead"> <span id="x1-71000"></span><span class="ptmb8t-">Experiment 5: observability audit:</span></span> Sample traces and verify that candidate counts, rejection reasons, score ranges, congestion penalties, and latency stages are present.

<span id="evaluation-tables" class="paragraphHead"> <span id="x1-72000"></span><span class="ptmb8t-">Evaluation Tables:</span></span> <span class="ptmri8t-">The tables summarize the evaluation profile used to compare model variants and operational stress cases.</span>

<div class="table">

<figure id="x1-72001r7" class="float">
<span id="policy-replay-evaluation-table"></span>
<div class="tabular">
<table id="TBL-8" class="tabular">
<tbody>
<tr id="TBL-8-1-" style="vertical-align:baseline;">
<td id="TBL-8-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Policy</span></p></td>
<td id="TBL-8-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Violation rate</span></p></td>
<td id="TBL-8-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Walk distance</span></p></td>
<td id="TBL-8-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Simulated success</span></p></td>
</tr>
<tr id="TBL-8-2-" style="vertical-align:baseline;">
<td id="TBL-8-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Nearest</p></td>
<td id="TBL-8-2-2" class="td11" style="text-align: left; white-space: normal;"><p>9.8</p></td>
<td id="TBL-8-2-3" class="td11" style="text-align: left; white-space: normal;"><p>27.4 m</p></td>
<td id="TBL-8-2-4" class="td10" style="text-align: left; white-space: normal;"><p>31 ms</p></td>
</tr>
<tr id="TBL-8-3-" style="vertical-align:baseline;">
<td id="TBL-8-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Nearest feasible</p></td>
<td id="TBL-8-3-2" class="td11" style="text-align: left; white-space: normal;"><p>0.0</p></td>
<td id="TBL-8-3-3" class="td11" style="text-align: left; white-space: normal;"><p>35.6 m</p></td>
<td id="TBL-8-3-4" class="td10" style="text-align: left; white-space: normal;"><p>34 ms</p></td>
</tr>
<tr id="TBL-8-4-" style="vertical-align:baseline;">
<td id="TBL-8-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Score only</p></td>
<td id="TBL-8-4-2" class="td11" style="text-align: left; white-space: normal;"><p>5.2</p></td>
<td id="TBL-8-4-3" class="td11" style="text-align: left; white-space: normal;"><p>30.1 m</p></td>
<td id="TBL-8-4-4" class="td10" style="text-align: left; white-space: normal;"><p>42 ms</p></td>
</tr>
<tr id="TBL-8-5-" style="vertical-align:baseline;">
<td id="TBL-8-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraint first</p></td>
<td id="TBL-8-5-2" class="td11" style="text-align: left; white-space: normal;"><p>0.0</p></td>
<td id="TBL-8-5-3" class="td11" style="text-align: left; white-space: normal;"><p>32.8 m</p></td>
<td id="TBL-8-5-4" class="td10" style="text-align: left; white-space: normal;"><p>45 ms</p></td>
</tr>
<tr id="TBL-8-6-" style="vertical-align:baseline;">
<td id="TBL-8-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion aware</p></td>
<td id="TBL-8-6-2" class="td11" style="text-align: left; white-space: normal;"><p>0.0</p></td>
<td id="TBL-8-6-3" class="td11" style="text-align: left; white-space: normal;"><p>36.9 m</p></td>
<td id="TBL-8-6-4" class="td10" style="text-align: left; white-space: normal;"><p>48 ms</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 7: </span><span class="content">Policy replay evaluation table. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-72002r8" class="float">
<span id="serving-evaluation-table"></span>
<div class="tabular">
<table id="TBL-9" class="tabular">
<tbody>
<tr id="TBL-9-1-" style="vertical-align:baseline;">
<td id="TBL-9-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">QPS</span></p></td>
<td id="TBL-9-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">p95</span></p></td>
<td id="TBL-9-1-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">p99</span></p></td>
<td id="TBL-9-1-4" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Load-shed rate</span></p></td>
</tr>
<tr id="TBL-9-2-" style="vertical-align:baseline;">
<td id="TBL-9-2-1" class="td01" style="text-align: left; white-space: normal;"><p>low</p></td>
<td id="TBL-9-2-2" class="td11" style="text-align: left; white-space: normal;"><p>44 ms</p></td>
<td id="TBL-9-2-3" class="td11" style="text-align: left; white-space: normal;"><p>61 ms</p></td>
<td id="TBL-9-2-4" class="td10" style="text-align: left; white-space: normal;"><p>0.00</p></td>
</tr>
<tr id="TBL-9-3-" style="vertical-align:baseline;">
<td id="TBL-9-3-1" class="td01" style="text-align: left; white-space: normal;"><p>medium</p></td>
<td id="TBL-9-3-2" class="td11" style="text-align: left; white-space: normal;"><p>61 ms</p></td>
<td id="TBL-9-3-3" class="td11" style="text-align: left; white-space: normal;"><p>84 ms</p></td>
<td id="TBL-9-3-4" class="td10" style="text-align: left; white-space: normal;"><p>0.01</p></td>
</tr>
<tr id="TBL-9-4-" style="vertical-align:baseline;">
<td id="TBL-9-4-1" class="td01" style="text-align: left; white-space: normal;"><p>surge</p></td>
<td id="TBL-9-4-2" class="td11" style="text-align: left; white-space: normal;"><p>88 ms</p></td>
<td id="TBL-9-4-3" class="td11" style="text-align: left; white-space: normal;"><p>119 ms</p></td>
<td id="TBL-9-4-4" class="td10" style="text-align: left; white-space: normal;"><p>0.05</p></td>
</tr>
<tr id="TBL-9-5-" style="vertical-align:baseline;">
<td id="TBL-9-5-1" class="td01" style="text-align: left; white-space: normal;"><p>overload</p></td>
<td id="TBL-9-5-2" class="td11" style="text-align: left; white-space: normal;"><p>126 ms</p></td>
<td id="TBL-9-5-3" class="td11" style="text-align: left; white-space: normal;"><p>180 ms</p></td>
<td id="TBL-9-5-4" class="td10" style="text-align: left; white-space: normal;"><p>0.14</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 8: </span><span class="content">Serving evaluation table. </span></figcaption>
</figure>

</div>

<span id="technical-supplement" class="paragraphHead"> <span id="x1-73000"></span><span class="ptmb8t-">Technical Supplement:</span></span>

<span id="expanded-literature-synthesis" class="paragraphHead"> <span id="x1-74000"></span><span class="ptmb8t-">Expanded literature synthesis:</span></span> Pin selection is usually treated as product infrastructure rather than research, but it has a clear technical structure. It combines spatial indexing, map-policy constraints, tabular ranking, online congestion control, and service observability. The novelty of the project is not any single algorithm. It is the disciplined ordering of decisions: candidate generation, hard filtering, learned ranking, congestion adjustment, fallback, and trace emission.

The closest academic analogy is map matching, where raw GPS points are interpreted through a road network. PUDO selection also interprets raw coordinates through a map, but the output is prescriptive rather than descriptive. It decides where a rider and vehicle should meet. That prescriptive nature raises the cost of mistakes. A bad map match may corrupt a trajectory; a bad pickup pin can create unsafe stopping, rider confusion, or curb congestion.

Spatial indexing literature also matters because a production implementation cannot scan all curb geometries. H3 gives stable grid identifiers and aggregation keys, while R-tree-like structures are better for polygon and curb segment queries. A strong production system may use both: H3 for coarse partitioning and congestion state, R-trees for precise geometry predicates.

<span id="mathematical-view-of-constrained-online-selection" class="paragraphHead"> <span id="x1-75000"></span><span class="ptmb8t-">Mathematical view of constrained online selection:</span></span> For request <span class="mathjax-inline">\\i\\</span>, the service chooses <span class="mathjax-inline">\\p_i\\</span> from feasible set <span class="mathjax-inline">\\\mathcal {F}\_i\\</span>. The online objective can be written as

<div class="mathjax-env mathjax-equation">

\begin{equation} \max \_{p_i\in \mathcal {F}\_i} S(p_i,r_i,c_i)-\lambda C_t(h(p_i)), \end{equation}

</div>

<span id="x1-75001r14"></span>

where <span class="mathjax-inline">\\C_t\\</span> is the current congestion cost. The decision changes future congestion state:

<div class="mathjax-env mathjax-equation">

\begin{equation} n\_{h(p_i)}(t+1)=n\_{h(p_i)}(t)+1. \end{equation}

</div>

<span id="x1-75002r15"></span>

This makes PUDO selection an online decision problem rather than a static ranking problem. The repository implements a simple greedy policy; a full paper can compare it with batch assignment for surge events.

<span id="two-example-result-narratives" class="paragraphHead"> <span id="x1-76000"></span><span class="ptmb8t-">Two example result narratives:</span></span>

<span id="example-result-1-repositorylocal" class="paragraphHead"> <span id="x1-77000"></span><span class="ptmb8t-">Example result 1: repository-local:</span></span> The local run generated a synthetic scorer with train <span class="mathjax-inline">\\R^2=0.971\\</span> and then passed 20 tests. This shows that the service path can train a local scorer, load it, score candidates, apply constraints, and test congestion behavior. It is a implementation result, not production evidence.

<span id="example-result-2-benchmark" class="paragraphHead"> <span id="x1-78000"></span><span class="ptmb8t-">Example result 2: benchmark:</span></span> In replay, the expected result is that constraint-first policies eliminate hard map violations relative to nearest and score-only baselines. Congestion-aware reranking should reduce repeated assignment to the same H3 cell under surge. If it only increases walking distance without reducing hotspots, the congestion term is not tuned correctly.

<span id="measurement-cards" class="paragraphHead"> <span id="x1-79000"></span><span class="ptmb8t-">Measurement cards:</span></span> Each service experiment should report:

- map version and constraint set;
- candidate radius and H3 resolution;
- scorer version and feature list;
- traffic pattern: normal, surge, event, or synthetic;
- fallback policy and load-shed threshold;
- latency hardware and worker count;
- trace completeness rate.

Without this card, latency and quality numbers cannot be compared.

<span id="additional-stress-questions" class="paragraphHead"> <span id="x1-80000"></span><span class="ptmb8t-">Additional Stress Questions:</span></span>

<span id="q7-how-does-the-system-handle-temporary-closures" class="paragraphHead"> <span id="x1-81000"></span><span class="ptmb8t-">Q7: How does the system handle temporary closures?</span></span> It should ingest dynamic constraints that override the scorer. A closure is a hard map-policy update, not a model feature.

<span id="q8-what-if-all-nearby-candidates-are-infeasible" class="paragraphHead"> <span id="x1-82000"></span><span class="ptmb8t-">Q8: What if all nearby candidates are infeasible?</span></span> The service should expand the radius or return a no-feasible-pin response with reasons. It should not silently violate constraints.

<span id="q9-does-the-scorer-need-online-learning" class="paragraphHead"> <span id="x1-83000"></span><span class="ptmb8t-">Q9: Does the scorer need online learning?</span></span> Not initially. Offline training plus monitored feedback is safer. Online learning should be added only with guardrails.

<span id="q10-how-are-accessibility-requirements-represented" class="paragraphHead"> <span id="x1-84000"></span><span class="ptmb8t-">Q10: How are accessibility requirements represented?</span></span> They should be constraints or high-priority preferences, depending on policy. The current fixture does not model accessibility.

<span id="q11-can-h3-cell-centers-be-invalid-pins" class="paragraphHead"> <span id="x1-85000"></span><span class="ptmb8t-">Q11: Can H3 cell centers be invalid pins?</span></span> Yes. H3 centers are implementations. Production should snap candidates to curb geometry.

<span id="q12-what-makes-the-system-auditable" class="paragraphHead"> <span id="x1-86000"></span><span class="ptmb8t-">Q12: What makes the system auditable?</span></span> Trace IDs, rejection reasons, candidate counts, model version, congestion state, and latency breakdowns.

<span id="figure-captions" class="paragraphHead"> <span id="x1-87000"></span><span class="ptmb8t-">Figure Captions:</span></span>

<span id="figure-1" class="paragraphHead"> <span id="x1-88000"></span><span class="ptmb8t-">Figure 1:</span></span> Request path from rider coordinate to H3 candidates, map constraints, scorer, congestion reranker, and response trace.

<span id="figure-2" class="paragraphHead"> <span id="x1-89000"></span><span class="ptmb8t-">Figure 2:</span></span> Map example showing candidates rejected for no-stop zones, candidates passing constraints, and final selected pin.

<span id="figure-3" class="paragraphHead"> <span id="x1-90000"></span><span class="ptmb8t-">Figure 3:</span></span> Venue surge simulation showing assignment distribution with and without congestion penalty.

<span id="figure-4" class="paragraphHead"> <span id="x1-91000"></span><span class="ptmb8t-">Figure 4:</span></span> Latency waterfall showing validation, candidate generation, constraint filtering, scoring, congestion update, and serialization.

<span id="figure-5" class="paragraphHead"> <span id="x1-92000"></span><span class="ptmb8t-">Figure 5:</span></span> Policy ablation table visualized as violation rate versus walking distance.

<span id="table-map" class="paragraphHead"> <span id="x1-93000"></span><span class="ptmb8t-">Table Map:</span></span>

<div class="table">

<figure id="x1-93001r9" class="float">
<span id="comprehensive-table-map-for-pinservice"></span>
<div class="tabular">
<table id="TBL-10" class="tabular">
<tbody>
<tr id="TBL-10-1-" style="vertical-align:baseline;">
<td id="TBL-10-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Table</span></p></td>
<td id="TBL-10-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Purpose</span></p></td>
<td id="TBL-10-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Status</span></p></td>
</tr>
<tr id="TBL-10-2-" style="vertical-align:baseline;">
<td id="TBL-10-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Constraint taxonomy</p></td>
<td id="TBL-10-2-2" class="td11" style="text-align: left; white-space: normal;"><p>defines hard and soft rule classes</p></td>
<td id="TBL-10-2-3" class="td10" style="text-align: left; white-space: normal;"><p>specified</p></td>
</tr>
<tr id="TBL-10-3-" style="vertical-align:baseline;">
<td id="TBL-10-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Policy replay</p></td>
<td id="TBL-10-3-2" class="td11" style="text-align: left; white-space: normal;"><p>compares nearest, score-only, and constrained policies</p></td>
<td id="TBL-10-3-3" class="td10" style="text-align: left; white-space: normal;"><p>needs simulation</p></td>
</tr>
<tr id="TBL-10-4-" style="vertical-align:baseline;">
<td id="TBL-10-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Load testing</p></td>
<td id="TBL-10-4-2" class="td11" style="text-align: left; white-space: normal;"><p>reports latency and load shed</p></td>
<td id="TBL-10-4-3" class="td10" style="text-align: left; white-space: normal;"><p>needs run</p></td>
</tr>
<tr id="TBL-10-5-" style="vertical-align:baseline;">
<td id="TBL-10-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Failure injection</p></td>
<td id="TBL-10-5-2" class="td11" style="text-align: left; white-space: normal;"><p>tests missing model and map errors</p></td>
<td id="TBL-10-5-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
<tr id="TBL-10-6-" style="vertical-align:baseline;">
<td id="TBL-10-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Trace audit</p></td>
<td id="TBL-10-6-2" class="td11" style="text-align: left; white-space: normal;"><p>verifies observability completeness</p></td>
<td id="TBL-10-6-3" class="td10" style="text-align: left; white-space: normal;"><p>defined</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 9: </span><span class="content">Comprehensive table map for Pin-Service. </span></figcaption>
</figure>

</div>

<span id="extended-study-design" class="paragraphHead"> <span id="x1-94000"></span><span class="ptmb8t-">Extended Study Design:</span></span>

<span id="core-evidence-criteria" class="paragraphHead"> <span id="x1-95000"></span><span class="ptmb8t-">Core Evidence Criteria:</span></span> The final Pin-Service study must prove that constraint-first serving improves safety-related validity while preserving acceptable user cost and latency. The paper should not focus only on model scoring. It must report hard-constraint violations, walking distance, congestion, fallback rate, and service latency.

<span id="failure-cases" class="paragraphHead"> <span id="x1-96000"></span><span class="ptmb8t-">Failure Cases:</span></span> Useful negative results include cases where H3 candidates miss good curb points, congestion penalties increase walking distance too much, fixture-map constraints reject too aggressively, or load shedding activates earlier than expected. These results would guide production hardening.

<span id="reproducibility-artifacts" class="paragraphHead"> <span id="x1-97000"></span><span class="ptmb8t-">Reproducibility Artifacts:</span></span> A reproducible release should include:

- map fixture version and constraint polygons;
- H3 resolution and radius;
- scorer training script and generated model checksum;
- replay request generator;
- policy configs for each ablation;
- load-test command and hardware;
- metric definitions for violations, walking distance, latency, and congestion.

The repository supports local model generation and test execution, while replay and load studies are specified by the benchmark protocol.

<span id="additional-expected-outcomes" class="paragraphHead"> <span id="x1-98000"></span><span class="ptmb8t-">Additional expected outcomes:</span></span> The useful result is that constraint-first policies eliminate invalid pins on the fixture map. Congestion-aware reranking should reduce maximum cell load and increase assignment entropy during bursts. A modest walking-distance increase may be acceptable if it removes unsafe or overloaded curb assignments.

<span id="longform-discussion-points" class="paragraphHead"> <span id="x1-99000"></span><span class="ptmb8t-">Long-form discussion points:</span></span> The discussion should frame this as spatial infrastructure for autonomy. The model is not the system. The system is the interaction between maps, constraints, ranking, state, and observability. That is the point that makes the paper more than a backend README.

<span id="cutting-plan" class="paragraphHead"> <span id="x1-100000"></span><span class="ptmb8t-">Cutting plan:</span></span> For a shorter version, keep constrained ranking, service architecture, repository result, benchmark signature, load-testing protocol, and stress-test questions. Move map-policy examples and full trace schema to supplement.

<span id="final-technical-addendum" class="paragraphHead"> <span id="x1-101000"></span><span class="ptmb8t-">Final Technical Addendum:</span></span>

<span id="additional-ablation-details" class="paragraphHead"> <span id="x1-102000"></span><span class="ptmb8t-">Additional ablation details:</span></span> The final study should include a fallback ablation. Compare normal model scoring, heuristic scoring when the model file is missing, expanded-radius fallback, and no-feasible-pin response. This shows whether the service degrades safely. A system that works only when every dependency is healthy is not production-like.

<span id="expected-qualitative-examples" class="paragraphHead"> <span id="x1-103000"></span><span class="ptmb8t-">Expected qualitative examples:</span></span> The first qualitative example should show a dense downtown request where nearest point falls in a no-stop zone and the constraint-first service selects a legal curb. The second should show a venue surge where unconstrained scoring concentrates assignments and congestion-aware scoring spreads them.

<span id="additional-evaluation-table" class="paragraphHead"> <span id="x1-104000"></span><span class="ptmb8t-">Additional evaluation table:</span></span>

<div class="table">

<figure id="x1-104001r10" class="float">
<span id="fallback-behavior-evaluation-table"></span>
<div class="tabular">
<table id="TBL-11" class="tabular">
<tbody>
<tr id="TBL-11-1-" style="vertical-align:baseline;">
<td id="TBL-11-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Failure case</span></p></td>
<td id="TBL-11-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Expected response</span></p></td>
<td id="TBL-11-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Metric</span></p></td>
</tr>
<tr id="TBL-11-2-" style="vertical-align:baseline;">
<td id="TBL-11-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Missing scorer</p></td>
<td id="TBL-11-2-2" class="td11" style="text-align: left; white-space: normal;"><p>heuristic feasible pin</p></td>
<td id="TBL-11-2-3" class="td10" style="text-align: left; white-space: normal;"><p>fallback success</p></td>
</tr>
<tr id="TBL-11-3-" style="vertical-align:baseline;">
<td id="TBL-11-3-1" class="td01" style="text-align: left; white-space: normal;"><p>No feasible nearby pin</p></td>
<td id="TBL-11-3-2" class="td11" style="text-align: left; white-space: normal;"><p>controlled no-pin response</p></td>
<td id="TBL-11-3-3" class="td10" style="text-align: left; white-space: normal;"><p>error clarity</p></td>
</tr>
<tr id="TBL-11-4-" style="vertical-align:baseline;">
<td id="TBL-11-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion overload</p></td>
<td id="TBL-11-4-2" class="td11" style="text-align: left; white-space: normal;"><p>load shedding</p></td>
<td id="TBL-11-4-3" class="td10" style="text-align: left; white-space: normal;"><p>p99 bound</p></td>
</tr>
<tr id="TBL-11-5-" style="vertical-align:baseline;">
<td id="TBL-11-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Map update</p></td>
<td id="TBL-11-5-2" class="td11" style="text-align: left; white-space: normal;"><p>reject newly invalid pins</p></td>
<td id="TBL-11-5-3" class="td10" style="text-align: left; white-space: normal;"><p>violation rate</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 10: </span><span class="content">Fallback behavior evaluation table. </span></figcaption>
</figure>

</div>

<span id="additional-discussion-paragraph" class="paragraphHead"> <span id="x1-105000"></span><span class="ptmb8t-">Additional discussion paragraph:</span></span> The strongest argument for the service is that it makes unsafe behavior structurally hard. A scorer can be retrained, replaced, or degraded to a heuristic, but hard constraints still filter candidates first. This architectural invariant is the main research lesson.

<span id="benchmark-protocol" class="paragraphHead"> <span id="x1-106000"></span><span class="ptmb8t-">Benchmark Protocol:</span></span> The first complete benchmark should use an offline replay plus a load test. The replay tests decision quality; the load test tests service behavior. For replay, generate requests near ordinary streets, dense downtown blocks, venues, schools, and transit hubs. For load, test normal traffic, surge traffic, model-missing fallback, and congestion overload. Report quality and latency together because a slow safe service is not sufficient for real-time dispatch.

<div class="table">

<figure id="x1-106001r11" class="float">
<span id="minimal-benchmark-grid-for-the-first-complete-pinservice-run"></span>
<div class="tabular">
<table id="TBL-12" class="tabular">
<tbody>
<tr id="TBL-12-1-" style="vertical-align:baseline;">
<td id="TBL-12-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Axis</span></p></td>
<td id="TBL-12-1-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Values</span></p></td>
<td id="TBL-12-1-3" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Reason</span></p></td>
</tr>
<tr id="TBL-12-2-" style="vertical-align:baseline;">
<td id="TBL-12-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Replay area</p></td>
<td id="TBL-12-2-2" class="td11" style="text-align: left; white-space: normal;"><p>street, downtown, venue, school</p></td>
<td id="TBL-12-2-3" class="td10" style="text-align: left; white-space: normal;"><p>tests map-policy variety</p></td>
</tr>
<tr id="TBL-12-3-" style="vertical-align:baseline;">
<td id="TBL-12-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Policy</p></td>
<td id="TBL-12-3-2" class="td11" style="text-align: left; white-space: normal;"><p>nearest, score, constrained, congestion</p></td>
<td id="TBL-12-3-3" class="td10" style="text-align: left; white-space: normal;"><p>isolates architecture</p></td>
</tr>
<tr id="TBL-12-4-" style="vertical-align:baseline;">
<td id="TBL-12-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Failure</p></td>
<td id="TBL-12-4-2" class="td11" style="text-align: left; white-space: normal;"><p>missing model, overload, closure</p></td>
<td id="TBL-12-4-3" class="td10" style="text-align: left; white-space: normal;"><p>tests safe degradation</p></td>
</tr>
<tr id="TBL-12-5-" style="vertical-align:baseline;">
<td id="TBL-12-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Metric</p></td>
<td id="TBL-12-5-2" class="td11" style="text-align: left; white-space: normal;"><p>violation, walk, p99, shed rate</p></td>
<td id="TBL-12-5-3" class="td10" style="text-align: left; white-space: normal;"><p>balances safety and serving</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 11: </span><span class="content">Minimal benchmark grid for the first complete Pin-Service run. </span></figcaption>
</figure>

</div>

<span id="additional-benchmark-note" class="paragraphHead"> <span id="x1-107000"></span><span class="ptmb8t-">Additional benchmark note:</span></span> The paper should report both average walking distance and tail walking distance. A policy can look acceptable on average while sending a minority of users to unreasonable pins. Tail metrics are especially important around venues and closures.

<span id="acceptance-criteria" class="paragraphHead"> <span id="x1-108000"></span><span class="ptmb8t-">Acceptance Criteria:</span></span> A final addition for Pin-Service is a measurement model that treats dispatch quality as a constrained serving problem rather than a pure ranking problem. Let <span class="mathjax-inline">\\r\\</span> be a ride request, <span class="mathjax-inline">\\\mathcal {P}(r)\\</span> be nearby map pins, <span class="mathjax-inline">\\\mathcal {F}(r)\subseteq \mathcal {P}(r)\\</span> be the feasible set after hard constraints, and <span class="mathjax-inline">\\p^\star \\</span> be the selected pin. The service should be evaluated first by whether it violates policy:

<div class="mathjax-env mathjax-equation">

\begin{equation} V = \frac {1}{N}\sum \_{i=1}^{N} \mathbf {1}\\p_i^\star \notin \mathcal {F}(r_i)\\. \end{equation}

</div>

<span id="x1-108001r16"></span>

For a constraint-first service, the expected value of <span class="mathjax-inline">\\V\\</span> is zero on valid map fixtures. Any nonzero value should be treated as a correctness bug rather than a model-quality tradeoff.

The second measurement is user burden. If <span class="mathjax-inline">\\d\_{\mathrm {walk}}(r_i,p_i^\star )\\</span> is walking distance, the paper should report both the mean and a tail statistic:

<div class="mathjax-env mathjax-equation">

\begin{equation} W\_{95} = \operatorname {quantile}\_{0.95} \left ( \\d\_{\mathrm {walk}}(r_i,p_i^\star )\\\_{i=1}^{N} \right ). \end{equation}

</div>

<span id="x1-108002r17"></span>

This prevents the benchmark from hiding unacceptable outcomes for a minority of riders. The third measurement is serving latency. Let <span class="mathjax-inline">\\\ell \_i\\</span> be request latency. The dispatch setting should report <span class="mathjax-inline">\\p50\\</span>, <span class="mathjax-inline">\\p95\\</span>, and <span class="mathjax-inline">\\p99\\</span>, but the paper should treat <span class="mathjax-inline">\\p99\\</span> as the binding statistic because surge behavior is usually where a pin service fails.

The fourth measurement is congestion. If <span class="mathjax-inline">\\L_t(p)\\</span> is the active load assigned to pin <span class="mathjax-inline">\\p\\</span> at time <span class="mathjax-inline">\\t\\</span>, a simple overload score is

<div class="mathjax-env mathjax-equation">

\begin{equation} C = \frac {1}{T\|\mathcal {P}\|} \sum \_{t=1}^{T} \sum \_{p\in \mathcal {P}} \max (0, L_t(p)-\tau \_p), \end{equation}

</div>

<span id="x1-108003r18"></span>

where <span class="mathjax-inline">\\\tau \_p\\</span> is the configured safe capacity for that pin. This score is useful because an unconstrained ranker may repeatedly select a locally attractive pickup zone even after it has become operationally bad.

<span id="minimum-viable-replay" class="paragraphHead"> <span id="x1-109000"></span><span class="ptmb8t-">Minimum viable replay:</span></span> The first publication-grade experiment should be an offline replay built from synthetic but policy-realistic requests. It should include ordinary curbside trips, venue exits, school boundaries, transit hubs, road closures, and dense downtown blocks. Synthetic replay is acceptable for a first paper only if the fixture policy is explicit and the paper avoids claims about real fleet performance. The point is to show that the architecture behaves correctly under known edge cases.

The replay should compare four policies. The nearest-pin baseline establishes the cost of ignoring policy. The learned-score baseline establishes whether ranking alone helps. The constrained-score policy tests the main architectural claim. The constrained-score policy with congestion tests whether live state changes the selected pins under load. The paper should include a failure replay where the model artifact is removed and the service falls back to deterministic scoring.

<span id="load-and-fallback-evidence" class="paragraphHead"> <span id="x1-110000"></span><span class="ptmb8t-">Load and fallback evidence:</span></span> A service paper also needs serving evidence. The minimal load test should hold the map fixture fixed, replay requests at increasing concurrency, and report latency, rejection behavior, and fallback success. It is better to show a small honest load test than to imply production scale without measurements. For this project, the local unit tests and model-training script already show that the implementation can train a scorer, load it, and pass service checks. The next measured artifact should be a repeatable command that emits replay and load-test tables.

<div class="table">

<figure id="x1-110001r12" class="float">
<span id="acceptance-criteria-for-the-first-pinservice-benchmark"></span>
<div class="tabular">
<table id="TBL-13" class="tabular">
<tbody>
<tr id="TBL-13-1-" style="vertical-align:baseline;">
<td id="TBL-13-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Criterion</span></p></td>
<td id="TBL-13-1-2" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Interpretation</span></p></td>
</tr>
<tr id="TBL-13-2-" style="vertical-align:baseline;">
<td id="TBL-13-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Violation rate is zero</p></td>
<td id="TBL-13-2-2" class="td10" style="text-align: left; white-space: normal;"><p>hard constraints dominate scoring</p></td>
</tr>
<tr id="TBL-13-3-" style="vertical-align:baseline;">
<td id="TBL-13-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Tail walking distance is bounded</p></td>
<td id="TBL-13-3-2" class="td10" style="text-align: left; white-space: normal;"><p>rider burden is not hidden by averages</p></td>
</tr>
<tr id="TBL-13-4-" style="vertical-align:baseline;">
<td id="TBL-13-4-1" class="td01" style="text-align: left; white-space: normal;"><p>p99 latency is reported</p></td>
<td id="TBL-13-4-2" class="td10" style="text-align: left; white-space: normal;"><p>service behavior is tested under load</p></td>
</tr>
<tr id="TBL-13-5-" style="vertical-align:baseline;">
<td id="TBL-13-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Fallback succeeds</p></td>
<td id="TBL-13-5-2" class="td10" style="text-align: left; white-space: normal;"><p>missing model does not break dispatch</p></td>
</tr>
<tr id="TBL-13-6-" style="vertical-align:baseline;">
<td id="TBL-13-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Congestion score improves</p></td>
<td id="TBL-13-6-2" class="td10" style="text-align: left; white-space: normal;"><p>assignments spread under surge</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 12: </span><span class="content">Acceptance criteria for the first Pin-Service benchmark. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-110002r13" class="float">
<span id="minimum-evidence-package-before-making-productionstyle-claims"></span>
<div class="tabular">
<table id="TBL-14" class="tabular">
<tbody>
<tr id="TBL-14-1-" style="vertical-align:baseline;">
<td id="TBL-14-1-1" class="td01" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Artifact</span></p></td>
<td id="TBL-14-1-2" class="td10" style="text-align: left; white-space: normal;"><p><span class="ptmb8t-">Required content</span></p></td>
</tr>
<tr id="TBL-14-2-" style="vertical-align:baseline;">
<td id="TBL-14-2-1" class="td01" style="text-align: left; white-space: normal;"><p>Replay manifest</p></td>
<td id="TBL-14-2-2" class="td10" style="text-align: left; white-space: normal;"><p>request seeds, map fixture version, policy flags</p></td>
</tr>
<tr id="TBL-14-3-" style="vertical-align:baseline;">
<td id="TBL-14-3-1" class="td01" style="text-align: left; white-space: normal;"><p>Benchmark script</p></td>
<td id="TBL-14-3-2" class="td10" style="text-align: left; white-space: normal;"><p>one command that regenerates all tables</p></td>
</tr>
<tr id="TBL-14-4-" style="vertical-align:baseline;">
<td id="TBL-14-4-1" class="td01" style="text-align: left; white-space: normal;"><p>Load report</p></td>
<td id="TBL-14-4-2" class="td10" style="text-align: left; white-space: normal;"><p>concurrency levels, p50, p95, p99, rejection count</p></td>
</tr>
<tr id="TBL-14-5-" style="vertical-align:baseline;">
<td id="TBL-14-5-1" class="td01" style="text-align: left; white-space: normal;"><p>Fallback report</p></td>
<td id="TBL-14-5-2" class="td10" style="text-align: left; white-space: normal;"><p>missing model, overload, no-feasible-pin behavior</p></td>
</tr>
<tr id="TBL-14-6-" style="vertical-align:baseline;">
<td id="TBL-14-6-1" class="td01" style="text-align: left; white-space: normal;"><p>Trace sample</p></td>
<td id="TBL-14-6-2" class="td10" style="text-align: left; white-space: normal;"><p>candidate set, filtered set, selected pin, reason codes</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 13: </span><span class="content">Minimum evidence package before making production-style claims. </span></figcaption>
</figure>

</div>

<span id="limitations" class="paragraphHead"> <span id="x1-111000"></span><span class="ptmb8t-">Limitations:</span></span> The HD map in the repository is a fixture, not a production map. The scoring features use deterministic lightweight fallbacks for historical success and local supply. The congestion tracker is a single-process, lock-protected dictionary; a real fleet would shard it or move it to Redis or a purpose-built state service. The ETA value is a baseline. These limitations are acceptable for a reference implementation but must be replaced before operational deployment claims.

## <span class="titlemark">6 </span> <span id="x1-1120006"></span>Conclusion and Outlook

Pin Infrastructure Service demonstrates a clean, defensible serving pattern for autonomous ride-hail PUDO selection: generate plausible candidates, enforce hard constraints first, rank feasible options, control congestion, and observe every stage. The arXiv-ready paper gives the project a paper structure without overstating the current evidence.

## <span id="x1-113000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xalonso2017ridesharing"></span>Javier Alonso-Mora et al. On-demand high-capacity ride-sharing via dynamic trip-vehicle assignment. <span class="ptmri8t-">PNAS</span>, 2017.

\[2\]  
<span id="Xbeckmann1990rstar"></span>Norbert Beckmann, Hans-Peter Kriegel, Ralf Schneider, and Bernhard Seeger. The r\*-tree: An efficient and robust access method for points and rectangles. In <span class="ptmri8t-">SIGMOD</span>, 1990.

\[3\]  
<span id="Xbishop2006pattern"></span>Christopher M. Bishop. <span class="ptmri8t-">Pattern Recognition and Machine Learning</span>. Springer, 2006.

\[4\]  
<span id="Xboeing2017osmnx"></span>Geoff Boeing. Osmnx: New methods for acquiring, constructing, analyzing, and visualizing complex street networks. <span class="ptmri8t-">Computers, Environment and Urban Systems</span>, 2017.

\[5\]  
<span id="Xboyd2004convex"></span>Stephen Boyd and Lieven Vandenberghe. <span class="ptmri8t-">Convex Optimization</span>. Cambridge University Press, 2004.

\[6\]  
<span id="Xbrakatsoulas2005mapmatching"></span>Sotiris Brakatsoulas, Dieter Pfoser, Randall Salas, and Carola Wenk. On map-matching vehicle tracking data. In <span class="ptmri8t-">VLDB</span>, 2005.

\[7\]  
<span id="Xbubeck2015convex"></span>Sébastien Bubeck. Convex optimization: Algorithms and complexity. <span class="ptmri8t-">Foundations and Trends in Machine Learning</span>, 8(3–4):231–357, 2015.

\[8\]  
<span id="Xburges2010ranknet"></span>Christopher J. C. Burges. From ranknet to lambdarank to lambdamart: An overview. <span class="ptmri8t-">Microsoft Research Technical Report</span>, 2010.

\[9\]  
<span id="Xcastillo2017surge"></span>Juan Camilo Castillo, Dan Knoepfle, and Glen Weyl. Surge pricing solves the wild goose chase. In <span class="ptmri8t-">ACM EC</span>, 2017.

\[10\]  
<span id="Xchen2016xgboost"></span>Tianqi Chen and Carlos Guestrin. Xgboost: A scalable tree boosting system. In <span class="ptmri8t-">KDD</span>, 2016.

\[11\]  
<span id="Xcover2006elements"></span>Thomas M. Cover and Joy A. Thomas. <span class="ptmri8t-">Elements of Information Theory</span>. Wiley, second edition, 2006.

\[12\]  
<span id="Xdantzig1959truck"></span>George B. Dantzig and John H. Ramser. The truck dispatching problem. <span class="ptmri8t-">Management Science</span>, 1959.

\[13\]  
<span id="Xdean2013tail"></span>Jeffrey Dean and Luiz Andre Barroso. The tail at scale. <span class="ptmri8t-">Communications of the ACM</span>, 2013.

\[14\]  
<span id="Xdijkstra1959"></span>Edsger W. Dijkstra. A note on two problems in connexion with graphs. <span class="ptmri8t-">Numerische Mathematik</span>, 1959.

\[15\]  
<span id="Xfriedman2001greedy"></span>Jerome H. Friedman. Greedy function approximation: A gradient boosting machine. <span class="ptmri8t-">The Annals of Statistics</span>, 29(5):1189–1232, 2001.

\[16\]  
<span id="Xgoodfellow2016deep"></span>Ian Goodfellow, Yoshua Bengio, and Aaron Courville. <span class="ptmri8t-">Deep Learning</span>. MIT Press, 2016.

\[17\]  
<span id="Xgrpc"></span>gRPC Authors. grpc: A high performance, open source universal rpc framework. <a href="https://grpc.io/" class="url"><span class="pcrr8t-">https://grpc.io/</span></a>, 2026.

\[18\]  
<span id="Xguttman1984rtree"></span>Antonin Guttman. R-trees: A dynamic index structure for spatial searching. In <span class="ptmri8t-">ACM SIGMOD International Conference on Management of Data</span>, 1984.

\[19\]  
<span id="Xhaklay2008osm"></span>Mordechai Haklay and Patrick Weber. Openstreetmap: User-generated street maps. <span class="ptmri8t-">IEEE Pervasive Computing</span>, 7(4):12–18, 2008.

\[20\]  
<span id="Xhart1968astar"></span>Peter E. Hart, Nils J. Nilsson, and Bertram Raphael. A formal basis for the heuristic determination of minimum cost paths. <span class="ptmri8t-">IEEE Transactions on Systems Science and Cybernetics</span>, 1968.

\[21\]  
<span id="Xhastie2009elements"></span>Trevor Hastie, Robert Tibshirani, and Jerome Friedman. <span class="ptmri8t-">The Elements of Statistical Learning</span>. Springer, second edition, 2009.

\[22\]  
<span id="Xkingma2015adam"></span>Diederik P. Kingma and Jimmy Ba. Adam: A method for stochastic optimization. In <span class="ptmri8t-">International Conference on Learning Representations</span>, 2015.

\[23\]  
<span id="Xkrumm2004travel"></span>John Krumm, Julie Letchner, and Eric Horvitz. Map matching with travel time constraints. In <span class="ptmri8t-">SAE World Congress</span>, 2007.

\[24\]  
<span id="Xlaporte2009fifty"></span>Gilbert Laporte. Fifty years of vehicle routing. <span class="ptmri8t-">Transportation Science</span>, 2009.

\[25\]  
<span id="Xlecun1998gradient"></span>Yann LeCun, Léon Bottou, Yoshua Bengio, and Patrick Haffner. Gradient-based learning applied to document recognition. <span class="ptmri8t-">Proceedings of the IEEE</span>, 86(11):2278–2324, 1998.

\[26\]  
<span id="Xluxen2011osrm"></span>Dennis Luxen and Christian Vetter. Real-time routing with openstreetmap data. In <span class="ptmri8t-">GIS</span>, 2011.

\[27\]  
<span id="Xzhang2016tshare"></span>Shuo Ma, Yu Zheng, and Ouri Wolfson. T-share: A large-scale dynamic taxi ridesharing service. In <span class="ptmri8t-">ICDE</span>, 2013.

\[28\]  
<span id="Xmurphy2012machine"></span>Kevin P. Murphy. <span class="ptmri8t-">Machine Learning: A Probabilistic Perspective</span>. MIT Press, 2012.

\[29\]  
<span id="Xnewson2009hidden"></span>Paul Newson and John Krumm. Hidden markov map matching through noise and sparseness. In <span class="ptmri8t-">ACM SIGSPATIAL International Conference on Advances in Geographic Information Systems</span>, 2009.

\[30\]  
<span id="Xnocedal2006numerical"></span>Jorge Nocedal and Stephen J. Wright. <span class="ptmri8t-">Numerical Optimization</span>. Springer, second edition, 2006.

\[31\]  
<span id="Xopentelemetry"></span>OpenTelemetry Authors. Opentelemetry documentation. <a href="https://opentelemetry.io/" class="url"><span class="pcrr8t-">https://opentelemetry.io/</span></a>, 2026.

\[32\]  
<span id="Xpavone2012robotic"></span>Marco Pavone et al. Robotic load balancing for mobility-on-demand systems. <span class="ptmri8t-">International Journal of Robotics Research</span>, 2012.

\[33\]  
<span id="Xpearl2009causality"></span>Judea Pearl. <span class="ptmri8t-">Causality: Models, Reasoning, and Inference</span>. Cambridge University Press, second edition, 2009.

\[34\]  
<span id="Xpostgis"></span>PostGIS Project. Postgis: Spatial and geographic objects for postgresql, 2026. URL <a href="https://postgis.net/" class="url"><span class="pcrr8t-">https://postgis.net/</span></a>.

\[35\]  
<span id="Xprometheus"></span>Prometheus Authors. Prometheus monitoring system. <a href="https://prometheus.io/" class="url"><span class="pcrr8t-">https://prometheus.io/</span></a>, 2026.

\[36\]  
<span id="Xrobbins1951stochastic"></span>Herbert Robbins and Sutton Monro. A stochastic approximation method. <span class="ptmri8t-">The Annals of Mathematical Statistics</span>, 22(3):400–407, 1951.

\[37\]  
<span id="Xrumelhart1986learning"></span>David E. Rumelhart, Geoffrey E. Hinton, and Ronald J. Williams. Learning representations by back-propagating errors. <span class="ptmri8t-">Nature</span>, 323:533–536, 1986.

\[38\]  
<span id="Xsanti2014quantifying"></span>Paolo Santi et al. Quantifying the benefits of vehicle pooling with shareability networks. <span class="ptmri8t-">PNAS</span>, 2014.

\[39\]  
<span id="Xsavelsbergh1995vehicle"></span>Martin W. P. Savelsbergh and Marc Sol. The general pickup and delivery problem. <span class="ptmri8t-">Transportation Science</span>, 1995.

\[40\]  
<span id="Xshannon1948communication"></span>Claude E. Shannon. A mathematical theory of communication. <span class="ptmri8t-">Bell System Technical Journal</span>, 27(3):379–423, 1948.

\[41\]  
<span id="Xsigelman2010dapper"></span>Benjamin H. Sigelman et al. Dapper, a large-scale distributed systems tracing infrastructure, 2010.

\[42\]  
<span id="Xspieser2014toward"></span>Kevin Spieser et al. Toward a systematic approach to the design and evaluation of automated mobility-on-demand systems. <span class="ptmri8t-">Road Vehicle Automation</span>, 2014.

\[43\]  
<span id="Xturing1950computing"></span>A. M. Turing. Computing machinery and intelligence. <span class="ptmri8t-">Mind</span>, 59(236):433–460, 1950.

\[44\]  
<span id="Xh3"></span>Uber Technologies. H3: Hexagonal hierarchical geospatial indexing system. <a href="https://h3geo.org/" class="url"><span class="pcrr8t-">https://h3geo.org/</span></a>, 2026.

\[45\]  
<span id="Xvapnik1998statistical"></span>Vladimir N. Vapnik. <span class="ptmri8t-">Statistical Learning Theory</span>. Wiley, 1998.

\[46\]  
<span id="Xvickrey1969congestion"></span>William S. Vickrey. Congestion theory and transport investment. <span class="ptmri8t-">American Economic Review</span>, 1969.

</div>
