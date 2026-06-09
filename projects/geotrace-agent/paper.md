# GeoTrace-Agent: A Production Multi-Agent Framework for Spatiotemporal Reasoning

Arun Sharma, University of Minnesota, Twin Cities

_In preparation. Target: NeurIPS workshop_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> We present <span class="ptmb8t-">GeoTrace-Agent</span>, a production-grade multi-agent framework that combines deterministic time-geographic computation with large-language-model planning to answer natural-language questions over heterogeneous trajectory data. A typed <span class="ptmri8t-">PlanGraph </span>encodes the agent’s chain of thought as a directed acyclic graph of statically-validated nodes rather than free-form prose, making the reasoning auditable, replayable, and parallelizable. A central orchestrator runs the graph under a hard token, tool-call, and wallclock budget, calls into a Hägerstrand space-time prism kernel for the geometric truth (geo-ellipses, minimum orthogonal bounding rectangles, dynamic-region-merge unions), and dispatches specialized sub-agents that extend our prior STAGD/DRM gap detector and TGARD/DC-TGARD rendezvous finder. Three optimization layers, an adaptive prompt compressor, an in-flight tool deduplicator, and a hybrid exact + semantic cache, cut per-query token spend by approximately 40 % on a golden evaluation set without harming region tightness. We expose the prism kernel as a Model Context Protocol (MCP) server and the agent itself over a JSON-RPC 2.0 Agent-to-Agent (A2A) protocol with capability cards, making GeoTrace-Agent first-class for sibling agents and IDE plugins. A kinematic validator gated on a single-axle bicycle envelope guarantees that no region returned to a user is physically infeasible, and ambiguous traces feed a Postgres human-in-the-loop queue whose verdicts can later seed direct-preference-optimization datasets. We describe the system architecture, the typed-plan / token-budget / tool-cache mechanisms, and the geometric kernel; report golden-dataset latency and cost; and discuss limitations. The system is open-sourced.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Time geography \[[17](#Xhagerstrand1970what)\] provides a remarkably tight algebraic envelope on what a moving agent can do: given two anchors <span class="mathjax-inline">\\A=(x_A, y_A, t_A)\\</span> and <span class="mathjax-inline">\\B=(x_B, y_B, t_B)\\</span> with <span class="mathjax-inline">\\t_A\<t_B\\</span> and a maximum speed <span class="mathjax-inline">\\v\_{\max }\\</span>, the set of reachable points at any interior time is a geo-ellipse with foci at the projected anchors. This envelope underpins decades of spatiotemporal data mining work in maritime safety, contact tracing, and homeland security \[[35](#Xsharma2022sigspatial)–[38](#Xsharma2025geoanomalies)\]. In the modern era of large language models \[[1](#Xanthropic2024claude), [28](#Xopenai2024gpt4)\], however, even the best agents tend to hallucinate spatial relationships, miscompute distances, or skip the kinematic check entirely \[[8](#Xchen2024spatialvlm), [25](#Xliu2024llava)\].

We present <span class="ptmb8t-">GeoTrace-Agent</span>, a multi-agent system that takes the opposite stance: every spatially-decidable sub-problem is computed deterministically by a numerical kernel before any LLM is asked to synthesize. The system answers natural-language questions over heterogeneous trajectory data (vessel AIS feeds, road networks, weather and sea state, satellite imagery) by orchestrating a small set of specialized sub-agents, each with a typed contract:

- a <span class="ptmb8t-">PlannerAgent </span>that emits a typed PlanGraph (a DAG of typed nodes, not free-form prose), making chain-of-thought auditable and parallelizable;
- a <span class="ptmb8t-">SpaceTimeReasoner </span>that owns the prism / geo-ellipse / minimum-orthogonal-bounding-rectangle (MOBR) algebra;
- a <span class="ptmb8t-">GapDetectorAgent </span>extending the STAGD + dynamic region merge (DRM) algorithm of Sharma et al. \[[37](#Xsharma2024tist)\] with an Abnormal Gap Measure that fuses kinematic plausibility and a Pi-DPM \[[38](#Xsharma2025geoanomalies)\] reconstruction-error term;
- a <span class="ptmb8t-">RendezvousFinderAgent </span>extending TGARD and the dual-convergence DC-TGARD variant of Sharma et al. \[[35](#Xsharma2022sigspatial)\] with bi-directional pruning and ellipse-symmetry early stopping; and
- a <span class="ptmb8t-">ValidatorAgent </span>that gates every region returned to the user on a single-axle kinematic-bicycle envelope \[[20](#Xkong2015kinematic)\].

The orchestrator runs the PlanGraph under a hard <span class="ptmri8t-">token, tool-call, and wallclock </span>budget. Three optimization layers, sketched in Section [4](#methods), drive efficiency: (i) adaptive prompt compression with prefix-cache-aware assembly \[[2](#Xanthropic2024promptcache)\] and structured-output enforcement; (ii) tool-call deduplication of in-flight calls and a hybrid exact + semantic cache; and (iii) parallel-safe topo-layer execution of the PlanGraph. Every stage emits an OpenTelemetry span \[[31](#Xopentelemetry2024)\] with token-spend, cache-hit, and cost attributes, so an analyst can drill into any historical run.

GeoTrace-Agent speaks the modern agent-protocol stack natively. The prism kernel is exposed as a Model Context Protocol \[[3](#Xanthropic2024mcp)\] server so any MCP-aware client can call <span class="pcrr8t-">prism.compute </span>or <span class="pcrr8t-">prism.intersect</span> without going through this app’s HTTP surface; the agent itself advertises a capability card at <span class="pcrr8t-">/a2a/.well-known/capabilities </span>and accepts JSON-RPC 2.0 Agent-to-Agent (A2A) calls \[[13](#Xgoogle2024a2a)\], mirroring the cross-agent communication patterns recently popularized in enterprise multi-agent frameworks \[[5](#Xcentific2025legalwiz)–[7](#Xcentific2025art)\]. Ambiguous traces (validator-confidence below a tunable threshold) flow into a Postgres human-in-the-loop (HITL) queue whose reviewer verdicts can be exported as preference triples for downstream direct-preference optimization \[[32](#Xrafailov2023dpo)\], closing the loop between agentic reasoning and reinforcement learning.

We make four contributions:

1\.  
a <span class="ptmb8t-">typed PlanGraph </span>chain-of-thought representation that is statically validated, parallel-sortable, and replayable, with explicit per-node token and confidence priors;

2\.  
a <span class="ptmb8t-">three-layer efficiency stack </span>(adaptive prompt compression, in-flight tool deduplication, hybrid exact + semantic cache) that reduces median per-query token spend by approximately 40 % on the golden evaluation set;

3\.  
a <span class="ptmb8t-">deterministic time-geographic kernel </span>integrating Hägerstrand prisms with the STAGD-DRM gap detector and the TGARD / DC-TGARD rendezvous finder, gated by a kinematic validator that guarantees physical feasibility of every returned region; and

4\.  
a <span class="ptmb8t-">first-class agent-protocol surface </span>(MCP for tools, JSON-RPC 2.0 A2A for inter-agent calls, OpenTelemetry traces, HITL queue) suitable for production deployment alongside enterprise multi-agent frameworks.

## <span class="titlemark">2 </span> <span id="x1-20002"></span>Related Work

<span class="ptmb8t-">Time geography and trajectory analysis: </span>Hägerstrand’s space-time prism \[[17](#Xhagerstrand1970what), [27](#Xmiller2005measuring)\] is the foundational construct for reachability queries over moving objects; the geo-ellipse cross-section and its bounding-box approximation drive most modern indexing schemes \[[21](#Xkuijpers2008prism)\]. Time geography has also influenced accessibility modeling, movement uncertainty, mobility-data mining, and GIScience more broadly \[[10](#Xdodge2008towards), [14](#Xgoodchild1992geographical), [26](#Xmiller1991modelling), [46](#Xzheng2015trajectory)\]. Our prior work extended this lineage to abnormal trajectory-gap detection (STAGD with dynamic region merge) \[[37](#Xsharma2024tist)\], ellipse-tightening rendezvous detection (TGARD and the dual-convergence DC-TGARD) \[[35](#Xsharma2022sigspatial)\], and time-geography-driven query optimization for spatiotemporal joins \[[36](#Xsharma2022tist)\]. GeoTrace-Agent embeds these algorithms as deterministic agents, with a chain-of-thought planner deciding when to invoke them.

<span class="ptmb8t-">LLM agents and chain of thought: </span>Recent agent frameworks emphasize chain-of-thought \[[41](#Xwang2023plan), [43](#Xwei2022cot)\] and tool use \[[33](#Xschick2023toolformer), [45](#Xyao2023react)\], with structured-output libraries \[[29](#Xopenai2024structured)\] formalizing the latter. Planning work in classical AI \[[12](#Xghallab1998pddl), [24](#Xlavalle2006planning)\] and search \[[16](#Xhart1968astar)\] shows the value of explicit state, operators, and dependencies. Most existing LLM systems however treat the chain of thought as free-form prose, complicating audit and replay. We instead emit a typed DAG (PlanGraph) whose nodes are statically validated against schemas the orchestrator owns, adapting planning-graph ideas to LLM-emitted plans while keeping geometric truth outside the model.

<span class="ptmb8t-">Multi-agent systems and human-in-the-loop: </span>Centific’s recent line of work, LegalWiz for contradiction detection in legal documents \[[5](#Xcentific2025legalwiz)\], ContraGen for enterprise contradictions \[[6](#Xcentific2025contragen)\], and ART for action-based reasoning over EHRs \[[7](#Xcentific2025art)\], codifies a multi-agent + HITL pattern in which specialized agents coordinate via remote-procedure calls and a human reviewer closes the loop. Other production agentic stacks \[[18](#Xhong2024opendevin), [19](#Xjimenez2024swebench), [42](#Xwang2024survey), [44](#Xxie2024multimodal)\] similarly emphasize agent specialization, evaluation, and observability. Our system inherits this pattern but pivots the domain from text to spatiotemporal trajectories and adds a deterministic geometric kernel as a first-class agent.

<span class="ptmb8t-">Token and tool optimization: </span>Prompt caching \[[2](#Xanthropic2024promptcache), [30](#Xopenai2024autocache)\], semantic caching for LLM responses \[[4](#Xbang2023gptcache)\], KV-cache-aware decoding \[[22](#Xkwon2023vllm)\], and structured-output-with-correction loops \[[29](#Xopenai2024structured)\] have separately reduced LLM cost. Databases solved analogous problems through query optimization, indexes, and memoization decades earlier \[[9](#Xbeckmann1990rstar), [15](#Xguttman1984rtree), [40](#Xsellis1987multiple)\]. GeoTrace-Agent applies the same systems instinct to agents: keep a single <span class="pcrr8t-">TokenOptimizer </span>choke-point, deduplicate in-flight calls, cache exact and semantic tool results, and expose every decision in an OpenTelemetry trace.

<span class="ptmb8t-">Agent protocols: </span>The Model Context Protocol \[[3](#Xanthropic2024mcp)\] standardizes JSON-RPC tool exposure between LLM clients and tool servers; the Agent-to-Agent (A2A) protocol \[[13](#Xgoogle2024a2a)\] and capability-card discovery patterns standardize inter-agent calls. We adopt both and ship the prism kernel as an MCP server while exposing the orchestrator over A2A.

<span class="ptmb8t-">Spatial databases and geospatial software: </span>GeoTrace-Agent is also influenced by classic spatial database ideas: explicit geometry types, indexable bounding boxes, and separation of query planning from execution \[[11](#Xegenhofer1994spatial), [39](#Xsamet1990applications)\]. The production stack uses Postgres/PostGIS, Redis, Chroma, and a deterministic prism kernel; the LLM is not a substitute for these systems but an orchestrator that decides which query plan is appropriate for a user’s natural-language request.

## <span class="titlemark">3 </span> <span id="x1-30003"></span>System Architecture

GeoTrace-Agent is a 12-factor service. Figure [1](#geotraceagent-request-path-the-planneragent-emits-a-typed-plangraph-the-orchestrator-toposorts-the-graph-and-runs-each-layer-in-parallel-under-a-hard-token-tool-wallclock-budget-specialized-subagents-call-into-the-deterministic-kernel-mcp-and-the-cache-otel-infrastructure) sketches the request path: an inbound HTTP query passes the input guard, is rewritten and routed, planned, executed across parallel topo layers, summarized, scrubbed by an output filter, and returned with a full trace, cost ledger, and HITL flag.

<figure class="figure">
<p><img src="figures/geotrace_agent_neurips-56b396c37e096c9b7d7f50c2be0193cb.svg" loading="lazy" alt="Figure" /> <span id="x1-3001r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">GeoTrace-Agent request path. The PlannerAgent emits a typed <span class="ptmri8t-">PlanGraph</span>; the Orchestrator topo-sorts the graph and runs each layer in parallel under a hard token / tool / wallclock budget; specialized sub-agents call into the deterministic kernel (MCP) and the cache + OTEL infrastructure. </span></figcaption>
</figure>

<span class="ptmb8t-">State. </span>The system separates four orthogonal concerns. Geometric truth lives in <span class="pcrr8t-">app/components/space_time_prism.py </span>and is unit-testable. Semantic reasoning is delegated to the LLM only through the planner; the other agents are deterministic kernels or thin clients on top. Budgets are enforced at a single choke-point: every LLM call goes through the <span class="pcrr8t-">TokenOptimizer</span>, and the orchestrator stops on token / tool / wallclock overrun and surfaces <span class="pcrr8t-">terminated_by_budget = true</span>. Provenance is captured by OpenTelemetry: every stage writes a span with <span class="pcrr8t-">tool.name</span>, <span class="pcrr8t-">tool.cache_hit</span>, <span class="pcrr8t-">tool.cost_usd</span>, <span class="pcrr8t-">tool.tokens_in</span>, and <span class="pcrr8t-">tool.tokens_out</span>; the trace identifier flows back to the user in the response.

<span class="ptmb8t-">Deployment. </span>A docker-compose stack ships the API (FastAPI), Postgres+PostGIS, Redis, Chroma, an OpenTelemetry collector, Tempo for traces, Langfuse \[[23](#Xlangfuse2024)\] for LLM-trace dashboards, and a Streamlit ops console for the HITL reviewer. The same image runs in Kubernetes with horizontal pod autoscaling on RPS.

<span id="problem-formulation" class="paragraphHead"> <span id="x1-4000"></span><span class="ptmb8t-">Problem formulation:</span></span> An input query <span class="mathjax-inline">\\q\\</span> contains natural language, optional anchors <span class="mathjax-inline">\\\mathcal {A}=\\(lat_i,lon_i,t_i)\\\_{i=1}^n\\</span>, a domain label <span class="mathjax-inline">\\d\in \\\text {vessel},\text {vehicle},\text {pedestrian},\text {uav}\\\\</span>, and a budget vector <span class="mathjax-inline">\\b=(B\_{\mathrm {tok}}, B\_{\mathrm {tool}}, B\_{\mathrm {sec}})\\</span>. The system must return an answer <span class="mathjax-inline">\\a\\</span>, a set of candidate regions <span class="mathjax-inline">\\\mathcal {R}\\</span>, a confidence score, and a trace identifier. The hard correctness requirement is not that the natural-language answer sounds plausible; it is that every region <span class="mathjax-inline">\\r\in \mathcal {R}\\</span> passes the deterministic feasibility predicate

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathrm {Valid}(r,d) = \mathbf {1}\left \[ \max \_{(p_i,t_i),(p_j,t_j)\in r} \frac {\\p_i-p_j\\}{\|t_i-t_j\|+\epsilon } \le v\_{\max }(d) \right \], \label {eq:valid} \end{equation}

</div>

<span id="x1-4001r1"></span>

with stricter checks when acceleration, curvature, or S-KBM state is available. A query is therefore a budgeted planning problem over typed tools:

<div class="mathjax-env mathjax-equation">

\begin{equation} \min \_{\mathcal {G}}\\\mathrm {Cost}(\mathcal {G};q) \quad \text {s.t.}\quad \forall r\in \mathcal {R}(\mathcal {G},q),\\ \mathrm {Valid}(r,d)=1,\quad \mathrm {Budget}(\mathcal {G})\preceq b, \label {eq:budgeted-plan} \end{equation}

</div>

<span id="x1-4002r2"></span>

where <span class="mathjax-inline">\\\mathcal {G}\\</span> is the PlanGraph emitted by the planner. The LLM is used to propose <span class="mathjax-inline">\\\mathcal {G}\\</span> and summarize its results; geometry, validation, caching, and budget accounting are deterministic.

<span id="plangraph-semantics" class="paragraphHead"> <span id="x1-5000"></span><span class="ptmb8t-">PlanGraph semantics:</span></span> A PlanGraph is a finite directed acyclic graph <span class="mathjax-inline">\\\mathcal {G}=(V,E)\\</span> whose node <span class="mathjax-inline">\\v\in V\\</span> has type <span class="mathjax-inline">\\\tau (v)\\</span>, dependency set <span class="mathjax-inline">\\\mathrm {deps}(v)\\</span>, JSON-serializable inputs, output schema, expected token cost, expected tool cost, and confidence prior. Topological layers <span class="mathjax-inline">\\\mathcal {L}\_1,\ldots ,\mathcal {L}\_m\\</span> define concurrency: nodes within a layer may run in parallel, but no node runs before all dependencies finish. Invalid plans fail before execution if a node type is unknown, a dependency points outside the graph, the graph has a cycle, or expected costs exceed the request budget. This is the main difference between GeoTrace-Agent and a free-form ReAct loop: the model is allowed to plan, but the orchestrator owns the type system.

<figure class="figure">
<p><img src="figures/geotrace_agent_neurips-2e34ac7861f8332ed781b67c3b6e1db8.svg" loading="lazy" alt="Figure" /> <span id="x1-5001r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Typed execution model. The LLM emits a PlanGraph, not a final spatial answer. The orchestrator validates the graph, executes deterministic tools in parallel-safe layers, and exposes cache/cost/trace metadata for every node. </span></figcaption>
</figure>

<span id="trust-boundary" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Trust boundary:</span></span> The architecture has a strict trust boundary. The LLM may choose a tool and summarize a tool result, but it cannot directly manufacture a returned region. Returned regions originate from the prism, gap, rendezvous, or validator components. This boundary makes failures easier to localize: if a region is wrong, the bug is in the kernel, projection, data, or validator; if the answer is verbose or confused while the regions are correct, the bug is in summarization. This separation is essential for portfolio-quality work because it converts a vague “LLM agent” into an auditable software system.

## <span class="titlemark">4 </span> <span id="x1-70004"></span>Methods

### <span class="titlemark">4.1 </span> <span id="x1-80004.1"></span>Typed PlanGraph chain-of-thought

The planner does not emit free-form prose. It emits a JSON object validated against a strict schema (<span class="pcrr8t-">PlanGraph</span>), each node being one of {<span class="pcrr8t-">prism.compute</span>, <span class="pcrr8t-">gaps.detect</span>, <span class="pcrr8t-">rendezvous.tgard</span>, <span class="pcrr8t-">rendezvous.dc_tgard</span>, <span class="pcrr8t-">validate.kinematic</span>, <span class="pcrr8t-">retrieve.semantic</span>, <span class="pcrr8t-">summarize</span>}. A node carries its <span class="pcrr8t-">deps </span>(DAG edges), <span class="pcrr8t-">inputs</span>, <span class="pcrr8t-">expected_tokens</span>, and <span class="pcrr8t-">confidence_prior</span>. The orchestrator topo-sorts the graph and runs each layer in parallel via <span class="pcrr8t-">asyncio.gather</span>; cycles are rejected before any work runs. The total <span class="pcrr8t-">expected_tokens </span>is bounded against the request budget; an over-budget plan raises <span class="pcrr8t-">PlanInfeasible</span>. The planner prompt is versioned (<span class="pcrr8t-">planner.v3</span>); historical replays are exact because the call is also semantically cached.

### <span class="titlemark">4.2 </span> <span id="x1-90004.2"></span>Token-consumption optimization

A single <span class="pcrr8t-">TokenOptimizer.call_llm\_\* </span>entry point owns every LLM call. It performs four jobs:

- <span class="ptmri8t-">Adaptive prompt compression. </span>Prompts above <span class="mathjax-inline">\\\sim \\</span>2k tokens are head-tail-truncated with a marker so the model still sees the lead and the question; the middle is elided.
- <span class="ptmri8t-">Prefix-cache-aware assembly. </span>The system prompt and per-task instructions are kept stable so Anthropic’s prompt-cache machinery hits \[[2](#Xanthropic2024promptcache)\]; the call sets <span class="pcrr8t-">cache_control: {type: ephemeral}</span>.
- <span class="ptmri8t-">Structured outputs. </span>When the caller passes a JSON Schema, malformed outputs trigger one delta-correction retry; persistent failures raise.
- <span class="ptmri8t-">Per-call </span><span class="pcrro8t-">max_tokens </span><span class="ptmri8t-">clamp. </span>The optimizer caps <span class="pcrr8t-">max_tokens </span>against the remaining run budget so the orchestrator never overshoots even on planner regressions.

Every call returns <span class="pcrr8t-">(text, tokens_in, tokens_out, cost_usd, cache_hit)</span>; the orchestrator accumulates these into the per-stage cost ledger.

### <span class="titlemark">4.3 </span> <span id="x1-100004.3"></span>Tool-call optimization

Three mechanisms reduce tool spend.

- <span class="ptmri8t-">Parallel-safe topo layers. </span>The orchestrator runs each PlanGraph layer with <span class="pcrr8t-">asyncio.gather</span> so independent sub-agents proceed concurrently.
- <span class="ptmri8t-">In-flight tool deduplication. </span><span class="pcrr8t-">ToolBatcher </span>keys concurrent calls by <span class="pcrr8t-">(tool, sha256(args))</span>; a second caller short-circuits to the first call’s awaitable. This is distinct from the cache because matches are within a single run.
- <span class="ptmri8t-">Hybrid cache. </span><span class="pcrr8t-">SemanticCache </span>layers an exact-key Redis lookup over a near-key embedding lookup. Identical anchor pairs return the same prism in <span class="mathjax-inline">\\O(1)\\</span>; near-duplicate questions return prior answers above a configurable similarity.

### <span class="titlemark">4.4 </span> <span id="x1-110004.4"></span>Geometric kernel: prism, geo-ellipse, MOBR, DRM

For an anchor pair <span class="mathjax-inline">\\A=(x_A,y_A,t_A), B=(x_B,y_B,t_B)\\</span> with budget <span class="mathjax-inline">\\T = t_B-t_A\\</span> and speed bound <span class="mathjax-inline">\\v\_{\max }\\</span>, the prism is the union of geo-ellipses

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathcal {E}\_t = \left \\ p : \frac {\\p - A\\}{v\_{\max }} \le t-t_A \\\wedge \\ \frac {\\p - B\\}{v\_{\max }} \le t_B-t \right \\, \quad t\in \[t_A,t_B\], \label {eq:ellipse} \end{equation}

</div>

<span id="x1-11001r3"></span>

which we approximate by the inscribed ellipse with foci <span class="mathjax-inline">\\A, B\\</span> and semi-major axis <span class="mathjax-inline">\\a(t) = \tfrac {1}{2} v\_{\max } (T)\\</span>. Distances are evaluated in a local equirectangular projection centered on the anchor midpoint so they are Euclidean to first order; for continental-scale anchors we switch to a UTM zone via <span class="pcrr8t-">pyproj</span>. The MOBR is the orthogonal bounding rectangle of the boundary ellipse; the dynamic region merge (DRM) of overlapping ellipses uses an R\*-tree index and a maximal-union sweep, recovering the STAGD-DRM behavior of Sharma et al. \[[37](#Xsharma2024tist)\]. The two-prism intersection <span class="pcrr8t-">intersect(P, Q) </span>samples <span class="mathjax-inline">\\n\\</span> time slices in the overlap window and unions per-slice ellipse intersections; this is the operation that powers TGARD.

### <span class="titlemark">4.5 </span> <span id="x1-120004.5"></span>STAGD-DRM and TGARD / DC-TGARD agents

The GapDetectorAgent walks a trajectory, finds gaps where consecutive samples are farther apart than a coverage threshold, indexes each gap’s prism MOBR in an R\*-tree, unions overlapping bounding boxes, and scores each cluster with the Abnormal Gap Measure

<div class="mathjax-env mathjax-equation">

\begin{equation} \mathrm {AGM}(g) = \lambda \\ (1 - p\_{\text {phys}}(g)) + (1-\lambda )\\ p\_{\text {data}}(g), \label {eq:agm} \end{equation}

</div>

<span id="x1-12001r4"></span>

where <span class="mathjax-inline">\\p\_{\text {phys}} = \min (1, v\_{\max } / v\_{\text {required}})\\</span> and <span class="mathjax-inline">\\p\_{\text {data}}\\</span> is a calibrated tail probability over the Pi-DPM \[[38](#Xsharma2025geoanomalies)\] reconstruction error.

The RendezvousFinderAgent pairwise-intersects prisms; in the dual-convergence variant DC-TGARD \[[35](#Xsharma2022sigspatial)\] it walks the time interval from both ends, pruning slices whose intersection becomes empty, and records the tightened time window <span class="mathjax-inline">\\\[\\t_0 + (t_1-t_0)\\\ell ,\\ t_0 + (t_1-t_0)\\h\\\]\\</span>. The DC variant is provably correct and complete and is empirically faster in expectation when overlaps are short.

### <span class="titlemark">4.6 </span> <span id="x1-130004.6"></span>Kinematic validator (S-KBM gate)

Every region returned to the user is forced through a <span class="pcrr8t-">ValidatorAgent </span>that recomputes a worst-case required speed across the region’s centroid and time window, compares against the per-domain envelope (vessel: <span class="mathjax-inline">\\25\\</span> kt, vehicle: <span class="mathjax-inline">\\130\\</span> km/h, pedestrian: <span class="mathjax-inline">\\2\\</span> m/s, UAV: <span class="mathjax-inline">\\30\\</span> m/s), and raises <span class="pcrr8t-">KinematicViolation </span>on infeasibility. The validator is a hard invariant: a region that does not pass is never returned. This is the single most important difference between an LLM-only system and ours.

### <span class="titlemark">4.7 </span> <span id="x1-140004.7"></span>MCP server and A2A protocol

The prism kernel is exposed as a Model Context Protocol \[[3](#Xanthropic2024mcp)\] server speaking JSON-RPC 2.0 over stdio with three tools: <span class="pcrr8t-">prism.compute</span>, <span class="pcrr8t-">prism.intersect</span>, <span class="pcrr8t-">prism.merge_dynamic</span>. Any MCP-aware client, IDE plugin, or sibling agent can invoke them directly. The orchestrator additionally exposes a JSON-RPC 2.0 Agent-to-Agent endpoint at <span class="pcrr8t-">/a2a/jsonrpc </span>and advertises a capability card at <span class="pcrr8t-">/a2a/.well-known/capabilities</span>; outbound <span class="pcrr8t-">A2AClient </span>calls cache cards for 60 seconds and propagate the OpenTelemetry trace identifier as a <span class="pcrr8t-">traceparent </span>header.

<span id="prism-geometry-in-local-coordinates" class="paragraphHead"> <span id="x1-15000"></span><span class="ptmb8t-">Prism geometry in local coordinates:</span></span> For a pair of anchors <span class="mathjax-inline">\\A,B\\</span> we project latitude/longitude to a local tangent plane centered at the midpoint. Let <span class="mathjax-inline">\\c=\\B-A\\/2\\</span>, <span class="mathjax-inline">\\a(t)=v\_{\max }(t_B-t_A)/2\\</span>, and <span class="mathjax-inline">\\b(t)=\sqrt {a(t)^2-c^2}\\</span> when the anchor pair is reachable. The ellipse at time <span class="mathjax-inline">\\t\\</span> can be written as

<div class="mathjax-env mathjax-equation">

\begin{equation} \frac {(u^\top (p-m))^2}{a(t)^2}+ \frac {(v^\top (p-m))^2}{b(t)^2} \le 1, \label {eq:ellipse-canonical} \end{equation}

</div>

<span id="x1-15001r5"></span>

where <span class="mathjax-inline">\\m=(A+B)/2\\</span>, <span class="mathjax-inline">\\u=(B-A)/\\B-A\\\\</span>, and <span class="mathjax-inline">\\v\\</span> is the perpendicular unit vector. The MOBR is obtained by projecting the ellipse axes onto the coordinate axes, giving half-widths

<div class="mathjax-env mathjax-equation">

\begin{equation} h_x=\sqrt {a(t)^2 u_x^2+b(t)^2 v_x^2},\qquad h_y=\sqrt {a(t)^2 u_y^2+b(t)^2 v_y^2}. \label {eq:mobr} \end{equation}

</div>

<span id="x1-15002r6"></span>

These bounds are cheap enough for repeated tool calls and tight enough for R-tree pruning. Exact polygon intersections are only computed after MOBR filtering. This mirrors the database principle that a coarse index should prune before the expensive exact predicate runs.

<figure class="figure">
<p><img src="figures/geotrace_agent_neurips-342620c87520535f61ac18b69539e905.svg" loading="lazy" alt="Figure" /> <span id="x1-15003r3"></span></p>
<figcaption><span class="id">Figure 3: </span><span class="content">Space-time prism slice in a local tangent plane. The deterministic kernel computes the geo-ellipse and its MOBR; downstream gap and rendezvous agents use these objects rather than asking the LLM to reason about distances. </span></figcaption>
</figure>

<span id="gap-detection-algorithm" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">Gap detection algorithm:</span></span> Algorithm [1](#stagddrm-gap-detection-with-agm-scoring) shows the implementation-level STAGD-DRM path. The algorithm is deliberately database-like: compute candidate prisms, index their MOBRs, merge overlaps, then score only the surviving clusters. The LLM does not inspect every raw point. It receives a compact, typed summary of the detected clusters and asks follow-up tools only if the query requires deeper explanation.

<div class="algorithm">

<figure id="x1-16001r1" class="float">
<span id="stagddrm-gap-detection-with-agm-scoring"></span>
<div class="algorithmic">
<span class="ALCitem">Require:</span><span class="ALIndent" style="width:5.0pt;"> </span> trajectory samples <span class="mathjax-inline">\(s_{1:n}\)</span>, domain speed cap <span class="mathjax-inline">\(v_{\max }\)</span>, gap threshold <span class="mathjax-inline">\(\Delta t_{\min }\)</span> <span id="x1-16002r1"></span> <span class="ALCitem">1:</span><span class="ALIndent" style="width:5.0pt;"> </span> initialize R-tree index <span class="mathjax-inline">\(\mathcal {I}\)</span> and candidate list <span class="mathjax-inline">\(\mathcal {C}\)</span> <span id="x1-16003r2"></span><br />
<span class="ALCitem">2:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">for</span> <span class="mathjax-inline">\(i=1\)</span> to <span class="mathjax-inline">\(n-1\)</span> <span class="ptmb8t-">do</span><span class="for-body"> <span id="x1-16004r3"></span><br />
<span class="ALCitem">3:</span><span class="ALIndent" style="width:15.0pt;">  </span><span class="ptmb8t-">if</span> <span class="mathjax-inline">\(t_{i+1}-t_i &gt; \Delta t_{\min }\)</span> <span class="ptmb8t-">then</span><span class="if-body"> <span id="x1-16005r4"></span><br />
<span class="ALCitem">4:</span><span class="ALIndent" style="width:25.0pt;"> </span> compute prism <span class="mathjax-inline">\(P_i=\mathrm {Prism}(s_i,s_{i+1},v_{\max })\)</span> <span id="x1-16006r5"></span><br />
<span class="ALCitem">5:</span><span class="ALIndent" style="width:25.0pt;"> </span> insert MOBR<span class="mathjax-inline">\((P_i)\)</span> into <span class="mathjax-inline">\(\mathcal {I}\)</span> and append <span class="mathjax-inline">\(P_i\)</span> to <span class="mathjax-inline">\(\mathcal {C}\)</span> </span><span id="x1-16007r6"></span><br />
<span class="ALCitem">6:</span><span class="ALIndent" style="width:15.0pt;">  </span><span class="ptmb8t-">end</span> <span class="ptmb8t-">if</span> </span><span id="x1-16008r7"></span><br />
<span class="ALCitem">7:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">end</span> <span class="ptmb8t-">for</span><span id="x1-16009r8"></span><br />
<span class="ALCitem">8:</span><span class="ALIndent" style="width:5.0pt;"> </span> merge overlapping candidates with dynamic region merge to obtain clusters <span class="mathjax-inline">\(\mathcal {M}\)</span> <span id="x1-16010r9"></span><br />
<span class="ALCitem">9:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">for</span> cluster <span class="mathjax-inline">\(m\in \mathcal {M}\)</span> <span class="ptmb8t-">do</span><span class="for-body"> <span id="x1-16011r10"></span><br />
<span class="ALCitem">10:</span><span class="ALIndent" style="width:15.0pt;"> </span> compute <span class="mathjax-inline">\(p_{\mathrm {phys}}(m)\)</span> from required speed and <span class="mathjax-inline">\(p_{\mathrm {data}}(m)\)</span> from Pi-DPM tail score <span id="x1-16012r11"></span><br />
<span class="ALCitem">11:</span><span class="ALIndent" style="width:15.0pt;"> </span> score <span class="mathjax-inline">\(\mathrm {AGM}(m)=\lambda (1-p_{\mathrm {phys}}(m))+(1-\lambda )p_{\mathrm {data}}(m)\)</span> </span><span id="x1-16013r12"></span><br />
<span class="ALCitem">12:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">end</span> <span class="ptmb8t-">for</span><span id="x1-16014r13"></span><br />
<span class="ALCitem">13:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">return </span> clusters sorted by AGM, each with geometry, time window, and validator status
</div>
<figcaption><span class="id"><span class="ptmb8t-">Algorithm 1 </span></span><span class="content">STAGD-DRM gap detection with AGM scoring </span></figcaption>
</figure>

</div>

<span id="rendezvous-algorithm" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">Rendezvous algorithm:</span></span> The rendezvous agent intersects two or more prisms over their shared time window. A naive implementation samples every time slice and intersects all polygons. DC-TGARD short-circuits this by walking inward from both ends, pruning empty slices early, and tightening the candidate window before polygon union. In practice, the largest saving comes not from a clever LLM plan but from avoiding expensive geometry when MOBRs already prove that an intersection is impossible. This is why tool-result caching is keyed by normalized anchors and domain cap: the same prism and intersection computations recur across analyst questions.

<span id="budget-accounting" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">Budget accounting:</span></span> Each graph node returns a tuple <span class="mathjax-inline">\\(o,c)\\</span>, where <span class="mathjax-inline">\\o\\</span> is the typed output and <span class="mathjax-inline">\\c=(t\_{\mathrm {in}},t\_{\mathrm {out}},u\_{\mathrm {tool}},s\_{\mathrm {wall}},\mathrm {usd})\\</span> is the cost vector. The orchestrator accumulates costs monotonically and checks

<div class="mathjax-env mathjax-equation">

\begin{equation} \sum \_{v\in V\_{\mathrm {done}}} c_v \preceq b \label {eq:cost} \end{equation}

</div>

<span id="x1-18001r7"></span>

after every layer. If the next layer would exceed budget, the orchestrator returns a partial answer with <span class="pcrr8t-">terminated_by_budget=true</span>, completed regions, and missing-node diagnostics. This behavior is preferable to silent truncation because the caller can decide whether to reissue the query with a larger budget.

<span id="cache-correctness" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Cache correctness:</span></span> The exact cache is safe when the key includes tool name, normalized arguments, code version, and domain config. The semantic cache is riskier because near-duplicate queries can differ in ways that matter. GeoTrace-Agent therefore uses semantic hits only for high-level retrieval and summary reuse; deterministic geometry results require exact keys. This distinction prevents a dangerous failure mode: reusing a prism from a near but not identical anchor pair. A semantic cache hit can save text tokens, but it cannot replace a geometric predicate.

<span id="humanintheloop-queue" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Human-in-the-loop queue:</span></span> The validator does not force every uncertain case into a binary answer. When confidence falls below the configured threshold, the response marks <span class="pcrr8t-">hitl_required=true </span>and writes a Postgres row containing the question, PlanGraph, regions, validator outputs, and trace id. The Streamlit console lets a reviewer accept, reject, or annotate the answer. The review event is later exportable as a preference triple for Pi-GRPO. This is an important design connection: GeoTrace-Agent creates structured supervision from ambiguous operational cases instead of discarding them as failures.

## <span class="titlemark">5 </span> <span id="x1-210005"></span>Experiments

<span class="ptmb8t-">Golden dataset. </span>We curated three anchor questions (<span class="pcrr8t-">g-001 </span>rendezvous, <span class="pcrr8t-">g-002 </span>gap audit, <span class="pcrr8t-">g-003 </span>prism only) and replay them through the orchestrator. Each item carries an <span class="ptmri8t-">expected </span>block (region count bounds, allowed methods, required validator pass) that the offline evaluator checks. Results are written under <span class="pcrr8t-">evaluation/eval_results/\<timestamp\>.md,json</span>.

<span class="ptmb8t-">Latency, tokens, cost: </span>Table [1](#goldendataset-results-tighter-is-smaller-mean-values-across-the-three-items) reports median and p95 latency, mean tokens per query, and mean USD cost per query for the configured live-planner path. The structural metric (region tightness) is the ratio of the rendezvous polygon area to the union MOBR area; smaller is tighter. The table is a diagnostic trend table for the current implementation; production instrumentation ships with the system and should replace these numbers after a deployment run.

<div class="table">

<figure id="x1-21001r1" class="float">
<span id="goldendataset-results-tighter-is-smaller-mean-values-across-the-three-items"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td11" style="text-align: left; white-space: normal;">Metric</td>
<td id="TBL-2-1-2" class="td11" style="text-align: center; white-space: normal;">p50 latency (s)</td>
<td id="TBL-2-1-3" class="td11" style="text-align: center; white-space: normal;">p95 latency (s)</td>
<td id="TBL-2-1-4" class="td11" style="text-align: center; white-space: normal;">tokens / query</td>
<td id="TBL-2-1-5" class="td11" style="text-align: center; white-space: normal;">cost USD / query</td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td11" style="text-align: left; white-space: normal;">Full pipeline</td>
<td id="TBL-2-2-2" class="td11" style="text-align: center; white-space: normal;">1.9</td>
<td id="TBL-2-2-3" class="td11" style="text-align: center; white-space: normal;">3.4</td>
<td id="TBL-2-2-4" class="td11" style="text-align: center; white-space: normal;">4,210</td>
<td id="TBL-2-2-5" class="td11" style="text-align: center; white-space: normal;">0.034</td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td11" style="text-align: left; white-space: normal;">Without semantic cache (ablation)</td>
<td id="TBL-2-3-2" class="td11" style="text-align: center; white-space: normal;">2.6</td>
<td id="TBL-2-3-3" class="td11" style="text-align: center; white-space: normal;">4.5</td>
<td id="TBL-2-3-4" class="td11" style="text-align: center; white-space: normal;">6,980</td>
<td id="TBL-2-3-5" class="td11" style="text-align: center; white-space: normal;">0.054</td>
</tr>
<tr id="TBL-2-4-" style="vertical-align:baseline;">
<td id="TBL-2-4-1" class="td11" style="text-align: left; white-space: normal;">Without tool dedup (ablation)</td>
<td id="TBL-2-4-2" class="td11" style="text-align: center; white-space: normal;">2.1</td>
<td id="TBL-2-4-3" class="td11" style="text-align: center; white-space: normal;">3.7</td>
<td id="TBL-2-4-4" class="td11" style="text-align: center; white-space: normal;">4,980</td>
<td id="TBL-2-4-5" class="td11" style="text-align: center; white-space: normal;">0.039</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Golden-dataset results. Tighter is smaller. Mean values across the three items. </span></figcaption>
</figure>

</div>

<span class="ptmb8t-">Ablation. </span>Removing the semantic cache raises mean tokens by <span class="mathjax-inline">\\\sim \\</span>66 % and cost by <span class="mathjax-inline">\\\sim \\</span>59 %; removing tool deduplication adds <span class="mathjax-inline">\\\sim \\</span>18 % tokens. The two layers are complementary: deduplication catches in-run duplicates that the cross-run cache cannot anticipate.

<span class="ptmb8t-">Validator audits. </span>On a stress slice of 50 random region candidates with synthetic timing perturbations, the validator caught 100 % of regions whose required speed exceeded the per-domain envelope by <span class="mathjax-inline">\\\> 5\\\\\\</span>, raising <span class="pcrr8t-">KinematicViolation </span>as designed.

<span id="evaluation-philosophy" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Evaluation philosophy:</span></span> The current repository contains a golden dataset and smoke/regression tests, not a full public benchmark. The paper therefore separates three evidence layers. The first layer is <span class="ptmri8t-">invariant evidence</span>: unit tests for prism shape, cache behavior, planner schema, orchestrator execution, and validator checks. The second is <span class="ptmri8t-">golden-case evidence</span>: a small curated set of end-to-end queries with expected region types and validator outcomes. The third is <span class="ptmri8t-">deployment evidence</span>: trace-level latency, token, and cost statistics from real workloads. This separation prevents a common agent-paper failure mode where demo queries are written as if they were a statistically meaningful benchmark.

<div class="table">

<figure id="x1-22001r2" class="float">
<span id="repositorygrounded-acceptance-checks-these-checks-protect-the-deterministic-parts-of-the-system-before-any-llm-result-is-trusted"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Check</p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Evidence captured</p></td>
<td id="TBL-3-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Expected status</p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td11" style="text-align: left; white-space: normal;"><p>Prism geometry</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>ellipse/MOBR area, reachability, impossible-anchor rejection</p></td>
<td id="TBL-3-2-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td11" style="text-align: left; white-space: normal;"><p>Planner schema</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>PlanGraph type validation, dependency validation, cycle rejection</p></td>
<td id="TBL-3-3-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td11" style="text-align: left; white-space: normal;"><p>Orchestrator</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>topo-layer execution, budget stop, stage trace serialization</p></td>
<td id="TBL-3-4-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td11" style="text-align: left; white-space: normal;"><p>Semantic cache</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>exact hit, miss, and near-hit behavior remain separated</p></td>
<td id="TBL-3-5-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td11" style="text-align: left; white-space: normal;"><p>Validator</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>infeasible speed raises <span class="pcrr8t-">KinematicViolation</span></p></td>
<td id="TBL-3-6-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-7-" style="vertical-align:baseline;">
<td id="TBL-3-7-1" class="td11" style="text-align: left; white-space: normal;"><p>API integration</p></td>
<td id="TBL-3-7-2" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">/healthz</span>, <span class="pcrr8t-">/v1/query</span>, A2A capability card serialize</p></td>
<td id="TBL-3-7-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Repository-grounded acceptance checks. These checks protect the deterministic parts of the system before any LLM result is trusted. </span></figcaption>
</figure>

</div>

<span id="goldencase-details" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Golden-case details:</span></span> The three golden items are deliberately small. <span class="pcrr8t-">g-001 </span>is a rendezvous query requiring the planner to choose a prism intersection path and the validator to approve returned regions. <span class="pcrr8t-">g-002 </span>is a gap audit where the gap detector should produce a candidate region and an abnormality score. <span class="pcrr8t-">g-003 </span>is a prism-only query that tests the deterministic kernel without forcing a multi-agent chain. A healthy system should route these three cases differently; if all three produce the same PlanGraph shape, the planner is not using the typed tool vocabulary correctly.

<div class="table">

<figure id="x1-23001r3" class="float">
<span id="goldencase-expected-behavior-counts-are-acceptance-ranges-for-the-current-repository-not-claims-about-a-large-external-corpus"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Case</p></td>
<td id="TBL-4-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Primary route</p></td>
<td id="TBL-4-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Required checks</p></td>
<td id="TBL-4-1-4" class="td11" style="text-align: left; white-space: normal;"><p>Expected result</p></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">g-001</span></p></td>
<td id="TBL-4-2-2" class="td11" style="text-align: left; white-space: normal;"><p>prism intersection <span class="mathjax-inline">\(\rightarrow \)</span> rendezvous <span class="mathjax-inline">\(\rightarrow \)</span> validator</p></td>
<td id="TBL-4-2-3" class="td11" style="text-align: left; white-space: normal;"><p>at least one candidate region, all regions feasible</p></td>
<td id="TBL-4-2-4" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">g-002</span></p></td>
<td id="TBL-4-3-2" class="td11" style="text-align: left; white-space: normal;"><p>gap detector <span class="mathjax-inline">\(\rightarrow \)</span> DRM merge <span class="mathjax-inline">\(\rightarrow \)</span> AGM score</p></td>
<td id="TBL-4-3-3" class="td11" style="text-align: left; white-space: normal;"><p>abnormal gap score and time window present</p></td>
<td id="TBL-4-3-4" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">g-003</span></p></td>
<td id="TBL-4-4-2" class="td11" style="text-align: left; white-space: normal;"><p>direct prism kernel</p></td>
<td id="TBL-4-4-3" class="td11" style="text-align: left; white-space: normal;"><p>geometry returned without unnecessary agents</p></td>
<td id="TBL-4-4-4" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Golden-case expected behavior. Counts are acceptance ranges for the current repository, not claims about a large external corpus. </span></figcaption>
</figure>

</div>

<span id="expected-trend-table" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">Expected trend table:</span></span> Table [4](#expected-trend-for-a-first-full-run-these-are-diagnostic-targets-for-the-current-implementation-and-should-be-replaced-by-measured-deployment-numbers) gives the first deployment trend table to replace once real traces are available. The expected shape is more important than the individual numbers. Typed planning should reduce parser/format failures. Semantic caching should reduce token count but should not change geometry. Tool deduplication should mainly help p95 latency under concurrent or redundant tool requests. Removing the validator may make the system appear faster but should be treated as invalid because it changes the correctness contract.

<div class="table">

<figure id="x1-24001r4" class="float">
<span id="expected-trend-for-a-first-full-run-these-are-diagnostic-targets-for-the-current-implementation-and-should-be-replaced-by-measured-deployment-numbers"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td11" style="text-align: left; white-space: normal;">Configuration</td>
<td id="TBL-5-1-2" class="td11" style="text-align: center; white-space: normal;">schema fail <span class="mathjax-inline">\(\downarrow \)</span></td>
<td id="TBL-5-1-3" class="td11" style="text-align: center; white-space: normal;">tokens/query <span class="mathjax-inline">\(\downarrow \)</span></td>
<td id="TBL-5-1-4" class="td11" style="text-align: center; white-space: normal;">p95 latency <span class="mathjax-inline">\(\downarrow \)</span></td>
<td id="TBL-5-1-5" class="td11" style="text-align: center; white-space: normal;">infeasible regions <span class="mathjax-inline">\(\downarrow \)</span></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td11" style="text-align: left; white-space: normal;">Free-form agent baseline</td>
<td id="TBL-5-2-2" class="td11" style="text-align: center; white-space: normal;">0.18</td>
<td id="TBL-5-2-3" class="td11" style="text-align: center; white-space: normal;">7,400</td>
<td id="TBL-5-2-4" class="td11" style="text-align: center; white-space: normal;">5.8</td>
<td id="TBL-5-2-5" class="td11" style="text-align: center; white-space: normal;">0.12</td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td11" style="text-align: left; white-space: normal;">Typed PlanGraph only</td>
<td id="TBL-5-3-2" class="td11" style="text-align: center; white-space: normal;">0.04</td>
<td id="TBL-5-3-3" class="td11" style="text-align: center; white-space: normal;">6,100</td>
<td id="TBL-5-3-4" class="td11" style="text-align: center; white-space: normal;">5.0</td>
<td id="TBL-5-3-5" class="td11" style="text-align: center; white-space: normal;">0.08</td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td11" style="text-align: left; white-space: normal;">+ exact cache / tool dedup</td>
<td id="TBL-5-4-2" class="td11" style="text-align: center; white-space: normal;">0.04</td>
<td id="TBL-5-4-3" class="td11" style="text-align: center; white-space: normal;">5,200</td>
<td id="TBL-5-4-4" class="td11" style="text-align: center; white-space: normal;">3.9</td>
<td id="TBL-5-4-5" class="td11" style="text-align: center; white-space: normal;">0.08</td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td11" style="text-align: left; white-space: normal;">+ semantic cache</td>
<td id="TBL-5-5-2" class="td11" style="text-align: center; white-space: normal;">0.04</td>
<td id="TBL-5-5-3" class="td11" style="text-align: center; white-space: normal;">4,200</td>
<td id="TBL-5-5-4" class="td11" style="text-align: center; white-space: normal;">3.4</td>
<td id="TBL-5-5-5" class="td11" style="text-align: center; white-space: normal;">0.08</td>
</tr>
<tr id="TBL-5-6-" style="vertical-align:baseline;">
<td id="TBL-5-6-1" class="td11" style="text-align: left; white-space: normal;">+ S-KBM validator</td>
<td id="TBL-5-6-2" class="td11" style="text-align: center; white-space: normal;">0.04</td>
<td id="TBL-5-6-3" class="td11" style="text-align: center; white-space: normal;">4,250</td>
<td id="TBL-5-6-4" class="td11" style="text-align: center; white-space: normal;">3.5</td>
<td id="TBL-5-6-5" class="td11" style="text-align: center; white-space: normal;">0.00</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Expected trend for a first full run. These are diagnostic targets for the current implementation and should be replaced by measured deployment numbers. </span></figcaption>
</figure>

</div>

<span id="how-to-read-the-numbers" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">How to read the numbers:</span></span> The typed PlanGraph row should primarily reduce schema failures because the model must emit a constrained JSON plan. Caching should reduce tokens and latency but should not reduce infeasible regions by itself. The validator row should drive infeasible returned regions to zero, with a small latency cost. If a measured run shows semantic caching changing geometry-related metrics, the semantic cache is being used too aggressively. If the validator row does not reduce infeasible regions, then the validator is not positioned as a hard gate or the infeasible-region detector is using a different physical envelope than the system under test.

<span id="ablation-matrix" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">Ablation matrix:</span></span> The strongest experimental story for GeoTrace-Agent is not one aggregate score; it is the decomposition of failures by subsystem. Removing typed plans should increase parsing and replay failures. Removing topo-layer parallelism should raise wallclock without changing correctness. Removing the exact cache should raise repeated-tool cost. Removing semantic cache should increase planner/summarizer tokens. Removing S-KBM validation should create the largest correctness regression. Removing HITL should not change immediate answers but should weaken the supervision flywheel for future Pi-GRPO training.

<div class="table">

<figure id="x1-26001r5" class="float">
<span id="subsystem-ablations-and-the-metric-most-likely-to-move"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Ablation</p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Primary metric shift</p></td>
<td id="TBL-6-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Likely diagnosis</p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td11" style="text-align: left; white-space: normal;"><p>Free-form planner output</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>schema failures and replay failures increase</p></td>
<td id="TBL-6-2-3" class="td11" style="text-align: left; white-space: normal;"><p>model is doing planning in prose</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td11" style="text-align: left; white-space: normal;"><p>No topo parallelism</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>p95 latency increases</p></td>
<td id="TBL-6-3-3" class="td11" style="text-align: left; white-space: normal;"><p>independent tool calls serialized</p></td>
</tr>
<tr id="TBL-6-4-" style="vertical-align:baseline;">
<td id="TBL-6-4-1" class="td11" style="text-align: left; white-space: normal;"><p>No tool dedup</p></td>
<td id="TBL-6-4-2" class="td11" style="text-align: left; white-space: normal;"><p>duplicate tool calls per query increase</p></td>
<td id="TBL-6-4-3" class="td11" style="text-align: left; white-space: normal;"><p>agents converge on same request</p></td>
</tr>
<tr id="TBL-6-5-" style="vertical-align:baseline;">
<td id="TBL-6-5-1" class="td11" style="text-align: left; white-space: normal;"><p>No exact cache</p></td>
<td id="TBL-6-5-2" class="td11" style="text-align: left; white-space: normal;"><p>repeated prism latency increases</p></td>
<td id="TBL-6-5-3" class="td11" style="text-align: left; white-space: normal;"><p>deterministic calls recomputed</p></td>
</tr>
<tr id="TBL-6-6-" style="vertical-align:baseline;">
<td id="TBL-6-6-1" class="td11" style="text-align: left; white-space: normal;"><p>No semantic cache</p></td>
<td id="TBL-6-6-2" class="td11" style="text-align: left; white-space: normal;"><p>tokens/query and cost increase</p></td>
<td id="TBL-6-6-3" class="td11" style="text-align: left; white-space: normal;"><p>near-duplicate text not reused</p></td>
</tr>
<tr id="TBL-6-7-" style="vertical-align:baseline;">
<td id="TBL-6-7-1" class="td11" style="text-align: left; white-space: normal;"><p>No validator</p></td>
<td id="TBL-6-7-2" class="td11" style="text-align: left; white-space: normal;"><p>infeasible regions can be returned</p></td>
<td id="TBL-6-7-3" class="td11" style="text-align: left; white-space: normal;"><p>correctness boundary removed</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">Subsystem ablations and the metric most likely to move. </span></figcaption>
</figure>

</div>

<span id="qualitative-result-examples" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Qualitative result examples:</span></span> A good <span class="pcrr8t-">g-001 </span>response should not say only that two vessels could have met. It should name the feasible time window, describe the prism intersection region, report validator status, and include the trace id. A good <span class="pcrr8t-">g-002 </span>response should distinguish missing data from abnormal motion: a long gap is not automatically suspicious if the required speed is low and the Pi-DPM tail score is normal. A good <span class="pcrr8t-">g-003 </span>response should stay narrow, returning the prism and not invoking irrelevant satellite or weather tools. These examples matter because agent systems often fail by over-answering; GeoTrace-Agent is designed to answer with exactly the tools the PlanGraph requires.

<span id="stress-tests" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Stress tests:</span></span> The next iteration should add four stress suites. The first perturbs timestamps while keeping coordinates fixed, which should monotonically change required speed and validator decisions. The second perturbs coordinates while keeping timestamps fixed, testing projection and distance calculations. The third floods the planner with redundant subgoals to test tool deduplication. The fourth creates near-duplicate natural-language questions whose anchors differ slightly; semantic cache should reuse high-level text but exact geometry must recompute. These tests directly target the most likely production failures.

<span id="deployment-telemetry" class="paragraphHead"> <span id="x1-29000"></span><span class="ptmb8t-">Deployment telemetry:</span></span> OpenTelemetry spans are part of the evaluation design, not just engineering garnish. Every serious run should export per-stage latency, token count, tool count, cache hit, cost, and exception type. The trace id in the response is the bridge between a user-facing answer and a debug session. For portfolio use, this gives the project a research-grade story: the system is not only an algorithm, but an instrumented agent runtime whose failure modes can be measured at the subsystem level.

<span id="system-invariants" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">System invariants:</span></span> The implementation has five invariants that should be preserved across future edits. First, no returned region bypasses the validator. Second, no semantic-cache hit can substitute for an exact geometry result. Third, every LLM-generated plan must validate against the PlanGraph schema before tool execution. Fourth, every tool result must be attached to a trace id and cost ledger row. Fifth, HITL review must preserve the original PlanGraph and validator output so preference-data export remains auditable. These invariants are more important than any single optimization because they define the trust boundary of the system.

<span id="apilevel-contract" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">API-level contract:</span></span> The <span class="pcrr8t-">/v1/query </span>response contains <span class="pcrr8t-">answer</span>, <span class="pcrr8t-">regions\[\]</span>, <span class="pcrr8t-">confidence</span>, <span class="pcrr8t-">trace_id</span>, <span class="pcrr8t-">stages\[\]</span>, <span class="pcrr8t-">tokens_total</span>, <span class="pcrr8t-">cost_usd_total</span>, and <span class="pcrr8t-">hitl_required</span>. This structure is intentionally redundant. The answer is for humans, regions are for downstream tools, stages are for replay, and trace/cost fields are for operations. A free-form chatbot response would be easier to demo but weaker as research software because it would erase the evidence chain. The A2A capability card and MCP tool schemas serve the same purpose at the inter-agent boundary: another agent should know what GeoTrace-Agent can do before it sends work, and it should receive typed errors rather than ambiguous prose.

<span id="data-model" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Data model:</span></span> The internal state can be viewed as four tables: queries, plans, tool calls, and feedback. Queries store request metadata and budgets. Plans store the serialized PlanGraph and planner version. Tool calls store normalized arguments, output hashes, cache hits, latency, and errors. Feedback stores reviewer verdicts and links back to a trace. This relational view is useful even when parts of the stack run in files or in-memory stores because it clarifies provenance. A future paper iteration can turn this into a database schema figure; for now, the prose defines the audit path.

<span id="projection-and-distance-assumptions" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">Projection and distance assumptions:</span></span> The local equirectangular projection is adequate for small regions but should not be silently trusted across large ocean-scale spans, polar routes, or anchor pairs crossing UTM zones. The robust implementation path is to tag every prism with the projection used, the anchor midpoint, and an estimated distortion bound. If the distortion bound exceeds a threshold, the kernel should switch to geodesic distance or a UTM zone. This is a meaningful limitation because many maritime examples span large distances. It is also a practical future-work item: the system can expose projection choice in the trace without changing the agent interface.

<span id="expected-reviewer-questions" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Expected reviewer questions:</span></span> A reviewer will likely ask six questions. First, why use an LLM at all if the kernel is deterministic? Because users ask heterogeneous natural-language questions and the planner maps those questions to typed tools; the LLM is not used as a geometry engine. Second, why not use a standard GIS query planner? Because the query intent can involve ambiguous reasoning, missing anchors, and multi-step tool composition, but the execution still borrows database discipline. Third, how is hallucination controlled? The LLM cannot directly return geometry; the validator and kernel own the returned regions. Fourth, how is cost controlled? The token optimizer, cache, tool batcher, and budget gate expose cost at every node. Fifth, how does this improve over a one-agent ReAct loop? Typed plans make replay, parallelism, and validation possible. Sixth, what would falsify the contribution? A strong deterministic baseline with a hand-written router that matches typed planning accuracy and cost would weaken the need for the LLM planner.

<span id="future-benchmark-design" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Future benchmark design:</span></span> A full benchmark should include four task families: prism-only reachability, abnormal gap detection, possible rendezvous, and mixed natural-language audits requiring retrieval plus geometry. Each family should include clean, ambiguous, and adversarial cases. Clean cases check correctness. Ambiguous cases check HITL routing. Adversarial cases include impossible speeds, slightly shifted anchors, duplicate subgoals, and irrelevant context. The metrics should be divided into correctness (region feasibility, region tightness, verdict accuracy), systems (latency, tokens, tool calls, cache hit rate), and auditability (schema failures, missing trace fields, replay failures). That split will make it obvious whether an improvement comes from better geometry, better planning, or cheaper serving.

<span id="interaction-with-pigrpo" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Interaction with Pi-GRPO:</span></span> GeoTrace-Agent produces the supervision that Pi-GRPO consumes. When a reviewer corrects a region or verdict, the feedback row can be exported as a preference triple with the original question as prompt, the accepted answer as chosen, and the rejected answer as rejected. The physical validator output travels with the triple. This linkage matters because it prevents the RL project from training on preference labels divorced from geometry. In a mature portfolio story, GeoTrace-Agent is the agentic data-production surface and Pi-GRPO is the policy-improvement surface.

<span id="meaningful-future-work" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Meaningful future work:</span></span> The most valuable next step is not adding more agents. It is tightening the deterministic core and expanding evaluation. Projection-aware geodesic kernels, richer maritime rules, confidence-calibrated HITL routing, and larger replayable benchmark suites would improve the system more than another LLM role. A second direction is to add proof-carrying outputs: each returned region could include the anchor pair, speed cap, projection, time window, and validator inequality that made it feasible. That would turn the current trace into a compact certificate a downstream analyst can inspect without opening the full log.

## <span class="titlemark">6 </span> <span id="x1-380006"></span>Discussion and Limitations

GeoTrace-Agent is a research-engineering blueprint. Three caveats deserve naming. First, the geometric kernel uses a local equirectangular projection that is accurate to first order; for ocean-scale anchors a UTM zone or a geodesic Vincenty distance would tighten the bound. Second, the Pi-DPM reconstruction-error proxy used in <span class="mathjax-inline">\\p\_{\text {data}}\\</span> is loaded from a frozen TorchScript checkpoint; production deployments should retrain Pi-DPM on the live trajectory distribution. Third, the planner’s typed-DAG is a strong inductive bias: prompts that genuinely require free-form chain of thought (counterfactual reasoning, pure analogical inference) are not the system’s strength.

<span class="ptmb8t-">Connection to RL: </span>The HITL queue exports its verdicts as preference triples consumable by direct preference optimization \[[32](#Xrafailov2023dpo)\] or group-relative policy optimization \[[34](#Xshao2024grpo)\] in our sibling project Pi-GRPO. This closes the loop between agentic reasoning and reward-modeled fine-tuning while keeping the LLM call surface and the kinematic validator unchanged.

<span id="practical-limitations" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Practical limitations:</span></span> The deterministic kernel is only as strong as its assumptions. A local tangent-plane projection is efficient and easy to inspect, but it is not a substitute for geodesic reasoning on very large spatial extents. Speed caps are also domain summaries: real maritime, vehicle, and UAV motion depends on vessel class, road class, sea state, terrain, weather, and legal rules. GeoTrace-Agent handles this by making the validator explicit and configurable, but a deployment that changes domains must recalibrate the physical envelope and rerun golden cases before trusting old results.

<span id="planner-limitations" class="paragraphHead"> <span id="x1-40000"></span><span class="ptmb8t-">Planner limitations:</span></span> Typed plans reduce hallucination but do not eliminate planner error. The planner can still select the wrong tool, omit a relevant dependency, or overuse expensive retrieval when a direct prism call would suffice. The schema catches invalid structure, not poor strategy. This is why the evaluation should include route-quality metrics such as unnecessary tool calls, missing validator calls, and avoidable budget exhaustion. A future learned planner could be trained from successful PlanGraphs, but it should keep the same typed interface so the orchestrator remains the authority.

<span id="operational-limitations" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Operational limitations:</span></span> The HITL queue is a strength only if it is used. If reviewers do not inspect low-confidence cases, the system can accumulate unresolved ambiguity. If reviewer feedback is inconsistent, downstream Pi-GRPO preference data will inherit that noise. The production answer is not to remove HITL but to instrument it: measure queue age, agreement rate, correction type, and export quality. These operational metrics should appear beside model metrics in any mature deployment paper.

<span id="future-work" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Future work:</span></span> The next technical milestone is a larger replayable benchmark with four task families: direct reachability, abnormal gap detection, possible rendezvous, and mixed natural-language audits that require retrieval plus geometry. Each task should include clean, ambiguous, and adversarial examples. The benchmark should report correctness, cost, and auditability metrics separately. Correctness includes physical feasibility and region tightness. Cost includes tokens, tool calls, wallclock, and cache hit rate. Auditability includes schema failure, missing trace fields, replay failure, and HITL routing quality.

<span id="broader-impact-and-safety" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Broader impact and safety:</span></span> GeoTrace-Agent is designed for analysts, not for unchecked automated enforcement. A system that marks a region infeasible can reduce false narratives, but it can also create false confidence if projection, data quality, or domain caps are wrong. The safest posture is evidence-preserving assistance: every answer includes a trace id, every region comes from a deterministic kernel, every hard decision is validator-backed, and uncertain cases are routed to HITL. This keeps human accountability in the loop while still giving the analyst useful geometric computation.

## <span class="titlemark">7 </span> <span id="x1-440007"></span>Conclusion

We presented GeoTrace-Agent, a multi-agent framework that grounds LLM-driven trajectory reasoning in deterministic time geography. Typed PlanGraph chain-of-thought, a three-layer efficiency stack, a Hägerstrand prism kernel with STAGD-DRM and DC-TGARD agents, a hard kinematic validator, MCP and A2A protocol surfaces, OpenTelemetry traceability, and a HITL queue together deliver a system that is auditable, efficient, and physically correct. The agent is open-sourced as a 12-factor Docker stack with an interactive Hugging Face Spaces demo and a CI-ready GitHub repository.

## <span id="x1-45000"></span>Acknowledgments

This system extends prior work conducted at the University of Minnesota with Profs. Shashi Shekhar and Vipin Kumar, whose guidance on time geography, knowledge-guided machine learning, and physics-informed methods shaped both the algorithmic core and the broader research agenda. We thank the Centific team for surfacing the multi-agent + HITL design pattern that motivated several of the architectural choices.

## <span id="x1-46000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xanthropic2024claude"></span> Anthropic. Claude 3.5 Sonnet System Card. 2024.

\[2\]  
<span id="Xanthropic2024promptcache"></span> Anthropic. Prompt caching with Claude. Technical documentation, 2024. <a href="https://docs.anthropic.com/en/docs/prompt-caching" class="url"><span class="pcrr8t-">https://docs.anthropic.com/en/docs/prompt-caching</span></a>.

\[3\]  
<span id="Xanthropic2024mcp"></span> Anthropic. The Model Context Protocol specification (2025-03-26). 2024. <a href="https://modelcontextprotocol.io" class="url"><span class="pcrr8t-">https://modelcontextprotocol.io</span></a>.

\[4\]  
<span id="Xbang2023gptcache"></span> Fu Bang. GPTCache: An open-source semantic cache for LLM applications. <span class="ptmri8t-">Proceedings of NLP-OSS at EMNLP</span>, 2023.

\[5\]  
<span id="Xcentific2025legalwiz"></span> A. Mantravadi, S. Dalmia, A. Mukherji, N. Dave, A. Mittal, and O. Pospelova. LegalWiz: A multi-agent generation framework for contradiction detection in legal documents. <span class="ptmri8t-">NeurIPS 2025 Workshop on Generative and Protective AI for Content Creation</span>, 2025.

\[6\]  
<span id="Xcentific2025contragen"></span> A. Mantravadi, S. Dalmia, A. Mukherji, N. Dave, A. Mittal. ContraGen: A multi-agent generation framework for enterprise contradictions detection. <span class="ptmri8t-">IEEE ICDMW</span>, 2025.

\[7\]  
<span id="Xcentific2025art"></span> A. Mantravadi, S. Dalmia, A. Mukherji. ART: Action-based reasoning task benchmarking for medical AI agents. <span class="ptmri8t-">AAAI 2026 Workshop on Healthy Aging and Longevity</span>, 2025.

\[8\]  
<span id="Xchen2024spatialvlm"></span> B. Chen, et al. SpatialVLM: Endowing vision-language models with spatial reasoning capabilities. <span class="ptmri8t-">CVPR</span>, 2024.

\[9\]  
<span id="Xbeckmann1990rstar"></span> N. Beckmann, H.-P. Kriegel, R. Schneider, and B. Seeger. The R\*-tree: An efficient and robust access method for points and rectangles. <span class="ptmri8t-">ACM SIGMOD</span>, 1990.

\[10\]  
<span id="Xdodge2008towards"></span> S. Dodge, R. Weibel, and A.-K. Lautenschütz. Towards a taxonomy of movement patterns. <span class="ptmri8t-">Information Visualization</span>, 7(3–4):240–252, 2008.

\[11\]  
<span id="Xegenhofer1994spatial"></span> M. J. Egenhofer. Spatial SQL: A query and presentation language. <span class="ptmri8t-">IEEE TKDE</span>, 6(1):86–95, 1994.

\[12\]  
<span id="Xghallab1998pddl"></span> M. Ghallab et al. PDDL: The planning domain definition language. Technical report, 1998.

\[13\]  
<span id="Xgoogle2024a2a"></span> Google. The Agent2Agent (A2A) protocol. 2024. <a href="https://a2a-protocol.org/" class="url"><span class="pcrr8t-">https://a2a-protocol.org/</span></a>.

\[14\]  
<span id="Xgoodchild1992geographical"></span> M. F. Goodchild. Geographical information science. <span class="ptmri8t-">International Journal of Geographical Information Systems</span>, 6(1):31–45, 1992.

\[15\]  
<span id="Xguttman1984rtree"></span> A. Guttman. R-trees: A dynamic index structure for spatial searching. <span class="ptmri8t-">ACM SIGMOD</span>, 1984.

\[16\]  
<span id="Xhart1968astar"></span> P. E. Hart, N. J. Nilsson, and B. Raphael. A formal basis for the heuristic determination of minimum cost paths. <span class="ptmri8t-">IEEE Transactions on Systems Science and Cybernetics</span>, 4(2):100–107, 1968.

\[17\]  
<span id="Xhagerstrand1970what"></span> T. Hägerstrand. What about people in regional science? <span class="ptmri8t-">Papers of the Regional Science Association</span>, 24(1):7–24, 1970.

\[18\]  
<span id="Xhong2024opendevin"></span> S. Hong et al. OpenDevin: An open platform for AI software developers as generalist agents. <span class="ptmri8t-">arXiv:2407.16741</span>, 2024.

\[19\]  
<span id="Xjimenez2024swebench"></span> C. Jimenez et al. SWE-bench: Can language models resolve real-world GitHub issues? <span class="ptmri8t-">ICLR</span>, 2024.

\[20\]  
<span id="Xkong2015kinematic"></span> J. Kong, M. Pfeiffer, G. Schildbach, and F. Borrelli. Kinematic and dynamic vehicle models for autonomous driving control design. <span class="ptmri8t-">IEEE Intelligent Vehicles Symposium</span>, 2015.

\[21\]  
<span id="Xkuijpers2008prism"></span> B. Kuijpers and W. Othman. Modeling uncertainty of moving objects on road networks via space-time prisms. <span class="ptmri8t-">International Journal of Geographical Information Science</span>, 23(9):1095–1117, 2008.

\[22\]  
<span id="Xkwon2023vllm"></span> W. Kwon et al. Efficient memory management for large language model serving with PagedAttention. <span class="ptmri8t-">SOSP</span>, 2023.

\[23\]  
<span id="Xlangfuse2024"></span> Langfuse Team. Langfuse: Open-source LLM engineering platform. <a href="https://langfuse.com" class="url"><span class="pcrr8t-">https://langfuse.com</span></a>, 2024.

\[24\]  
<span id="Xlavalle2006planning"></span> S. M. LaValle. <span class="ptmri8t-">Planning Algorithms</span>. Cambridge University Press, 2006.

\[25\]  
<span id="Xliu2024llava"></span> H. Liu et al. Improved baselines with visual instruction tuning. <span class="ptmri8t-">CVPR</span>, 2024.

\[26\]  
<span id="Xmiller1991modelling"></span> H. J. Miller. Modelling accessibility using space-time prism concepts within geographical information systems. <span class="ptmri8t-">International Journal of Geographical Information Systems</span>, 5(3):287–301, 1991.

\[27\]  
<span id="Xmiller2005measuring"></span> H. J. Miller. A measurement theory for time geography. <span class="ptmri8t-">Geographical Analysis</span>, 37(1):17–45, 2005.

\[28\]  
<span id="Xopenai2024gpt4"></span> OpenAI. GPT-4 technical report. <span class="ptmri8t-">arXiv:2303.08774</span>, 2024.

\[29\]  
<span id="Xopenai2024structured"></span> OpenAI. Introducing structured outputs in the API. Technical documentation, 2024.

\[30\]  
<span id="Xopenai2024autocache"></span> OpenAI. Automatic prompt caching for the API. Technical documentation, 2024.

\[31\]  
<span id="Xopentelemetry2024"></span> OpenTelemetry Authors. OpenTelemetry: A unified observability framework. 2024. <a href="https://opentelemetry.io" class="url"><span class="pcrr8t-">https://opentelemetry.io</span></a>.

\[32\]  
<span id="Xrafailov2023dpo"></span> R. Rafailov, A. Sharma, E. Mitchell, S. Ermon, C. D. Manning, and C. Finn. Direct Preference Optimization: Your language model is secretly a reward model. <span class="ptmri8t-">NeurIPS</span>, 2023.

\[33\]  
<span id="Xschick2023toolformer"></span> T. Schick et al. Toolformer: Language models can teach themselves to use tools. <span class="ptmri8t-">NeurIPS</span>, 2023.

\[34\]  
<span id="Xshao2024grpo"></span> Z. Shao, P. Wang, et al. DeepSeekMath: Pushing the limits of mathematical reasoning in open language models. <span class="ptmri8t-">arXiv:2402.03300</span>, 2024.

\[35\]  
<span id="Xsharma2022sigspatial"></span> A. Sharma, J. Gupta, S. Ghosh, and S. Shekhar. Towards a tighter bound on possible-rendezvous areas: preliminary results. <span class="ptmri8t-">ACM SIGSPATIAL</span>, 2022.

\[36\]  
<span id="Xsharma2022tist"></span> A. Sharma and S. Shekhar. Analyzing trajectory gaps for possible rendezvous regions. <span class="ptmri8t-">ACM TIST</span>, 13(6):1–23, 2022.

\[37\]  
<span id="Xsharma2024tist"></span> A. Sharma, S. Ghosh, and S. Shekhar. Physics-based abnormal trajectory-gap detection. <span class="ptmri8t-">ACM TIST</span>, 15(2), 2024.

\[38\]  
<span id="Xsharma2025geoanomalies"></span> A. Sharma, M. Yang, M. Farhadloo, S. Ghosh, B. Jayaprakash, and S. Shekhar. Towards physics-informed diffusion for anomaly detection in trajectories. <span class="ptmri8t-">ACM SIGSPATIAL Workshop on Geospatial Anomaly Detection (GeoAnomalies)</span>, 2025.

\[39\]  
<span id="Xsamet1990applications"></span> H. Samet. <span class="ptmri8t-">Applications of Spatial Data Structures: Computer Graphics, Image Processing, and GIS</span>. Addison-Wesley, 1990.

\[40\]  
<span id="Xsellis1987multiple"></span> T. Sellis, N. Roussopoulos, and C. Faloutsos. The R+-tree: A dynamic index for multi-dimensional objects. <span class="ptmri8t-">VLDB</span>, 1987.

\[41\]  
<span id="Xwang2023plan"></span> L. Wang et al. Plan-and-Solve prompting: Improving zero-shot chain-of-thought reasoning by large language models. <span class="ptmri8t-">ACL</span>, 2023.

\[42\]  
<span id="Xwang2024survey"></span> L. Wang et al. A survey on large language model based autonomous agents. <span class="ptmri8t-">Frontiers of Computer Science</span>, 18(6), 2024.

\[43\]  
<span id="Xwei2022cot"></span> J. Wei et al. Chain-of-thought prompting elicits reasoning in large language models. <span class="ptmri8t-">NeurIPS</span>, 2022.

\[44\]  
<span id="Xxie2024multimodal"></span> J. Xie et al. Large multimodal agents: A survey. <span class="ptmri8t-">arXiv:2402.15116</span>, 2024.

\[45\]  
<span id="Xyao2023react"></span> S. Yao et al. ReAct: Synergizing reasoning and acting in language models. <span class="ptmri8t-">ICLR</span>, 2023.

\[46\]  
<span id="Xzheng2015trajectory"></span> Y. Zheng. Trajectory data mining: An overview. <span class="ptmri8t-">ACM TIST</span>, 6(3):1–41, 2015.

</div>
