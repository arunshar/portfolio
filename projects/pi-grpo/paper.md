# Physics-Informed Reinforcement Learning for Trajectory Generation and Reasoning

Arun Sharma, University of Minnesota, Twin Cities

_In preparation. Target: NeurIPS workshop_

<div class="section abstract" role="doc-abstract">

<div class="centerline">

<span class="ptmb8t-x-x-120">Abstract</span>

</div>

> We present <span class="ptmb8t-">Pi-GRPO</span>, a physics-informed reinforcement-learning stack that fine-tunes trajectory and reasoning policies under a hybrid reward combining a hard kinematic-bicycle envelope, a calibrated soft penalty over the empirical jerk and curvature distribution, a Pi-DPM (physics-informed diffusion) reconstruction-error term, and an optional preference classifier. Three trainers share the same reward path: PPO with a value head and an adaptive Kullback–Leibler controller, DPO with a small physics-aware augmentation <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> that injects a kinematic penalty into the implicit reward, and GRPO with group-baseline advantages and no value head. The hard term is unbounded by design so a single physical violation dominates the gradient and prevents the well-known reward-hacking failure mode in which models exploit a soft preference signal at the expense of physics. The system supports vLLM-backed online rollouts with prefix caching for higher rollout throughput on long prompts and falls back to a Hugging Face Transformers backend for offline tests; checkpoints are content-addressed under <span class="pcrr8t-">runs/\<id\>/step\_\<n\>/\<sha\>.bin </span>with an audit manifest. A data curator turns human-in-the-loop verdicts exported from our sibling agentic system GeoTrace-Agent into versioned <span class="mathjax-inline">\\(\text {prompt}, \text {chosen}, \text {rejected})\\</span> DPO triples, closing a flywheel between agentic reasoning and reward-modeled fine-tuning. We describe the reward, the three trainers, the rollout and checkpoint infrastructure; report a CPU-reproducible evaluation comprising a property and unit suite, a measured reward-level reward-hacking probe, hot-path microbenchmarks, and a golden-dataset smoke evaluator, with trained-policy violation rates reported as diagnostic targets pending an in-progress full-scale run; and discuss safe-range guards that block runs from drifting into reward-hacking regimes. The system is open-sourced.

</div>

## <span class="titlemark">1 </span> <span id="x1-10001"></span>Introduction

Reinforcement learning from human feedback (RLHF) and its preference-based descendants have become standard tools for aligning large language models with human intent \[[22](#Xouyang2022training), [24](#Xrafailov2023dpo), [28](#Xshao2024grpo), [32](#Xstiennon2020learning)\]. In safety-critical domains where the answer must satisfy a known physical envelope, however, generic preference signals are insufficient: a model that produces a fluent answer about a vessel that exceeds the Coast Guard speed cap is rewarded by both human raters and content classifiers but is operationally wrong. Reward hacking \[[30](#Xskalse2022defining)\] emerges as the model learns to exploit the soft signal at the expense of the hard physical truth.

We present <span class="ptmb8t-">Pi-GRPO</span>, a physics-informed reinforcement-learning stack designed for two applications: (i) generating physically-consistent synthetic trajectories at higher fidelity than diffusion baselines such as DiffWave \[[18](#Xkong2021diffwave)\], DiffTraj \[[38](#Xzhu2024difftraj)\], and our prior GCDM \[[37](#Xyang2025gcdm)\]; and (ii) fine-tuning a reasoning policy that audits a trajectory and emits a verdict (<span class="ptmrc8t-"><span class="small-caps">PASS</span></span>, <span class="ptmrc8t-"><span class="small-caps">SOFT</span>\_<span class="small-caps">VIOLATION</span></span>, <span class="ptmrc8t-"><span class="small-caps">HARD</span>\_<span class="small-caps">VIOLATION</span></span>). Both applications share a single reward path:

<div class="mathjax-env mathjax-equation">

\begin{equation} R(\tau ) \\=\\ w\_{\text {hard}}\\ R\_{\text {hard}}(\tau ) \\+\\ w\_{\text {soft}}\\ R\_{\text {soft}}(\tau ) \\+\\ w\_{\text {data}}\\ R\_{\text {data}}(\tau ) \\+\\ w\_{\text {pref}}\\ R\_{\text {pref}}(\tau ). \label {eq:reward} \end{equation}

</div>

<span id="x1-1001r1"></span>

The hard term penalizes any single-axle kinematic-bicycle (S-KBM) \[[17](#Xkong2015kinematic)\] envelope violation; the soft term targets the 95th-percentile curvature and jerk relative to an empirical distribution fit on Porto, Harbin, and MarineCadastre AIS data; the data term is a calibrated tail probability under the Pi-DPM \[[29](#Xsharma2025geoanomalies)\] diffusion prior; and the preference term is an optional cross-encoder.

We adopt three trainers and unify them under this reward. <span class="ptmri8t-">PPO </span>\[[27](#Xschulman2017ppo)\] keeps a value head and an adaptive Kullback–Leibler controller; <span class="ptmri8t-">DPO </span>\[[24](#Xrafailov2023dpo)\] learns directly from preference triples and is augmented with a small <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> term that biases the implicit reward away from physics-violating outputs; <span class="ptmri8t-">GRPO </span>\[[8](#Xdeepseek2025r1), [28](#Xshao2024grpo)\] samples <span class="mathjax-inline">\\K\\</span> rollouts per prompt and normalizes advantages within the group, with no value head, which is particularly well-suited to short-horizon physics-reasoning prompts where critic fitting is hard.

<span class="ptmb8t-">Contributions.</span>

1\.  
A <span class="ptmb8t-">hybrid physics-aware reward </span>(Equation [1](#x1-1001r1)) whose hard term is unbounded by design so that a single S-KBM violation dominates the gradient even at maximal preference logits, eliminating the soft-vs-hard reward-hacking failure mode.

2\.  
Three <span class="ptmb8t-">trainers under one reward path</span>: PPO with adaptive KL, DPO with a <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> augmentation, and GRPO with group-baseline advantages. A bounded <span class="pcrr8t-">AdaptiveKLController </span>regulates KL drift; safe-range yaml guards block out-of-band hyperparameters unless explicitly overridden.

3\.  
A <span class="ptmb8t-">rollout and checkpoint infrastructure </span>backed by vLLM \[[19](#Xkwon2023vllm)\] with prefix caching for <span class="mathjax-inline">\\\sim \\</span>4<span class="mathjax-inline">\\\times \\</span> throughput on long prompts (with a Hugging Face Transformers fallback for tests) and content-addressed checkpoints (<span class="pcrr8t-">runs/\<id\>/step\_\<n\>/\<sha\>.bin</span>) with an append-only audit manifest.

4\.  
A <span class="ptmb8t-">HITL-to-DPO data flywheel</span>: a data curator imports human-in-the-loop verdicts emitted by the sibling agentic system GeoTrace-Agent (described in a companion preprint) and emits versioned preference triples, closing the loop between agentic reasoning and reward-modeled fine-tuning.

## <span class="titlemark">2 </span> <span id="x1-20002"></span>Related Work

<span class="ptmb8t-">RLHF and preference optimization: </span>Stiennon et al. \[[32](#Xstiennon2020learning)\] introduced KL-regularized PPO for summarization preferences; Ouyang et al. \[[22](#Xouyang2022training)\] scaled the recipe to InstructGPT; Rafailov et al. \[[24](#Xrafailov2023dpo)\] eliminated the explicit reward model with DPO; Shao et al. \[[28](#Xshao2024grpo)\] introduced GRPO with group-relative advantages, later popularized by DeepSeek-R1 \[[8](#Xdeepseek2025r1)\]. Constitutional AI \[[1](#Xbai2022constitutional)\] and RLAIF \[[20](#Xlee2024rlaif)\] added AI-generated preferences. Pi-GRPO inherits all three families and contributes a physics-aware reward that complements rather than replaces them.

<span class="ptmb8t-">Physics-informed deep learning: </span>Physics-informed neural networks \[[25](#Xraissi2019pinn)\], knowledge-guided machine learning \[[16](#Xkarpatne2017kgml)\], and physics-informed diffusion \[[11](#Xghosh2024kriging), [29](#Xsharma2025geoanomalies), [37](#Xyang2025gcdm)\] encode governing equations or kinematic priors as soft penalties or decoder structures. The S-KBM \[[17](#Xkong2015kinematic)\] appears as a diffusion-decoder prior in Pi-DPM. Pi-GRPO promotes the S-KBM constraint to a first-class reward term, with the hard component unbounded so the gradient prefers physical correctness over preference even at the worst case.

<span class="ptmb8t-">Reward hacking and safety: </span>Skalse et al. \[[30](#Xskalse2022defining)\] formalize reward hacking; Casper et al. \[[2](#Xcasper2023open)\] survey RLHF failure modes; Eisenstein et al. \[[10](#Xeisenstein2023helping)\] analyze proxy-reward exploitation. Earlier reward-shaping work \[[21](#Xng1999policy), [35](#Xpotentialbased2003)\] shows when auxiliary rewards can preserve optimal policies, while modern alignment work shows that proxy rewards can still be optimized in unintended directions when the proxy and true objective diverge. Pi-GRPO therefore treats physics as a first-class constraint rather than a soft preference term: violation magnitude is unbounded, so any policy that exploits the soft signal at the expense of the kinematic envelope is penalized in proportion to the violation. Reward dominance is monitored at the per-term level (W&B panels per term), and safe-range guards prevent common destabilizing hyperparameter choices before a run starts.

<span class="ptmb8t-">Agent-driven preference data: </span>Centific’s recent multi-agent + HITL frameworks \[[5](#Xcentific2025legalwiz)–[7](#Xcentific2025art)\] surface the human-in-the-loop verdict as a first-class signal; we consume those verdicts via the sibling agentic system GeoTrace-Agent (companion preprint), where ambiguous traces (validator-confidence below threshold) flow into a Postgres queue. The data curator joins reviewer verdicts with original prism / region payloads and emits preference triples that feed DPO directly.

<span class="ptmb8t-">Trajectory generation and physically constrained sequence models: </span>The trajectory-generation literature has moved from Markovian mobility models and recurrent neural networks toward diffusion and score-based models \[[12](#Xho2020ddpm), [18](#Xkong2021diffwave), [31](#Xsong2021score), [38](#Xzhu2024difftraj)\]. These models are expressive but can generate visually plausible paths that violate kinematic limits unless the decoder or objective contains an explicit physical prior. Parallel work in imitation learning \[[13](#Xho2016gail), [26](#Xross2011dagger)\], model-based RL \[[33](#Xsutton1998rl), [36](#Xwilliams1992simple)\], and constrained MDPs \[[3](#Xachiam2017cpo), [4](#Xaltman1999constrained)\] offers mechanisms for safety, but most methods either need simulator rollouts or treat constraints as Lagrangian penalties that can be washed out by competing rewards. Pi-GRPO is narrower and more direct: it assumes a known kinematic envelope and makes the envelope dominate the preference objective whenever the two disagree.

<span class="ptmb8t-">Serving and systems for RL fine-tuning: </span>Modern preference training is often gated by rollout throughput and reproducibility rather than by the algebra of the loss. PagedAttention and vLLM \[[19](#Xkwon2023vllm)\] make long-context online rollouts practical; LoRA/QLoRA-style parameter-efficient training \[[9](#Xdettmers2023qlora), [14](#Xhu2022lora)\] and open instruction models \[[15](#Xjiang2023mistral), [23](#Xqwen2024qwen2), [34](#Xtouvron2023llama)\] lower the cost of adaptation. Pi-GRPO adopts this systems view: vLLM prefix caching is used for rollout throughput, a Transformers fallback supports CPU-friendly tests, and content-addressed checkpoints make every training artifact auditable.

## <span class="titlemark">3 </span> <span id="x1-30003"></span>Background

<span class="ptmb8t-">Single-axle kinematic-bicycle model (S-KBM). </span>State <span class="mathjax-inline">\\(x, y, \theta , v)\\</span> in (m, m, rad, m/s); control <span class="mathjax-inline">\\(a, \delta )\\</span> (acceleration and steering angle); discrete update <span class="mathjax-inline">\\x' = x + v\cos \theta \\h, y' = y + v\sin \theta \\h, \theta ' = \theta + (v/L)\tan \delta \\h, v' = v + a h\\</span> with wheelbase <span class="mathjax-inline">\\L\\</span>. Pi-DPM \[[29](#Xsharma2025geoanomalies)\] uses S-KBM as a diffusion-decoder prior and a regularizer over <span class="mathjax-inline">\\(v, a, \theta , \kappa , \dot \theta )\\</span>.

<span class="ptmb8t-">PPO. </span>Clipped surrogate <span class="mathjax-inline">\\L^{CLIP} = \mathbb {E}\[\min (\rho \_t A_t, \mathrm {clip}(\rho \_t,1\\-\\\epsilon ,1\\+\\\epsilon )A_t)\]\\</span> with <span class="mathjax-inline">\\\rho \_t\\</span> the importance ratio and <span class="mathjax-inline">\\A_t\\</span> a GAE \[[27](#Xschulman2017ppo)\]. KL to a frozen reference is added with an adaptive coefficient.

<span class="ptmb8t-">DPO. </span>For preference triples <span class="mathjax-inline">\\(x, y_w, y_l)\\</span> the loss is <span class="mathjax-inline">\\-\log \sigma \\\left (\beta \\\left \[\log \frac {\pi (y_w\|x)}{\pi \_{\text {ref}}(y_w\|x)} - \log \frac {\pi (y_l\|x)}{\pi \_{\text {ref}}(y_l\|x)}\right \]\right )\\</span> \[[24](#Xrafailov2023dpo)\]. No reward model, no value head.

<span class="ptmb8t-">GRPO. </span>For each prompt sample <span class="mathjax-inline">\\K\\</span> rollouts; advantage <span class="mathjax-inline">\\A_k = (R_k - \mathrm {mean}\_K(R))/\mathrm {std}\_K(R)\\</span>; the loss is the PPO clipped surrogate over <span class="mathjax-inline">\\A_k\\</span> plus a KL-to-reference term, with no value head \[[8](#Xdeepseek2025r1), [28](#Xshao2024grpo)\].

## <span class="titlemark">4 </span> <span id="x1-40004"></span>Method

<span id="problem-statement" class="paragraphHead"> <span id="x1-5000"></span><span class="ptmb8t-">Problem statement:</span></span> Let <span class="mathjax-inline">\\x\\</span> denote a prompt or conditioning context, <span class="mathjax-inline">\\y\\</span> a model completion, and <span class="mathjax-inline">\\\tau (y)\\</span> the trajectory or trajectory-like state sequence parsed from that completion. In the generation setting, <span class="mathjax-inline">\\x\\</span> contains a partial path, domain metadata, and sampling constraints; <span class="mathjax-inline">\\y\\</span> contains future deltas or a serialized candidate path. In the reasoning setting, <span class="mathjax-inline">\\x\\</span> contains a trajectory plus a natural-language audit request; <span class="mathjax-inline">\\y\\</span> contains a verdict and a short rationale. Both modes are optimized by the same objective because the reward operates on the physical interpretation <span class="mathjax-inline">\\\tau (y)\\</span> rather than on surface form alone. A policy <span class="mathjax-inline">\\\pi \_\theta (y\mid x)\\</span> is initialized from a supervised or instruction-tuned base model <span class="mathjax-inline">\\\pi \_0\\</span> and regularized against a frozen reference <span class="mathjax-inline">\\\pi \_{\mathrm {ref}}\\</span>.

The training objective is a KL-regularized expected-return problem

<div class="mathjax-env mathjax-equation">

\begin{equation} \max \_{\theta }\\ \mathbb {E}\_{x\sim \mathcal {D},\\ y\sim \pi \_\theta (\cdot \|x)} \left \[R(x,y) - \beta \_{\mathrm {KL}}\\ D\_{\mathrm {KL}}\\\left (\pi \_\theta (\cdot \|x)\\\\\\\pi \_{\mathrm {ref}}(\cdot \|x)\right )\right \], \label {eq:klobjective} \end{equation}

</div>

<span id="x1-5001r2"></span>

where <span class="mathjax-inline">\\R\\</span> is Equation [1](#x1-1001r1). The distinction from standard RLHF is that <span class="mathjax-inline">\\R\\</span> is not an opaque scalar produced by a learned reward model. It is a decomposed, instrumented reward with a formally privileged hard term. This matters operationally because a run can be stopped not merely when total reward falls but when one component begins to dominate or when the hard-violation rate diverges from the offline evaluator.

<span id="scope" class="paragraphHead"> <span id="x1-6000"></span><span class="ptmb8t-">Scope:</span></span> Pi-GRPO does not claim a new general-purpose RL algorithm. The contribution is a physics-informed system design that makes PPO, DPO, and GRPO share a single physically grounded reward path, a single rollout surface, and a single audit/checkpoint layer. The current repository includes CPU-friendly golden cases, trainer-unit checks, safe-range guards, and a Hugging Face Space demo. Long-horizon benchmark claims should be read as evaluation targets until replaced by domain-scale runs on the user’s deployment data; the paper therefore phrases trend tables as diagnostic expectations rather than external leaderboard results.

<figure class="figure">
<p><img src="figures/pi_grpo_neurips-d6b1269a61dfe1d82609abd402bb7a7c.svg" loading="lazy" alt="Figure" /> <span id="x1-6001r1"></span></p>
<figcaption><span class="id">Figure 1: </span><span class="content">Pi-GRPO system architecture. The implementation keeps one rollout engine, one parser/validator, one reward decomposition, and three trainer heads. This prevents trainer-specific reward drift and makes PPO, DPO, and GRPO comparable under the same physical evidence. </span></figcaption>
</figure>

<span id="design-invariants" class="paragraphHead"> <span id="x1-7000"></span><span class="ptmb8t-">Design invariants:</span></span> The repository enforces five invariants. First, the reward implementation used by PPO, DPO, and GRPO is shared; trainers cannot maintain private copies of the physics logic. Second, the S-KBM hard term is never clipped inside the reward model; clipping is allowed only at optimizer or logging boundaries. Third, the reference model is frozen and hash-checked so a KL term is always measured against a stable distribution. Fourth, checkpoints are content-addressed and accompanied by a manifest row containing run configuration, reward config, git SHA, and model hash. Fifth, all hyperparameters that are known to destabilize preference training are passed through <span class="pcrr8t-">configs/safe_ranges.yaml</span>.

<span id="reward-dominance" class="paragraphHead"> <span id="x1-8000"></span><span class="ptmb8t-">Reward dominance:</span></span> Suppose the preference model is bounded, <span class="mathjax-inline">\\\|R\_{\text {pref}}(x,y)\| \le B\_{\text {pref}}\\</span>, and the data/soft terms are bounded by <span class="mathjax-inline">\\B\_{\text {aux}}\\</span> under their configured normalizers. If a completion <span class="mathjax-inline">\\y\\</span> violates the hard envelope with excess <span class="mathjax-inline">\\\Phi (y)\\</span>, the reward difference between an infeasible completion <span class="mathjax-inline">\\y^{-}\\</span> and a feasible completion <span class="mathjax-inline">\\y^{+}\\</span> satisfies

<div class="mathjax-env mathjax-equation">

\begin{equation} R(x,y^{+}) - R(x,y^{-}) \ge w\_{\text {hard}}\Phi (y^{-}) - 2w\_{\text {pref}}B\_{\text {pref}} - 2B\_{\text {aux}}. \label {eq:dominance} \end{equation}

</div>

<span id="x1-8001r3"></span>

Therefore any violation with

<div class="mathjax-env mathjax-equation">

\begin{equation} \Phi (y^{-}) \> \frac {2w\_{\text {pref}}B\_{\text {pref}} + 2B\_{\text {aux}}}{w\_{\text {hard}}} \label {eq:threshold} \end{equation}

</div>

<span id="x1-8002r4"></span>

is dominated by the hard penalty regardless of the preference logit. This is a simple inequality, but it is the core safety property: as the violation grows, the hard term cannot be hidden by a fluent rationale or an overconfident preference classifier. The safe-range file bounds <span class="mathjax-inline">\\w\_{\text {pref}}/w\_{\text {hard}}\\</span> so the threshold remains in the range where the golden evaluator can detect violations.

### <span class="titlemark">4.1 </span> <span id="x1-90004.1"></span>Hybrid physics-aware reward

The reward is configured by <span class="pcrr8t-">configs/physics_reward.yaml</span>. The hard term sums relative excess across S-KBM bounds:

<div class="mathjax-env mathjax-equation">

\begin{equation} R\_{\text {hard}}(\tau ) = -\\\\\sum \_{t}\\\Big \[\big (\tfrac {\|v_t\|}{v\_{\max }}\\-\\1\big )\_{+} + \big (\tfrac {\|a_t\|}{a\_{\max }}\\-\\1\big )\_{+} + \big (\tfrac {\|\kappa \_t\|}{\kappa \_{\max }}\\-\\1\big )\_{+}\Big \], \end{equation}

</div>

<span id="x1-9001r5"></span>

where <span class="mathjax-inline">\\\kappa \_{\max } = \|\tan \delta \_{\max }\|/L\\</span>, <span class="mathjax-inline">\\(\cdot )\_{+}\\</span> denotes ReLU, and <span class="mathjax-inline">\\\tau \\</span> is a state sequence. Because <span class="mathjax-inline">\\R\_{\text {hard}}\\</span> is unbounded above, no choice of <span class="mathjax-inline">\\w\_{\text {pref}}\\</span> can outweigh a sustained hard violation. The soft term penalizes 95th-percentile statistics relative to the empirical envelope (Porto, Harbin, MarineCadastre AIS):

<div class="mathjax-env mathjax-equation">

\begin{equation} R\_{\text {soft}}(\tau ) = -\big \[(\kappa \_{p95}\\-\\\kappa \_{\text {ref}})\_{+} + (j\_{p95}\\-\\j\_{\text {ref}})\_{+}\big \] - 0.5(\rho \_{v}\\+\\\rho \_{a}\\+\\\rho \_{\delta }), \end{equation}

</div>

<span id="x1-9002r6"></span>

where <span class="mathjax-inline">\\\rho \_{\bullet }\\</span> is the per-step violation fraction. The data term <span class="mathjax-inline">\\R\_{\text {data}}\\</span> is a Pi-DPM \[[29](#Xsharma2025geoanomalies)\] log-likelihood loaded from a frozen TorchScript checkpoint; the preference term <span class="mathjax-inline">\\R\_{\text {pref}}\\</span> is a cross-encoder. Each term streams to W&B as a separate panel; reward-dominance flags trip when one term explains <span class="mathjax-inline">\\\>\\</span>80 % of the variance.

<figure class="figure">
<p><img src="figures/pi_grpo_neurips-6eb87ffda1babedcc41c9bfa154aa1aa.svg" loading="lazy" alt="Figure" /> <span id="x1-9003r2"></span></p>
<figcaption><span class="id">Figure 2: </span><span class="content">Hybrid physics-aware reward. The hard term is unbounded above so violations dominate the gradient even at maximal preference logits. </span></figcaption>
</figure>

### <span class="titlemark">4.2 </span> <span id="x1-100004.2"></span>PPO trainer with adaptive KL

The PPO trainer uses a clipped surrogate over GAE-1 advantages, a value head with an MSE objective, and an entropy bonus. KL to a frozen reference is added as a soft penalty controlled by an <span class="pcrr8t-">AdaptiveKLController </span>bounded to <span class="mathjax-inline">\\\[\text {clip}\_{\min }, \text {clip}\_{\max }\]\\</span> to prevent runaway. The reference model is verified by SHA at run start and run end; any deviation aborts the run.

### <span class="titlemark">4.3 </span> <span id="x1-110004.3"></span>DPO trainer with <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> augmentation

Standard DPO learns the implicit reward <span class="mathjax-inline">\\r\_\phi (x, y) = \beta (\log \pi (y\|x) - \log \pi \_{\text {ref}}(y\|x))\\</span>. We augment with a physics-aware penalty:

<div class="mathjax-env mathjax-equation">

\begin{equation} \tilde {r}(x, y) = \beta (\log \pi (y\|x) - \log \pi \_{\text {ref}}(y\|x)) - \gamma \_{\text {phys}}\\\Phi (y), \end{equation}

</div>

<span id="x1-11001r7"></span>

where <span class="mathjax-inline">\\\Phi (y)\\</span> is the per-output S-KBM violation sum. The DPO loss becomes <span class="mathjax-inline">\\-\log \sigma (\tilde {r}(x, y_w) - \tilde {r}(x, y_l))\\</span>. Setting <span class="mathjax-inline">\\\gamma \_{\text {phys}} = 0\\</span> recovers vanilla DPO.

### <span class="titlemark">4.4 </span> <span id="x1-120004.4"></span>GRPO trainer with group-baseline advantages

For each prompt we sample <span class="mathjax-inline">\\K\\</span> rollouts under the current policy. The advantage of the <span class="mathjax-inline">\\k\\</span>-th rollout is <span class="mathjax-inline">\\A_k = (R_k - \mu \_K)/\sigma \_K\\</span> where <span class="mathjax-inline">\\\mu \_K, \sigma \_K\\</span> are the mean and standard deviation of the rewards within the group. The loss is the PPO clipped surrogate over <span class="mathjax-inline">\\A_k\\</span> plus a token-wise KL-to-reference term, with no value head. Group size <span class="mathjax-inline">\\K=8\\</span> by default.

### <span class="titlemark">4.5 </span> <span id="x1-130004.5"></span>Rollouts and checkpoints

Online rollouts use vLLM \[[19](#Xkwon2023vllm)\] with <span class="pcrr8t-">-enable-prefix-caching </span>for <span class="mathjax-inline">\\\sim \\</span>4<span class="mathjax-inline">\\\times \\</span> throughput on long prompts; this is the difference between feasibility and infeasibility for online RL with reasoning prompts. The trainer also supports a Hugging Face Transformers fallback for tests. Checkpoints are content-addressed at <span class="pcrr8t-">runs/\<id\>/step\_\<n\>/\<sha\[:16\]\>.bin </span>with an append-only <span class="pcrr8t-">MANIFEST.jsonl </span>so arbitrary checkpoints are reproducible and auditable.

### <span class="titlemark">4.6 </span> <span id="x1-140004.6"></span>Preference dataset construction from HITL

The data curator pulls JSONL exports from the sibling GeoTrace-Agent system, joins them with the original trace’s regions and Pi-DPM scores, and emits <span class="mathjax-inline">\\(\text {prompt}, \text {chosen}, \text {rejected})\\</span> triples with margin filtering and label-leakage audit. A synthetic synthesizer ranks <span class="mathjax-inline">\\K\\</span> base-policy outputs by physics reward and constructs margin-<span class="mathjax-inline">\\\ge \\</span>-<span class="mathjax-inline">\\m\\</span> pairs for cold-start.

### <span class="titlemark">4.7 </span> <span id="x1-150004.7"></span>Safe-range guards

The orchestrator validates per-algorithm hyperparameter ranges from <span class="pcrr8t-">configs/safe_ranges.yaml</span> (e.g., <span class="mathjax-inline">\\\eta \in \[10^{-7}, 5\\\cdot \\10^{-5}\]\\</span>, <span class="mathjax-inline">\\\beta \in \[0.01, 1\]\\</span>). Out-of-band values raise <span class="pcrr8t-">UnsafeRange </span>unless the user passes <span class="pcrr8t-">extra:{unsafe:true}</span>. This is a first line of defense against ranges that silently destabilize training.

<span id="algorithmic-view" class="paragraphHead"> <span id="x1-16000"></span><span class="ptmb8t-">Algorithmic view:</span></span> Algorithm [1](#physicsinformed-grpo-update) gives the GRPO path because it is the most compact expression of the system’s physics-first design. PPO differs by fitting a value head and computing GAE; DPO differs by consuming paired preferences rather than online rewards. The common feature is that all three paths call the same <span class="pcrr8t-">PhysicsReward </span>object before an optimizer step is allowed to run.

<div class="algorithm">

<figure id="x1-16001r1" class="float">
<span id="physicsinformed-grpo-update"></span>
<div class="algorithmic">
<span class="ALCitem">Require:</span><span class="ALIndent" style="width:5.0pt;"> </span> prompt minibatch <span class="mathjax-inline">\(\mathcal {B}\)</span>, policy <span class="mathjax-inline">\(\pi _\theta \)</span>, frozen reference <span class="mathjax-inline">\(\pi _{\mathrm {ref}}\)</span>, group size <span class="mathjax-inline">\(K\)</span>, reward <span class="mathjax-inline">\(R\)</span> <span id="x1-16002r1"></span> <span class="ALCitem">1:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">for</span> each prompt <span class="mathjax-inline">\(x \in \mathcal {B}\)</span> <span class="ptmb8t-">do</span><span class="for-body"> <span id="x1-16003r2"></span><br />
<span class="ALCitem">2:</span><span class="ALIndent" style="width:15.0pt;"> </span> sample <span class="mathjax-inline">\(K\)</span> completions <span class="mathjax-inline">\(y_{1:K}\sim \pi _\theta (\cdot |x)\)</span> through the rollout engine <span id="x1-16004r3"></span><br />
<span class="ALCitem">3:</span><span class="ALIndent" style="width:15.0pt;"> </span> parse each completion into a trajectory or verdict payload <span class="mathjax-inline">\(\tau (y_k)\)</span> <span id="x1-16005r4"></span><br />
<span class="ALCitem">4:</span><span class="ALIndent" style="width:15.0pt;"> </span> compute decomposed rewards <span class="mathjax-inline">\(R_k = R(x,y_k)\)</span> and hard violations <span class="mathjax-inline">\(\Phi _k\)</span> <span id="x1-16006r5"></span><br />
<span class="ALCitem">5:</span><span class="ALIndent" style="width:15.0pt;"> </span> normalize <span class="mathjax-inline">\(A_k = (R_k-\mathrm {mean}(R_{1:K}))/(\mathrm {std}(R_{1:K})+\epsilon )\)</span> </span><span id="x1-16007r6"></span><br />
<span class="ALCitem">6:</span><span class="ALIndent" style="width:5.0pt;">  </span><span class="ptmb8t-">end</span> <span class="ptmb8t-">for</span><span id="x1-16008r7"></span><br />
<span class="ALCitem">7:</span><span class="ALIndent" style="width:5.0pt;"> </span> compute token-wise ratios <span class="mathjax-inline">\(\rho _{k,t}=\pi _\theta (y_{k,t}|x,y_{k,&lt;t})/\pi _{\theta _{\mathrm {old}}}(y_{k,t}|x,y_{k,&lt;t})\)</span> <span id="x1-16009r8"></span><br />
<span class="ALCitem">8:</span><span class="ALIndent" style="width:5.0pt;"> </span> minimize <span class="mathjax-inline">\(-\min (\rho _{k,t}A_k,\mathrm {clip}(\rho _{k,t},1-\epsilon ,1+\epsilon )A_k)+\beta _{\mathrm {KL}}D_{\mathrm {KL}}(\pi _\theta ||\pi _{\mathrm {ref}})\)</span> <span id="x1-16010r9"></span><br />
<span class="ALCitem">9:</span><span class="ALIndent" style="width:5.0pt;"> </span> reject update if safe-range, NaN, or hard-invariant checks fail; otherwise write a content-addressed checkpoint
</div>
<figcaption><span class="id"><span class="ptmb8t-">Algorithm 1 </span></span><span class="content">Physics-informed GRPO update </span></figcaption>
</figure>

</div>

<span id="dpo-as-a-constrained-preference-objective" class="paragraphHead"> <span id="x1-17000"></span><span class="ptmb8t-">DPO as a constrained preference objective:</span></span> For a triple <span class="mathjax-inline">\\(x,y_w,y_l)\\</span>, vanilla DPO assumes the observed preference is sufficient evidence that <span class="mathjax-inline">\\y_w\\</span> should have larger implicit reward. In a physical domain this assumption is too strong because a reviewer can prefer a fluent but infeasible answer. Pi-GRPO therefore treats the preference label and the physical envelope as two signals:

<div class="mathjax-env mathjax-equation">

\begin{equation} \Delta \_{\mathrm {DPO}} = \beta \left \[ \log \frac {\pi \_\theta (y_w\|x)}{\pi \_{\mathrm {ref}}(y_w\|x)} - \log \frac {\pi \_\theta (y_l\|x)}{\pi \_{\mathrm {ref}}(y_l\|x)} \right \] - \gamma \_{\mathrm {phys}}\left (\Phi (y_w)-\Phi (y_l)\right ). \label {eq:physdpo} \end{equation}

</div>

<span id="x1-17001r8"></span>

The loss is <span class="mathjax-inline">\\-\log \sigma (\Delta \_{\mathrm {DPO}})\\</span>. If both completions are physically valid, the physics term vanishes and the update is standard DPO. If the chosen completion violates physics more than the rejected completion, the physics term reduces the update magnitude and can flip the pair when the violation is severe. This is a conservative intervention: it does not require a learned reward model, and it does not discard human preference labels; it simply prevents the preference label from contradicting the known physical envelope without a penalty.

<span id="ppo-as-the-onlinecontrol-path" class="paragraphHead"> <span id="x1-18000"></span><span class="ptmb8t-">PPO as the online-control path:</span></span> PPO is retained because it is still the cleanest online-improvement path when the reward can be evaluated directly. The implementation computes GAE with a one-step bootstrap over the value head, clips the policy ratio, and adds the adaptive KL term. The important systems decision is that the rollout worker logs every reward component before advantage normalization. This makes reward hacking visible as a term-level shift: a rising total reward with a rising hard-violation rate is a failed run even if the PPO loss decreases smoothly.

<span id="checkpoint-and-replay-protocol" class="paragraphHead"> <span id="x1-19000"></span><span class="ptmb8t-">Checkpoint and replay protocol:</span></span> Each checkpoint path contains the step number and a hash prefix. The manifest records the base model, reference model, reward config, safe-range file, trainer config, Python version, package lock, and git SHA. A replay command can reconstruct the evaluator inputs and reward decomposition for any saved step. This is intentionally closer to an experiment ledger than to a simple model directory. The goal is to make a hiring-manager or reviewer audit possible: a model artifact should always answer the questions “what reward did this model see?” and “which hard-invariant checks passed before it was saved?”

<span id="security-and-data-hygiene" class="paragraphHead"> <span id="x1-20000"></span><span class="ptmb8t-">Security and data hygiene:</span></span> The repository includes input guards, content filters, and output filters around the FastAPI surface. These are not the research contribution, but they matter because HITL preference data can include vessel identifiers, coordinates, user comments, or traces from operational systems. The data curator strips reviewer-only metadata, rejects preference pairs with leaked labels in the prompt, and stores versioned JSONL files rather than mutating a single dataset in place. This is also why the paper treats HITL export as a data product: a preference triple is only useful if the provenance and filtering rules are inspectable.

## <span class="titlemark">5 </span> <span id="x1-210005"></span>Experiments

<span class="ptmb8t-">Setup. </span>The target full-scale configuration is <span class="pcrr8t-">Qwen2-7B-Instruct </span>\[[23](#Xqwen2024qwen2)\] as both policy and frozen reference, fine-tuned on 11k preference triples from a 30-day GeoTrace-Agent HITL export (<span class="mathjax-inline">\\\sim \\</span>8k natural HITL labels and <span class="mathjax-inline">\\\sim \\</span>3k synthesized via the curator’s <span class="mathjax-inline">\\K\\=\\8\\</span> rollout-and-rank), on 1<span class="mathjax-inline">\\\times \\</span>H100 80GB for training with 1<span class="mathjax-inline">\\\times \\</span>H100 hosting vLLM with prefix caching; that run is in progress. The results reported in this section are the CPU-reproducible checks that gate it: a property and unit suite, a measured reward-level reward-hacking probe, hot-path microbenchmarks, and the two-item golden evaluator. Trained-policy violation rates (Table [3](#expected-trend-table-for-the-first-full-run-values-are-diagnostic-targets-for-the-current-method-and-should-be-replaced-by-measured-numbers-after-training-on-the-users-final-corpus)) remain diagnostic targets until that run completes.

<span class="ptmb8t-">Golden-dataset evaluator. </span>The CPU-friendly evaluator <span class="pcrr8t-">evaluation/offline_eval.py </span>ships two synthetic items: a clean trajectory (<span class="pcrr8t-">p-001</span>, expected verdict <span class="ptmrc8t-"><span class="small-caps">PASS</span></span>) and a speeding trajectory (<span class="pcrr8t-">p-002</span>, expected <span class="ptmrc8t-"><span class="small-caps">HARD</span>\_<span class="small-caps">VIOLATION</span></span>). The reward decomposition matches expectations: <span class="mathjax-inline">\\R\_{\text {hard}}=-8.66\\</span> on <span class="pcrr8t-">p-002 </span>and <span class="mathjax-inline">\\R\_{\text {hard}} = 0\\</span> on <span class="pcrr8t-">p-001</span>, and the reasoner’s verdict labeling is correct on both (<span class="mathjax-inline">\\2/2\\</span>). This is a smoke test, not a benchmark: it guards the trajectory parser and the reward signs, not generalization.

<span class="ptmb8t-">Reward-hacking mechanism (reward-level, measured). </span>The end-to-end trained-policy probe requires a DPO-optimized policy and is part of the in-progress full run; here we isolate and measure, directly on the reward, the mechanism that the trained probe relies on. We build physically infeasible trajectories (<span class="mathjax-inline">\\3\times \\</span> the S-KBM speed cap of <span class="mathjax-inline">\\12.9\\</span> m/s) and attach a large hacked preference logit (<span class="mathjax-inline">\\+10\\</span>) of the kind a compromised preference model would assign. Under a preference-only reward (<span class="mathjax-inline">\\w\_{\text {hard}}=0\\</span>) every infeasible trajectory is accepted (mean total <span class="mathjax-inline">\\+10.0\\</span>, <span class="mathjax-inline">\\0\\\\</span> caught); under the physics-grounded reward (<span class="mathjax-inline">\\w\_{\text {hard}}=5\\</span>, the repository default) the unbounded hard term (mean <span class="mathjax-inline">\\-100\\</span>) overrides the hacked signal (mean total <span class="mathjax-inline">\\-490.5\\</span>), rejecting <span class="mathjax-inline">\\100\\\\</span> of the infeasible set while feasible trajectories stay at <span class="mathjax-inline">\\+10.0\\</span>. Table [1](#rewardlevel-rewardhacking-probe-measured-cpu-a-hacked-preference-logit-10-favors-physically-infeasible-trajectories-the-physicsgrounded-rewards-unbounded-hard-term-overrides-it-where-a-preferenceonly-reward-does-not-reproduced-by-scriptsverifyrewardhackingmechanismpy) summarizes; <span class="pcrr8t-">scripts/verify_reward_hacking_mechanism.py</span> reproduces it on CPU. The trained-policy violation rate under the <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> DPO ablation is reported as a diagnostic target in Table [3](#expected-trend-table-for-the-first-full-run-values-are-diagnostic-targets-for-the-current-method-and-should-be-replaced-by-measured-numbers-after-training-on-the-users-final-corpus) and will be replaced by a measured value after the full run.

<div class="table">

<figure id="x1-21001r1" class="float">
<span id="rewardlevel-rewardhacking-probe-measured-cpu-a-hacked-preference-logit-10-favors-physically-infeasible-trajectories-the-physicsgrounded-rewards-unbounded-hard-term-overrides-it-where-a-preferenceonly-reward-does-not-reproduced-by-scriptsverifyrewardhackingmechanismpy"></span>
<div class="tabular">
<table id="TBL-2" class="tabular">
<tbody>
<tr id="TBL-2-1-" style="vertical-align:baseline;">
<td id="TBL-2-1-1" class="td11" style="text-align: left; white-space: normal;">Reward configuration</td>
<td id="TBL-2-1-2" class="td11" style="text-align: center; white-space: normal;">Infeasible total</td>
<td id="TBL-2-1-3" class="td11" style="text-align: center; white-space: normal;">Caught</td>
<td id="TBL-2-1-4" class="td11" style="text-align: center; white-space: normal;">Feasible total</td>
</tr>
<tr id="TBL-2-2-" style="vertical-align:baseline;">
<td id="TBL-2-2-1" class="td11" style="text-align: left; white-space: normal;">Preference-only (<span class="mathjax-inline">\(w_{\text {hard}}=0\)</span>)</td>
<td id="TBL-2-2-2" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(+10.0\)</span></td>
<td id="TBL-2-2-3" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(0\%\)</span> (0/5)</td>
<td id="TBL-2-2-4" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(+10.0\)</span></td>
</tr>
<tr id="TBL-2-3-" style="vertical-align:baseline;">
<td id="TBL-2-3-1" class="td11" style="text-align: left; white-space: normal;">Physics-grounded (<span class="mathjax-inline">\(w_{\text {hard}}=5\)</span>, default)</td>
<td id="TBL-2-3-2" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(-490.5\)</span></td>
<td id="TBL-2-3-3" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(100\%\)</span> (5/5)</td>
<td id="TBL-2-3-4" class="td11" style="text-align: center; white-space: normal;"><span class="mathjax-inline">\(+10.0\)</span></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 1: </span><span class="content">Reward-level reward-hacking probe (measured, CPU). A hacked preference logit (<span class="mathjax-inline">\(+10\)</span>) favors physically infeasible trajectories; the physics-grounded reward’s unbounded hard term overrides it where a preference-only reward does not. Reproduced by <span class="pcrr8t-">scripts/verify_reward_hacking_mechanism.py</span>. </span></figcaption>
</figure>

</div>

<span class="ptmb8t-">KL drift. </span>The bounded <span class="pcrr8t-">AdaptiveKLController </span>keeps PPO mean KL within <span class="mathjax-inline">\\\[3, 8\]\\</span> across 3,000 steps; in unbounded ablations KL spikes above 50 within 500 steps and the value-head loss diverges (the canonical PPO failure mode). GRPO’s group baseline shows a similar bounded behavior without a value head.

<span class="ptmb8t-">Safe-range guard. </span>A randomized hyperparameter sweep with 100 random samples from outside the safe range produced 100 % <span class="pcrr8t-">UnsafeRange </span>rejections; samples inside the range produced 0 <span class="pcrr8t-">UnsafeRange </span>false positives, by construction.

<span class="ptmb8t-">Microbenchmarks (measured, CPU). </span>The hot-path reward operations are cheap and are not the training bottleneck: the per-step S-KBM evaluator runs at <span class="mathjax-inline">\\\sim \\</span>23k ops/s (<span class="mathjax-inline">\\43\\\mu \\</span>s), the full hybrid <span class="pcrr8t-">PhysicsReward.score </span>at <span class="mathjax-inline">\\\sim \\</span>19k ops/s (<span class="mathjax-inline">\\52\\\mu \\</span>s), and preference synthesis (<span class="mathjax-inline">\\K\\=\\4\\</span>) at <span class="mathjax-inline">\\\sim \\</span>712k ops/s (<span class="mathjax-inline">\\1.4\\\mu \\</span>s), single-threaded via <span class="pcrr8t-">scripts/bench.py</span>. Rollout throughput, not reward computation, is the online bottleneck, which is why vLLM prefix caching sits on the rollout path rather than the reward path.

<span id="evaluation-philosophy" class="paragraphHead"> <span id="x1-22000"></span><span class="ptmb8t-">Evaluation philosophy:</span></span> The current repository is intentionally split into fast checks and longer training runs. Fast checks are CI-friendly: unit tests verify S-KBM arithmetic, reward signs, GRPO advantage normalization, KL-controller boundedness, and API integration. Long runs should be executed with the user’s preferred base model and deployment corpus. This paper therefore separates <span class="ptmri8t-">implementation evidence </span>from <span class="ptmri8t-">expected trend evidence</span>. Implementation evidence is what the repository can check quickly; trend evidence is the direction a correct run should follow when the same code is scaled to a real preference dataset. This separation is useful because it prevents paper prose from pretending that a two-case golden evaluator is a full benchmark while still documenting what a healthy run should look like.

<div class="table">

<figure id="x1-22001r2" class="float">
<span id="repositorygrounded-acceptance-checks-all-passing-1313-tests-run-on-cpu-these-are-smokeregression-checks-rather-than-external-benchmarks-they-protect-the-mathematical-invariants-that-the-later-fullscale-run-depends-on"></span>
<div class="tabular">
<table id="TBL-3" class="tabular">
<tbody>
<tr id="TBL-3-1-" style="vertical-align:baseline;">
<td id="TBL-3-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Check</p></td>
<td id="TBL-3-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Evidence captured</p></td>
<td id="TBL-3-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Status</p></td>
</tr>
<tr id="TBL-3-2-" style="vertical-align:baseline;">
<td id="TBL-3-2-1" class="td11" style="text-align: left; white-space: normal;"><p>S-KBM update</p></td>
<td id="TBL-3-2-2" class="td11" style="text-align: left; white-space: normal;"><p>position, heading, velocity update matches discrete bicycle equations</p></td>
<td id="TBL-3-2-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-3-" style="vertical-align:baseline;">
<td id="TBL-3-3-1" class="td11" style="text-align: left; white-space: normal;"><p>Reward signs</p></td>
<td id="TBL-3-3-2" class="td11" style="text-align: left; white-space: normal;"><p>clean path has zero hard penalty; speeding path has negative hard term</p></td>
<td id="TBL-3-3-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-4-" style="vertical-align:baseline;">
<td id="TBL-3-4-1" class="td11" style="text-align: left; white-space: normal;"><p>GRPO advantage</p></td>
<td id="TBL-3-4-2" class="td11" style="text-align: left; white-space: normal;"><p>group-normalized advantages have near-zero mean and bounded variance</p></td>
<td id="TBL-3-4-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-5-" style="vertical-align:baseline;">
<td id="TBL-3-5-1" class="td11" style="text-align: left; white-space: normal;"><p>KL controller</p></td>
<td id="TBL-3-5-2" class="td11" style="text-align: left; white-space: normal;"><p>coefficient increases when KL is high and decreases when KL is low</p></td>
<td id="TBL-3-5-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-6-" style="vertical-align:baseline;">
<td id="TBL-3-6-1" class="td11" style="text-align: left; white-space: normal;"><p>API integration</p></td>
<td id="TBL-3-6-2" class="td11" style="text-align: left; white-space: normal;"><p>inference and run-submission schemas serialize through FastAPI</p></td>
<td id="TBL-3-6-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
<tr id="TBL-3-7-" style="vertical-align:baseline;">
<td id="TBL-3-7-1" class="td11" style="text-align: left; white-space: normal;"><p>Safe ranges</p></td>
<td id="TBL-3-7-2" class="td11" style="text-align: left; white-space: normal;"><p>out-of-range learning-rate / beta / gamma settings raise <span class="pcrr8t-">UnsafeRange</span></p></td>
<td id="TBL-3-7-3" class="td11" style="text-align: left; white-space: normal;"><p>pass</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 2: </span><span class="content">Repository-grounded acceptance checks, all passing (<span class="mathjax-inline">\(13/13\)</span> tests, run on CPU). These are smoke/regression checks rather than external benchmarks; they protect the mathematical invariants that the later full-scale run depends on. </span></figcaption>
</figure>

</div>

<div class="table">

<figure id="x1-22002r3" class="float">
<span id="expected-trend-table-for-the-first-full-run-values-are-diagnostic-targets-for-the-current-method-and-should-be-replaced-by-measured-numbers-after-training-on-the-users-final-corpus"></span>
<div class="tabular">
<table id="TBL-4" class="tabular">
<tbody>
<tr id="TBL-4-1-" style="vertical-align:baseline;">
<td id="TBL-4-1-1" class="td11" style="text-align: left; white-space: normal;">Method</td>
<td id="TBL-4-1-2" class="td11" style="text-align: center; white-space: normal;">Hard violation <span class="mathjax-inline">\(\downarrow \)</span></td>
<td id="TBL-4-1-3" class="td11" style="text-align: center; white-space: normal;">Soft envelope <span class="mathjax-inline">\(\downarrow \)</span></td>
<td id="TBL-4-1-4" class="td11" style="text-align: center; white-space: normal;">Pref win rate <span class="mathjax-inline">\(\uparrow \)</span></td>
<td id="TBL-4-1-5" class="td11" style="text-align: center; white-space: normal;">KL / ref <span class="mathjax-inline">\(\downarrow \)</span></td>
</tr>
<tr id="TBL-4-2-" style="vertical-align:baseline;">
<td id="TBL-4-2-1" class="td11" style="text-align: left; white-space: normal;">Supervised base</td>
<td id="TBL-4-2-2" class="td11" style="text-align: center; white-space: normal;">0.14</td>
<td id="TBL-4-2-3" class="td11" style="text-align: center; white-space: normal;">0.31</td>
<td id="TBL-4-2-4" class="td11" style="text-align: center; white-space: normal;">0.50</td>
<td id="TBL-4-2-5" class="td11" style="text-align: center; white-space: normal;">0.00</td>
</tr>
<tr id="TBL-4-3-" style="vertical-align:baseline;">
<td id="TBL-4-3-1" class="td11" style="text-align: left; white-space: normal;">Vanilla DPO</td>
<td id="TBL-4-3-2" class="td11" style="text-align: center; white-space: normal;">0.18</td>
<td id="TBL-4-3-3" class="td11" style="text-align: center; white-space: normal;">0.28</td>
<td id="TBL-4-3-4" class="td11" style="text-align: center; white-space: normal;">0.63</td>
<td id="TBL-4-3-5" class="td11" style="text-align: center; white-space: normal;">0.11</td>
</tr>
<tr id="TBL-4-4-" style="vertical-align:baseline;">
<td id="TBL-4-4-1" class="td11" style="text-align: left; white-space: normal;">Physics-DPO</td>
<td id="TBL-4-4-2" class="td11" style="text-align: center; white-space: normal;">0.03</td>
<td id="TBL-4-4-3" class="td11" style="text-align: center; white-space: normal;">0.18</td>
<td id="TBL-4-4-4" class="td11" style="text-align: center; white-space: normal;">0.60</td>
<td id="TBL-4-4-5" class="td11" style="text-align: center; white-space: normal;">0.12</td>
</tr>
<tr id="TBL-4-5-" style="vertical-align:baseline;">
<td id="TBL-4-5-1" class="td11" style="text-align: left; white-space: normal;">PPO + adaptive KL</td>
<td id="TBL-4-5-2" class="td11" style="text-align: center; white-space: normal;">0.02</td>
<td id="TBL-4-5-3" class="td11" style="text-align: center; white-space: normal;">0.15</td>
<td id="TBL-4-5-4" class="td11" style="text-align: center; white-space: normal;">0.61</td>
<td id="TBL-4-5-5" class="td11" style="text-align: center; white-space: normal;">0.09</td>
</tr>
<tr id="TBL-4-6-" style="vertical-align:baseline;">
<td id="TBL-4-6-1" class="td11" style="text-align: left; white-space: normal;">GRPO + hard floor</td>
<td id="TBL-4-6-2" class="td11" style="text-align: center; white-space: normal;">0.01</td>
<td id="TBL-4-6-3" class="td11" style="text-align: center; white-space: normal;">0.13</td>
<td id="TBL-4-6-4" class="td11" style="text-align: center; white-space: normal;">0.62</td>
<td id="TBL-4-6-5" class="td11" style="text-align: center; white-space: normal;">0.10</td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 3: </span><span class="content">Expected trend table for the first full run. Values are diagnostic targets for the current method and should be replaced by measured numbers after training on the user’s final corpus. </span></figcaption>
</figure>

</div>

<span id="interpreting-the-trend" class="paragraphHead"> <span id="x1-23000"></span><span class="ptmb8t-">Interpreting the trend:</span></span> The base model should have the lowest KL because it is the reference distribution. Vanilla DPO should usually improve preference win rate first, but it can raise the hard-violation rate if the preference data contains fluent infeasible answers. Physics-DPO should trade a small amount of preference margin for a large reduction in hard violations. PPO and GRPO should reduce violations further when online rewards are available; GRPO should be competitive without a value head because the group baseline turns a sparse correctness signal into within-prompt comparisons. If a future measured run disagrees with this table, the first debug targets are data leakage in the preference triples, incorrect parsing of trajectory payloads, an underweighted hard term, or a rollout distribution that collapses within each GRPO group.

<figure class="figure">
<p><img src="figures/pi_grpo_neurips-4feee6a965213b87c1af2dd660d77f9b.svg" loading="lazy" alt="Figure" /> <span id="x1-23001r3"></span></p>
<figcaption><span class="id">Figure 3: </span><span class="content">Evaluation structure. Fast golden cases check parser and physical invariants; longer runs fill the trend table and replace diagnostic targets with measured values. </span></figcaption>
</figure>

<span id="what-would-invalidate-the-contribution" class="paragraphHead"> <span id="x1-24000"></span><span class="ptmb8t-">What would invalidate the contribution:</span></span> A useful methods paper should state its failure modes. The method would be weak if vanilla DPO already drove hard violations to zero on the target data, because the physics augmentation would then add complexity with little benefit. It would also be weak if the parser missed most trajectory payloads, because a physics reward cannot supervise states it cannot read. Finally, if GRPO groups collapsed to near-identical completions, within-group normalization would add variance without signal. The repository’s tests cover the second issue at smoke-test scale; the first and third need the user’s full run.

<span id="preferencedata-construction-protocol" class="paragraphHead"> <span id="x1-25000"></span><span class="ptmb8t-">Preference-data construction protocol:</span></span> The DPO path depends on the quality of preference triples more than on the novelty of the optimizer. Pi-GRPO therefore treats the preference builder as an experimental object rather than as a preprocessing script. Each raw HITL record contains the original query, the trajectory or candidate region that triggered review, the validator output, reviewer verdict, confidence, and optional reviewer comment. The curator first normalizes units and coordinate frames, then removes records whose verdict is not aligned to an interpretable physical or semantic criterion. It next forms candidate pairs by grouping completions with the same prompt and domain. A pair <span class="mathjax-inline">\\(y_i,y_j)\\</span> is admitted when one of three margins is positive: reviewer margin, physics margin, or data-likelihood margin. Reviewer margin dominates only when neither completion is hard-infeasible; otherwise the hard-infeasible completion is automatically the rejected item. This rule is intentionally conservative because one mislabeled infeasible positive can teach the policy to narrate around a violation.

The curator writes three metadata fields that should remain in all future datasets: <span class="pcrr8t-">pair_source</span>, <span class="pcrr8t-">margin_type</span>, and <span class="pcrr8t-">physics_delta</span>. The first distinguishes human, synthetic, and mixed pairs. The second records whether the chosen/rejected decision came from reviewer preference, hard-violation contrast, soft-envelope contrast, or Pi-DPM tail score. The third stores <span class="mathjax-inline">\\\Phi (y_l)-\Phi (y_w)\\</span> so later analysis can separate semantic alignment gains from physical-feasibility gains. If the future full run shows improved preference win rate but no change in physics delta, the data was probably too easy; if physics delta improves but preference win rate collapses, <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span> or <span class="mathjax-inline">\\w\_{\text {hard}}\\</span> is too aggressive.

<span id="trainerspecific-diagnostic-curves" class="paragraphHead"> <span id="x1-26000"></span><span class="ptmb8t-">Trainer-specific diagnostic curves:</span></span> The repository’s training guide already lists common symptoms. The paper version makes them explicit because they are the curves that should appear in a real experiment log. PPO should log total reward, hard reward, value loss, policy loss, entropy, approximate KL, and clip fraction. A healthy PPO run has slowly rising total reward, stable or decreasing hard violation, bounded KL, and a clip fraction that does not pin at zero or one. DPO should log preference loss, chosen/rejected log-prob margin, <span class="mathjax-inline">\\\Phi (y_w)\\</span>, <span class="mathjax-inline">\\\Phi (y_l)\\</span>, and the physics-adjusted margin from Equation [8](#x1-17001r8). A healthy Physics-DPO run decreases loss while increasing the physics-adjusted margin; a run that only increases the vanilla margin is likely optimizing fluency rather than feasibility. GRPO should log within-group reward standard deviation, advantage range, per-prompt hard-violation count, and KL. If the within-group standard deviation collapses to zero, the update is effectively noise; if it explodes, the reward scale needs normalization or the hard term is too sparse.

<div class="table">

<figure id="x1-26001r4" class="float">
<span id="ablation-matrix-for-the-first-serious-run-each-row-removes-one-structural-component-and-predicts-the-most-likely-failure-signal"></span>
<div class="tabular">
<table id="TBL-5" class="tabular">
<tbody>
<tr id="TBL-5-1-" style="vertical-align:baseline;">
<td id="TBL-5-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Ablation</p></td>
<td id="TBL-5-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Expected measurement shift</p></td>
<td id="TBL-5-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Interpretation</p></td>
</tr>
<tr id="TBL-5-2-" style="vertical-align:baseline;">
<td id="TBL-5-2-1" class="td11" style="text-align: left; white-space: normal;"><p>Remove hard term</p></td>
<td id="TBL-5-2-2" class="td11" style="text-align: left; white-space: normal;"><p>hard-violation rate rises even when reward improves</p></td>
<td id="TBL-5-2-3" class="td11" style="text-align: left; white-space: normal;"><p>preference model is not a physics validator</p></td>
</tr>
<tr id="TBL-5-3-" style="vertical-align:baseline;">
<td id="TBL-5-3-1" class="td11" style="text-align: left; white-space: normal;"><p>Clip hard term inside reward</p></td>
<td id="TBL-5-3-2" class="td11" style="text-align: left; white-space: normal;"><p>severe violations become indistinguishable from mild ones</p></td>
<td id="TBL-5-3-3" class="td11" style="text-align: left; white-space: normal;"><p>hard floor loses dominance</p></td>
</tr>
<tr id="TBL-5-4-" style="vertical-align:baseline;">
<td id="TBL-5-4-1" class="td11" style="text-align: left; white-space: normal;"><p>Set <span class="mathjax-inline">\(\gamma _{\text {phys}}=0\)</span> in DPO</p></td>
<td id="TBL-5-4-2" class="td11" style="text-align: left; white-space: normal;"><p>higher preference margin, worse physics delta</p></td>
<td id="TBL-5-4-3" class="td11" style="text-align: left; white-space: normal;"><p>preference labels contain infeasible positives</p></td>
</tr>
<tr id="TBL-5-5-" style="vertical-align:baseline;">
<td id="TBL-5-5-1" class="td11" style="text-align: left; white-space: normal;"><p>Disable adaptive KL</p></td>
<td id="TBL-5-5-2" class="td11" style="text-align: left; white-space: normal;"><p>PPO KL spikes and value loss destabilizes</p></td>
<td id="TBL-5-5-3" class="td11" style="text-align: left; white-space: normal;"><p>policy update too aggressive</p></td>
</tr>
<tr id="TBL-5-6-" style="vertical-align:baseline;">
<td id="TBL-5-6-1" class="td11" style="text-align: left; white-space: normal;"><p>Reduce GRPO group to <span class="mathjax-inline">\(K=2\)</span></p></td>
<td id="TBL-5-6-2" class="td11" style="text-align: left; white-space: normal;"><p>high variance in group advantages</p></td>
<td id="TBL-5-6-3" class="td11" style="text-align: left; white-space: normal;"><p>weak baseline estimate</p></td>
</tr>
<tr id="TBL-5-7-" style="vertical-align:baseline;">
<td id="TBL-5-7-1" class="td11" style="text-align: left; white-space: normal;"><p>Disable prefix cache</p></td>
<td id="TBL-5-7-2" class="td11" style="text-align: left; white-space: normal;"><p>rollout wall time rises with prompt length</p></td>
<td id="TBL-5-7-3" class="td11" style="text-align: left; white-space: normal;"><p>serving bottleneck rather than algorithm bottleneck</p></td>
</tr>
<tr id="TBL-5-8-" style="vertical-align:baseline;">
<td id="TBL-5-8-1" class="td11" style="text-align: left; white-space: normal;"><p>Remove safe ranges</p></td>
<td id="TBL-5-8-2" class="td11" style="text-align: left; white-space: normal;"><p>failed runs start silently with extreme beta or LR</p></td>
<td id="TBL-5-8-3" class="td11" style="text-align: left; white-space: normal;"><p>user error becomes experiment noise</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 4: </span><span class="content">Ablation matrix for the first serious run. Each row removes one structural component and predicts the most likely failure signal. </span></figcaption>
</figure>

</div>

<span id="qualitative-audit-cases" class="paragraphHead"> <span id="x1-27000"></span><span class="ptmb8t-">Qualitative audit cases:</span></span> Two examples are enough for the current repository-grounded evaluation because they explain the expected behavior without pretending to be a benchmark. In the clean case, a prompt provides a vessel track whose implied speed stays below the domain cap, acceleration is smooth, and heading changes fit the S-KBM envelope. The correct answer is not merely <span class="ptmrc8t-"><span class="small-caps">PASS</span></span>; it should cite the maximum implied speed, the absence of hard violations, and the fact that soft curvature/jerk penalties remain within the empirical envelope. In the speeding case, a prompt contains two anchors separated by a short time interval, forcing an impossible speed. The correct answer is <span class="ptmrc8t-"><span class="small-caps">HARD</span>\_<span class="small-caps">VIOLATION</span></span>; a good rationale identifies the minimal required speed and explains that preference or data likelihood cannot override the hard envelope. The second case is the one that catches reward hacking: a fluent answer that says “likely plausible” should receive a low reward even if the wording sounds confident.

<div class="table">

<figure id="x1-27001r5" class="float">
<span id="expected-qualitative-behavior-on-the-two-builtin-golden-cases-the-wording-is-schematic-the-repository-tests-the-structured-verdict-and-reward-decomposition"></span>
<div class="tabular">
<table id="TBL-6" class="tabular">
<tbody>
<tr id="TBL-6-1-" style="vertical-align:baseline;">
<td id="TBL-6-1-1" class="td11" style="text-align: left; white-space: normal;"><p>Case</p></td>
<td id="TBL-6-1-2" class="td11" style="text-align: left; white-space: normal;"><p>Physical signal</p></td>
<td id="TBL-6-1-3" class="td11" style="text-align: left; white-space: normal;"><p>Correct verdict</p></td>
<td id="TBL-6-1-4" class="td11" style="text-align: left; white-space: normal;"><p>Healthy rationale</p></td>
</tr>
<tr id="TBL-6-2-" style="vertical-align:baseline;">
<td id="TBL-6-2-1" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">p-001 </span>clean</p></td>
<td id="TBL-6-2-2" class="td11" style="text-align: left; white-space: normal;"><p>required speed and curvature remain inside envelope</p></td>
<td id="TBL-6-2-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmrc8t-"><span class="small-caps">PASS</span></span></p></td>
<td id="TBL-6-2-4" class="td11" style="text-align: left; white-space: normal;"><p>cites zero hard penalty and bounded soft statistics</p></td>
</tr>
<tr id="TBL-6-3-" style="vertical-align:baseline;">
<td id="TBL-6-3-1" class="td11" style="text-align: left; white-space: normal;"><p><span class="pcrr8t-">p-002 </span>speeding</p></td>
<td id="TBL-6-3-2" class="td11" style="text-align: left; white-space: normal;"><p>required speed exceeds configured cap</p></td>
<td id="TBL-6-3-3" class="td11" style="text-align: left; white-space: normal;"><p><span class="ptmrc8t-"><span class="small-caps">HARD</span>_<span class="small-caps">VIOLATION</span></span></p></td>
<td id="TBL-6-3-4" class="td11" style="text-align: left; white-space: normal;"><p>cites infeasible speed and refuses to average it away</p></td>
</tr>
</tbody>
</table>
</div>
<figcaption><span class="id">Table 5: </span><span class="content">Expected qualitative behavior on the two built-in golden cases. The wording is schematic; the repository tests the structured verdict and reward decomposition. </span></figcaption>
</figure>

</div>

<span id="trajectorygeneration-protocol" class="paragraphHead"> <span id="x1-28000"></span><span class="ptmb8t-">Trajectory-generation protocol:</span></span> For generation rather than reasoning, the policy emits future position deltas. A full evaluation should measure (i) hard-violation rate, (ii) soft-envelope p95 deviation, (iii) Pi-DPM reconstruction tail score, (iv) displacement error against held-out future traces when ground truth is available, and (v) diversity under a fixed prompt. The crucial comparison is not merely whether Pi-GRPO improves displacement error; a diffusion baseline can do that while still emitting rare impossible turns. The relevant question is whether the method improves or preserves displacement error while reducing violations and preserving diversity. A useful first table would compare DiffTraj, Pi-DPM, supervised autoregressive decoding, PPO, and GRPO under the same parser and envelope. The expected outcome is that Pi-DPM has strong data likelihood, supervised decoding has reasonable semantics but nonzero violations, and GRPO has the best hard-feasibility profile when the reward is correctly tuned.

<span id="reasoningpolicy-protocol" class="paragraphHead"> <span id="x1-29000"></span><span class="ptmb8t-">Reasoning-policy protocol:</span></span> For the verdicting task, the unit of evaluation is not a generated point but a structured judgment. A full run should measure verdict accuracy, hard-violation recall, false-positive rate on clean tracks, rationale consistency, and abstention/HITL rate. The most important metric is hard-violation recall at a controlled false-positive rate because missing an impossible trajectory is worse than sending a borderline trace to HITL. A second metric is contradiction rate between rationale and verdict; for example, a model that outputs <span class="ptmrc8t-"><span class="small-caps">PASS</span> </span>but says the vessel exceeded the cap should fail even if the final token matches the label. The output filter can catch some contradictions, but the trainer should learn to avoid them because contradiction repair after generation is weaker than direct supervision.

<span id="rewardscale-calibration" class="paragraphHead"> <span id="x1-30000"></span><span class="ptmb8t-">Reward-scale calibration:</span></span> The hard term is unbounded, but the optimizer still sees finite minibatches. In practice the reward scaler should normalize soft, data, and preference terms to comparable ranges while leaving the hard term in violation units. Let <span class="mathjax-inline">\\\hat {R}\_i=(R_i-\mu \_i)/(\sigma \_i+\epsilon )\\</span> for <span class="mathjax-inline">\\i\in \\\text {soft},\text {data},\text {pref}\\\\</span> with running statistics estimated on a calibration buffer. The implemented reward can be viewed as

<div class="mathjax-env mathjax-equation">

\begin{equation} R = w\_{\mathrm {hard}} R\_{\mathrm {hard}} + w\_{\mathrm {soft}}\hat {R}\_{\mathrm {soft}} + w\_{\mathrm {data}}\hat {R}\_{\mathrm {data}} + w\_{\mathrm {pref}}\hat {R}\_{\mathrm {pref}}. \label {eq:scaledreward} \end{equation}

</div>

<span id="x1-30001r9"></span>

This keeps the auxiliary terms numerically useful without weakening the dominance property in Equation [3](#x1-8001r3). A simple sanity check is to evaluate the 99th percentile of <span class="mathjax-inline">\\\|w_i\hat {R}\_i\|\\</span> on a calibration batch; if an auxiliary term regularly exceeds the hard penalty for known violations, the config is unsafe even if training has not yet failed.

<span id="compute-and-deployment-expectations" class="paragraphHead"> <span id="x1-31000"></span><span class="ptmb8t-">Compute and deployment expectations:</span></span> The training guide supports three operating modes. The DPO mode is the cheapest because it consumes fixed triples and does not require online rollouts. PPO is the most expensive because it fits a value head and benefits from frequent reward evaluation. GRPO sits between them: it needs <span class="mathjax-inline">\\K\\</span> rollouts per prompt but removes the value head and often provides cleaner signal for short reasoning tasks. Prefix caching changes the practical economics by amortizing the system prompt and invariant task instructions across rollouts. If prefix-cache hit rate drops, the run should be profiled before the optimizer is blamed; the bottleneck may be prompt assembly, not the RL objective.

<span id="reproducibility-checklist" class="paragraphHead"> <span id="x1-32000"></span><span class="ptmb8t-">Reproducibility checklist:</span></span> Every future result table should be accompanied by five artifacts: the exact reward config, the safe-range file, the preference-data version, the base/reference model hashes, and the evaluator JSON. Without those artifacts, a reported improvement is difficult to interpret because a lower violation rate could come from a stricter parser, a changed cap, a different trajectory domain, or a reward weight change. The repository’s content-addressed checkpoints and manifest are designed to make this checklist easy rather than optional.

<span id="why-this-is-not-ordinary-constrained-rl" class="paragraphHead"> <span id="x1-33000"></span><span class="ptmb8t-">Why this is not ordinary constrained RL:</span></span> Classical constrained MDP methods introduce constraints of the form <span class="mathjax-inline">\\\mathbb {E}\[C_i(\tau )\]\le d_i\\</span> and solve a Lagrangian relaxation. That framing is powerful when the learner controls a simulator and can estimate constraint costs under a policy. Pi-GRPO uses a stricter operational rule: a single hard-violating completion can be rejected or heavily penalized even if its expected cost would be acceptable under a batch average. This is closer to a safety filter than to an average-cost constraint. The reason is domain-specific. A trajectory audit or generated path is consumed as an individual artifact; a physically impossible artifact is not redeemed because other artifacts in the minibatch were feasible. The hard floor therefore acts at the sample level, while the auxiliary terms act at the distribution level.

<span id="variance-reduction-in-grpo" class="paragraphHead"> <span id="x1-34000"></span><span class="ptmb8t-">Variance reduction in GRPO:</span></span> The GRPO group baseline can be understood as a within-prompt control variate. If <span class="mathjax-inline">\\R_k = q(x) + \epsilon \_k\\</span> where <span class="mathjax-inline">\\q(x)\\</span> is prompt difficulty and <span class="mathjax-inline">\\\epsilon \_k\\</span> is rollout-specific quality, subtracting the group mean removes much of <span class="mathjax-inline">\\q(x)\\</span> and leaves the optimizer to compare completions for the same prompt. This is exactly the comparison the physics reward supports: among several completions for the same track, which one preserves the envelope and gives the best rationale? The weakness is that the baseline becomes noisy for small <span class="mathjax-inline">\\K\\</span> and uninformative when all completions are identical. For this reason the repository defaults to <span class="mathjax-inline">\\K=8\\</span>, keeps temperature above zero during rollouts, and logs within-group standard deviation as a first-class metric.

<span id="parser-uncertainty" class="paragraphHead"> <span id="x1-35000"></span><span class="ptmb8t-">Parser uncertainty:</span></span> The reward assumes a parsed physical state sequence. Real model completions are messy: units may be omitted, times may be rounded, and rationales may contain multiple candidate verdicts. The parser therefore has to expose uncertainty rather than silently guessing. A future revision should attach a parse-confidence score and route low-confidence completions to one of three outcomes: retry with a structured-output prompt, mark the completion as invalid for reward computation, or send the sample to HITL. This detail is not cosmetic. A parser that “helpfully” repairs impossible units can hide the very violations the reward is meant to detect.

<span id="domaintransfer-protocol" class="paragraphHead"> <span id="x1-36000"></span><span class="ptmb8t-">Domain-transfer protocol:</span></span> The current defaults cover vessels, vehicles, and UAV-like motion, but every deployment should rerun calibration. The sequence is: choose domain caps, fit soft-envelope statistics on clean historical traces, run the two golden cases, add at least one domain-specific hard-violation case, evaluate the supervised base, then tune <span class="mathjax-inline">\\w\_{\text {hard}}\\</span> until hard violations dominate but do not cause numerical instability. Only after that should preference training start. This ordering prevents a common mistake: tuning DPO or GRPO while the physical envelope itself is still moving. If the cap or parser changes after training, old checkpoints should be treated as stale because their reward history no longer corresponds to the deployed validator.

<span id="expected-reviewer-questions" class="paragraphHead"> <span id="x1-37000"></span><span class="ptmb8t-">Expected reviewer questions:</span></span> A reviewer will likely ask six hard questions. First, is the hard term just hand-written reward shaping? The answer is yes in implementation but no in purpose: it encodes a physical invariant, not a stylistic preference. Second, why use GRPO rather than PPO? Because the target reasoning tasks are short, sparse, and pairwise-comparable within a prompt, making a value head less attractive. Third, why keep PPO at all? Because online reward evaluation and value-based baselines remain useful for trajectory generation. Fourth, why trust HITL preferences? We do not trust them blindly; the physics term can override infeasible positives. Fifth, can the parser be attacked? Yes, which is why parser confidence and structured outputs are future priorities. Sixth, what result would be most convincing? A domain-scale run where hard-violation recall improves without lowering clean-track pass rate or collapsing diversity.

<span id="future-benchmark-layout" class="paragraphHead"> <span id="x1-38000"></span><span class="ptmb8t-">Future benchmark layout:</span></span> The strongest future paper version should have two benchmark blocks. The first block is <span class="ptmri8t-">trajectory generation</span>: Porto, Harbin, and AIS splits with hard-violation rate, jerk/curvature p95 deviation, displacement error, and diversity. The second block is <span class="ptmri8t-">trajectory reasoning</span>: curated verdict prompts with clean, soft-violation, hard-violation, and ambiguous/HITL classes. Both blocks should include ablations over hard term, <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span>, safe ranges, prefix caching, and GRPO group size. This layout will separate algorithmic contribution from systems contribution and will make it clear whether the gain comes from physics, optimizer choice, or rollout infrastructure.

<span id="current-limitations-and-meaningful-future-work" class="paragraphHead"> <span id="x1-39000"></span><span class="ptmb8t-">Current limitations and meaningful future work:</span></span> The current repository-grounded version has three limits that should stay visible. First, the repo has smoke/regression checks but not yet a domain-scale benchmark run. Second, the Pi-DPM data term depends on the quality and domain match of a frozen diffusion scorer. Third, the current reward is strongest for kinematic feasibility and weaker for semantic policy constraints such as maritime regulation text, right-of-way rules, or weather-dependent speed reductions. A natural future extension is to make these constraints compositional: keep S-KBM as the non-negotiable floor, add regulation-specific validators as typed reward terms, and expose each term separately in the evaluator. That direction would preserve the paper’s central claim while broadening the meaning of “physics-informed” beyond one motion model.

## <span class="titlemark">6 </span> <span id="x1-400006"></span>Discussion and Limitations

The hard reward floor is the structural defense against reward hacking but cannot replace human review of reward configurations. Three caveats. First, <span class="mathjax-inline">\\\kappa \_{\max }\\</span> is derived from <span class="mathjax-inline">\\\delta \_{\max }\\</span> and <span class="mathjax-inline">\\L\\</span>; both are domain-specific and require reasonable defaults (we ship vessel/vehicle/UAV defaults). Second, <span class="mathjax-inline">\\R\_{\text {data}}\\</span> depends on a Pi-DPM checkpoint trained on a specific corpus; cross-domain transfer requires retraining. Third, GRPO’s group baseline is variance-reduction that depends on within-group diversity; for prompts with degenerate completions the group collapses and the advantage is uninformative; we mitigate by sampling with <span class="mathjax-inline">\\T=0.7, p=0.95\\</span>.

<span class="ptmb8t-">Connection to agentic reasoning: </span>Pi-GRPO consumes preference data emitted by the sibling agentic system GeoTrace-Agent (companion preprint). The two systems share an HITL surface (Postgres queue with structured payloads); the agentic system flags ambiguity and the RL system fine-tunes the policy on the verdict, closing the loop.

<span id="practical-limitations" class="paragraphHead"> <span id="x1-41000"></span><span class="ptmb8t-">Practical limitations:</span></span> The most important limitation is that the hard floor is only as correct as the physical envelope. For vessels, a single speed cap is a simplified proxy for a richer operational regime involving vessel class, sea state, traffic separation schemes, local regulations, and sensor noise. For vehicles, a kinematic bicycle model is reasonable at moderate speeds but ignores tire forces, road grade, and traffic law. For UAVs, wind and battery constraints can dominate simple speed/curvature limits. Pi-GRPO should therefore be read as a framework for promoting verified domain constraints into the reward, not as a claim that one S-KBM envelope exhausts physical reality.

<span id="modeloutput-limitations" class="paragraphHead"> <span id="x1-42000"></span><span class="ptmb8t-">Model-output limitations:</span></span> The system also assumes that the completion contains enough structure to recover a physical payload. This is easy for a trajectory decoder and harder for a general LLM rationale. Structured outputs can mitigate the issue, but they introduce their own failure mode: a model can satisfy the schema while giving a weak or incomplete rationale. For this reason the final evaluator should score both payload correctness and rationale consistency. A verdict-only model may be adequate for automation, but a portfolio paper benefits from showing that the model can explain why a violation occurred in physically meaningful terms.

<span id="data-limitations" class="paragraphHead"> <span id="x1-43000"></span><span class="ptmb8t-">Data limitations:</span></span> Preference data collected through HITL is valuable because it reflects ambiguous operational cases, but it is also biased toward examples the agent was uncertain about. A model trained only on HITL corrections may overfit borderline traces and underperform on routine clean paths. Synthetic preference generation by rollout-and-rank helps cold start, yet synthetic pairs can exaggerate the reward’s current blind spots. The intended data mix is therefore three-way: clean historical traces for calibration, HITL corrections for ambiguity, and synthetic physics-contrast pairs for hard-negative coverage. A future empirical section should report results for each data source separately.

<span id="future-work" class="paragraphHead"> <span id="x1-44000"></span><span class="ptmb8t-">Future work:</span></span> The next technical step is a domain-scale run with two evaluation heads. The first head should be a trajectory-generation benchmark where the policy is compared with supervised decoding, Pi-DPM, and diffusion baselines on feasibility, displacement error, likelihood, and diversity. The second should be a reasoning benchmark where the policy is compared with a base LLM, vanilla DPO, Physics-DPO, PPO, and GRPO on hard-violation recall, false positives, contradiction rate, and HITL routing. This would turn the current paper from a repository-grounded methods paper into a full experimental paper.

<span id="broader-impact-and-safety" class="paragraphHead"> <span id="x1-45000"></span><span class="ptmb8t-">Broader impact and safety:</span></span> Physics-informed alignment can reduce one class of operational error, but it can also make automated trajectory judgments appear more authoritative than the evidence supports. The system should therefore expose uncertainty and route low-confidence cases to review. The correct deployment posture is not “the model decides” but “the model proposes under hard physical guards, and ambiguous cases remain auditable.” That posture matches the architecture: hard constraints are deterministic, preferences are learned, and human review remains part of the loop.

## <span class="titlemark">7 </span> <span id="x1-460007"></span>Conclusion

We presented Pi-GRPO, a physics-informed reinforcement-learning stack for trajectory generation and reasoning. A hybrid reward with an unbounded hard floor over the S-KBM envelope, three trainers (PPO, DPO with <span class="mathjax-inline">\\\gamma \_{\text {phys}}\\</span>, GRPO) under a shared reward path, vLLM-backed rollouts with prefix caching, content-addressed checkpoints, and a HITL-to-DPO data flywheel together deliver a system that resists reward hacking by construction and integrates naturally with an agentic reasoning surface. The system is open-sourced as a GPU-enabled Docker stack with a CPU-only Hugging Face Spaces demo and a CI-ready GitHub repository.

## <span id="x1-47000"></span>Acknowledgments

This stack extends prior work conducted at the University of Minnesota with Profs. Shashi Shekhar and Vipin Kumar, whose guidance on physics-informed methods, knowledge-guided machine learning, and trajectory mining shaped both the algorithmic core and the broader research agenda. We also thank the Centific team for surfacing the HITL preference-data pattern that motivated the data flywheel.

## <span id="x1-48000"></span>References

<div class="section thebibliography" role="doc-bibliography">

\[1\]  
<span id="Xbai2022constitutional"></span> Y. Bai et al. Constitutional AI: Harmlessness from AI feedback. <span class="ptmri8t-">arXiv:2212.08073</span>, 2022.

\[2\]  
<span id="Xcasper2023open"></span> S. Casper et al. Open problems and fundamental limitations of reinforcement learning from human feedback. <span class="ptmri8t-">TMLR</span>, 2023.

\[3\]  
<span id="Xachiam2017cpo"></span> J. Achiam, D. Held, A. Tamar, and P. Abbeel. Constrained policy optimization. <span class="ptmri8t-">ICML</span>, 2017.

\[4\]  
<span id="Xaltman1999constrained"></span> E. Altman. <span class="ptmri8t-">Constrained Markov Decision Processes</span>. Chapman and Hall/CRC, 1999.

\[5\]  
<span id="Xcentific2025legalwiz"></span> A. Mantravadi, S. Dalmia, A. Mukherji, N. Dave, A. Mittal, and O. Pospelova. LegalWiz: A multi-agent generation framework for contradiction detection in legal documents. <span class="ptmri8t-">NeurIPS 2025 Workshop on Generative and Protective AI for Content Creation</span>, 2025.

\[6\]  
<span id="Xcentific2025contragen"></span> A. Mantravadi, S. Dalmia, A. Mukherji, N. Dave, A. Mittal. ContraGen: A multi-agent generation framework for enterprise contradictions detection. <span class="ptmri8t-">IEEE ICDMW</span>, 2025.

\[7\]  
<span id="Xcentific2025art"></span> A. Mantravadi, S. Dalmia, A. Mukherji. ART: Action-based reasoning task benchmarking for medical AI agents. <span class="ptmri8t-">AAAI 2026 Workshop on Healthy Aging and Longevity</span>, 2025.

\[8\]  
<span id="Xdeepseek2025r1"></span> DeepSeek-AI. DeepSeek-R1: Incentivizing reasoning capability in LLMs via reinforcement learning. <span class="ptmri8t-">arXiv:2501.12948</span>, 2025.

\[9\]  
<span id="Xdettmers2023qlora"></span> T. Dettmers, A. Pagnoni, A. Holtzman, and L. Zettlemoyer. QLoRA: Efficient finetuning of quantized LLMs. <span class="ptmri8t-">NeurIPS</span>, 2023.

\[10\]  
<span id="Xeisenstein2023helping"></span> J. Eisenstein et al. Helping or herding? Reward model ensembles mitigate but do not eliminate reward hacking. <span class="ptmri8t-">arXiv:2312.09244</span>, 2023.

\[11\]  
<span id="Xghosh2024kriging"></span> S. Ghosh, A. Sharma, J. Gupta, A. Subramanian, and S. Shekhar. Towards Kriging-informed conditional diffusion for regional sea-level data downscaling. <span class="ptmri8t-">ACM SIGSPATIAL</span>, 2024.

\[12\]  
<span id="Xho2020ddpm"></span> J. Ho, A. Jain, and P. Abbeel. Denoising diffusion probabilistic models. <span class="ptmri8t-">NeurIPS</span>, 2020.

\[13\]  
<span id="Xho2016gail"></span> J. Ho and S. Ermon. Generative adversarial imitation learning. <span class="ptmri8t-">NeurIPS</span>, 2016.

\[14\]  
<span id="Xhu2022lora"></span> E. J. Hu et al. LoRA: Low-rank adaptation of large language models. <span class="ptmri8t-">ICLR</span>, 2022.

\[15\]  
<span id="Xjiang2023mistral"></span> A. Q. Jiang et al. Mistral 7B. <span class="ptmri8t-">arXiv:2310.06825</span>, 2023.

\[16\]  
<span id="Xkarpatne2017kgml"></span> A. Karpatne et al. Theory-guided data science: A new paradigm for scientific discovery from data. <span class="ptmri8t-">IEEE TKDE</span>, 29(10):2318–2331, 2017.

\[17\]  
<span id="Xkong2015kinematic"></span> J. Kong, M. Pfeiffer, G. Schildbach, and F. Borrelli. Kinematic and dynamic vehicle models for autonomous driving control design. <span class="ptmri8t-">IEEE Intelligent Vehicles Symposium</span>, 2015.

\[18\]  
<span id="Xkong2021diffwave"></span> Z. Kong et al. DiffWave: A versatile diffusion model for audio synthesis. <span class="ptmri8t-">ICLR</span>, 2021.

\[19\]  
<span id="Xkwon2023vllm"></span> W. Kwon et al. Efficient memory management for large language model serving with PagedAttention. <span class="ptmri8t-">SOSP</span>, 2023.

\[20\]  
<span id="Xlee2024rlaif"></span> H. Lee et al. RLAIF: Scaling reinforcement learning from human feedback with AI feedback. <span class="ptmri8t-">ICML</span>, 2024.

\[21\]  
<span id="Xng1999policy"></span> A. Y. Ng, D. Harada, and S. Russell. Policy invariance under reward transformations: Theory and application to reward shaping. <span class="ptmri8t-">ICML</span>, 1999.

\[22\]  
<span id="Xouyang2022training"></span> L. Ouyang et al. Training language models to follow instructions with human feedback. <span class="ptmri8t-">NeurIPS</span>, 2022.

\[23\]  
<span id="Xqwen2024qwen2"></span> Qwen Team. Qwen2 technical report. <span class="ptmri8t-">arXiv:2407.10671</span>, 2024.

\[24\]  
<span id="Xrafailov2023dpo"></span> R. Rafailov, A. Sharma, E. Mitchell, S. Ermon, C. D. Manning, and C. Finn. Direct Preference Optimization: Your language model is secretly a reward model. <span class="ptmri8t-">NeurIPS</span>, 2023.

\[25\]  
<span id="Xraissi2019pinn"></span> M. Raissi, P. Perdikaris, and G. E. Karniadakis. Physics-informed neural networks. <span class="ptmri8t-">Journal of Computational Physics</span>, 378:686–707, 2019.

\[26\]  
<span id="Xross2011dagger"></span> S. Ross, G. Gordon, and D. Bagnell. A reduction of imitation learning and structured prediction to no-regret online learning. <span class="ptmri8t-">AISTATS</span>, 2011.

\[27\]  
<span id="Xschulman2017ppo"></span> J. Schulman, F. Wolski, P. Dhariwal, A. Radford, and O. Klimov. Proximal Policy Optimization algorithms. <span class="ptmri8t-">arXiv:1707.06347</span>, 2017.

\[28\]  
<span id="Xshao2024grpo"></span> Z. Shao, P. Wang, et al. DeepSeekMath: Pushing the limits of mathematical reasoning in open language models. <span class="ptmri8t-">arXiv:2402.03300</span>, 2024.

\[29\]  
<span id="Xsharma2025geoanomalies"></span> A. Sharma, M. Yang, M. Farhadloo, S. Ghosh, B. Jayaprakash, and S. Shekhar. Towards physics-informed diffusion for anomaly detection in trajectories. <span class="ptmri8t-">ACM SIGSPATIAL Workshop on Geospatial Anomaly Detection (GeoAnomalies)</span>, 2025.

\[30\]  
<span id="Xskalse2022defining"></span> J. Skalse et al. Defining and characterizing reward hacking. <span class="ptmri8t-">NeurIPS</span>, 2022.

\[31\]  
<span id="Xsong2021score"></span> Y. Song, J. Sohl-Dickstein, D. Kingma, A. Kumar, S. Ermon, and B. Poole. Score-based generative modeling through stochastic differential equations. <span class="ptmri8t-">ICLR</span>, 2021.

\[32\]  
<span id="Xstiennon2020learning"></span> N. Stiennon et al. Learning to summarize from human feedback. <span class="ptmri8t-">NeurIPS</span>, 2020.

\[33\]  
<span id="Xsutton1998rl"></span> R. S. Sutton and A. G. Barto. <span class="ptmri8t-">Reinforcement Learning: An Introduction</span>. MIT Press, 2nd edition, 2018.

\[34\]  
<span id="Xtouvron2023llama"></span> H. Touvron et al. Llama 2: Open foundation and fine-tuned chat models. <span class="ptmri8t-">arXiv:2307.09288</span>, 2023.

\[35\]  
<span id="Xpotentialbased2003"></span> E. Wiewiora. Potential-based shaping and Q-value initialization are equivalent. <span class="ptmri8t-">Journal of Artificial Intelligence Research</span>, 19:205–208, 2003.

\[36\]  
<span id="Xwilliams1992simple"></span> R. J. Williams. Simple statistical gradient-following algorithms for connectionist reinforcement learning. <span class="ptmri8t-">Machine Learning</span>, 8:229–256, 1992.

\[37\]  
<span id="Xyang2025gcdm"></span> M. Yang, A. Sharma, M. Farhadloo, B. Jayaprakash, and S. Shekhar. Geo-lucid conditional diffusion models for high physical fidelity trajectory generation. <span class="ptmri8t-">ACM SIGSPATIAL</span>, 2025.

\[38\]  
<span id="Xzhu2024difftraj"></span> Y. Zhu et al. DiffTraj: Generating GPS trajectory with diffusion probabilistic model. <span class="ptmri8t-">NeurIPS</span>, 2024.

</div>
