// Generated from https://arunshar.github.io/portfolio/ on 2026-05-27.
window.LEGACY_PUBLICATIONS = [
  {
    "id": "pidiff",
    "representative": true,
    "year": "2025",
    "title": "Towards Physics-informed Diffusion for Anomaly Detection in Trajectories: A Summary of Results",
    "titleUrl": "https://doi.org/10.1145/3764914.3770595",
    "authors": "Arun Sharma, Mingzhou Yang, Majid Farhadloo, Subhankar Ghosh, Bharat Jayaprakash and Shashi Shekhar",
    "venue": "Proceedings of the 2nd ACM SIGSPATIAL International Workshop on Geospatial Anomaly Detection (GeoAnomalies '25), pp. 11-24, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/10.1145/3764914.3770595"
      },
      {
        "label": "page",
        "href": "projects/pi-dpm-trajectory-anomaly/"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/pi-grpo"
      }
    ],
    "abstract": "Given a dataset of moving object trajectories, a domain-specific study area, and a user-defined error threshold, we aim to identify anomalous trajectories indicative of possible GPS spoofing (e.g., broadcasting fake signals). The problem is societally important to curb illegal activities such as unauthorized fishing and illicit oil transfers in international waters. The problem is challenging due to advances in AI-generated deep fakes (e.g., additive noise, fake trajectories) and the scarcity of labeled samples for ground-truth verification. Current state-of-the-art methods ignore fine-scale spatiotemporal dependencies and prior physical knowledge, resulting in lower accuracy. In this paper, we propose a physics-informed anomaly detection framework based on an encoder-decoder architecture that incorporates kinematic constraints to identify trajectories that violate physical laws. Experimental results on maritime and urban domains demonstrate that the proposed approach yields higher solution quality and lower estimation error for anomaly detection and trajectory reconstruction tasks, respectively.",
    "bibtex": "@inproceedings{10.1145/3764914.3770595,\n    author    = {Sharma, Arun and Yang, Mingzhou and Farhadloo, Majid and Ghosh, Subhankar and Jayaprakash, Bharat and Shekhar, Shashi},\n    title     = {Towards Physics-informed Diffusion for Anomaly Detection in Trajectories: A Summary of Results},\n    year      = {2025},\n    isbn      = {9798400722608},\n    publisher = {Association for Computing Machinery},\n    address   = {New York, NY, USA},\n    url       = {https://doi.org/10.1145/3764914.3770595},\n    doi       = {10.1145/3764914.3770595},\n    booktitle = {Proceedings of the 2nd ACM SIGSPATIAL International Workshop on Geospatial Anomaly Detection},\n    series    = {GeoAnomalies '25},\n    pages     = {11--24},\n    numpages  = {14},\n    keywords  = {Physics-informed Neural Network, Trajectory Reconstruction, Spatiotemporal Data Mining, Anomaly Detection}\n  }",
    "image": "assets/figures/pub-pidiff.png"
  },
  {
    "id": "gcdm",
    "representative": true,
    "year": "2025",
    "title": "Geo-lucid Conditional Diffusion Models for High Physical Fidelity Trajectory Generation",
    "titleUrl": "https://doi.org/10.1145/3748636.3762749",
    "authors": "Mingzhou Yang, Arun Sharma, Majid Farhadloo, Bharat Jayaprakash and Shashi Shekhar",
    "venue": "Proceedings of the 33rd ACM International Conference on Advances in Geographic Information Systems (SIGSPATIAL '25), pp. 382-395, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/10.1145/3748636.3762749"
      }
    ],
    "abstract": "Given a set of historical vehicle trajectories and their descriptive attributes, the goal is to train a generative model that produces synthetic trajectories with high physical fidelity. Here, physical fidelity is defined as fidelity to both geometric and dynamic properties of trajectories. The problem is important since trajectory generation can contribute to data augmentation for many traffic-related applications, such as popular route discovery and traffic light control. The key challenge lies in achieving high physical fidelity under coarse geospatial attributes (e.g., origin-destination pairs) that lack fine-grained details. Current methods, which mostly focus on geometric properties, have limited utility in domain-specific scenarios due to their neglect of trajectory dynamics. To address these limitations, we propose GCDM, a novel Geo-Lucid Conditional Diffusion Model framework that integrates road map attributes into the generative process through spatially hierarchical generation and map-informed latent variables. Experiments on real-world vehicle trajectory datasets show that GCDM outperforms state-of-the-art methods in geo-distribution similarity and dynamics fidelity.",
    "bibtex": "@inproceedings{10.1145/3748636.3762749,\n  author    = {Yang, Mingzhou and Sharma, Arun and Farhadloo, Majid and Jayaprakash, Bharat and Shekhar, Shashi},\n  title     = {Geo-lucid Conditional Diffusion Models for High Physical Fidelity Trajectory Generation},\n  year      = {2025},\n  isbn      = {9798400720864},\n  publisher = {Association for Computing Machinery},\n  address   = {New York, NY, USA},\n  url       = {https://doi.org/10.1145/3748636.3762749},\n  doi       = {10.1145/3748636.3762749},\n  abstract  = {Given a set of historical vehicle trajectories and their descriptive attributes, the goal is to train a generative model that produces synthetic trajectories with high physical fidelity. Here, physical fidelity is defined as fidelity to both geometric and dynamic properties of trajectories. The problem is important since trajectory generation can contribute to data augmentation for many traffic-related applications, such as popular route discovery and traffic light control. The key challenge of this problem lies in achieving high physical fidelity under coarse geospatial attributes (e.g., origin-destination pairs) that lack fine-grained details. Current methods, which mostly focus on geometric properties, have limited utility in domain-specific scenarios due to their neglect of trajectory dynamics. To address these limitations, we propose GCDM, a novel Geo-Lucid Conditional Diffusion Model framework that integrates road map attributes into the generative process through spatially hierarchical generation and map-informed latent variables. Experiments on real-world vehicle trajectory datasets show that GCDM outperforms state-of-the-art methods in geo-distribution similarity and dynamics fidelity.},\n  booktitle = {Proceedings of the 33rd ACM International Conference on Advances in Geographic Information Systems},\n  pages     = {382--395},\n  numpages  = {14},\n  keywords  = {geo-lucid neural network, physical fidelity, trajectory generation, urban computing},\n  location  = {The Graduate Hotel Minneapolis, Minneapolis, MN, USA},\n  series    = {SIGSPATIAL '25}\n}",
    "image": "assets/figures/pub-gcdm.png"
  },
  {
    "id": "pggenfm",
    "representative": true,
    "year": "2025",
    "title": "Towards Physics-guided Generative Foundation Models",
    "titleUrl": "https://dl.acm.org/doi/10.1145/3764915.3770717",
    "authors": "Arun Sharma, Majid Farhadloo, Mingzhou Yang, Bharat Jayaprakash, William Northrop, and Shashi Shekhar",
    "venue": "The 1st ACM SIGSPATIAL International Workshop on Generative and Agentic AI for Multi-Modality Space-Time Intelligence (GeoGenAgent '25), Minneapolis, MN, USA, 5 pages, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3764915.3770717"
      },
      {
        "label": "page",
        "href": "projects/physics-guided-genfm/"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/physflow-earth"
      }
    ],
    "abstract": "This work introduces physics-guided generative foundation models (PgGenFMs), a class of generative models that systematically integrate broad and narrow physical knowledge into data, training, and architecture design. The paper motivates PgGenFMs by outlining key limitations of purely data-driven foundation models, including poor out-of-distribution behavior, violations of physical laws, and lack of interpretability in scientific and engineering domains. It proposes a conceptual framework and taxonomy that contrast PgGenFMs with conventional foundation models and physics-guided task-specific models, and discusses how physical constraints can be embedded via loss terms, architectures, surrogate simulations, and hybrid designs. The paper also highlights open problems around where and how to inject domain knowledge, how to handle location dependence and bias in geospatial settings, and how to scale PgGenFMs while preserving physical consistency and transparency.",
    "bibtex": "@inproceedings{10.1145/3764915.3770717,\n    author    = {Sharma, Arun and Farhadloo, Majid and Yang, Mingzhou and Jayaprakash, Bharat and Northrop, William and Shekhar, Shashi},\n    title     = {Towards Physics-guided Generative Foundation Models},\n    year      = {2025},\n    publisher = {Association for Computing Machinery},\n    address   = {New York, NY, USA},\n    url       = {https://doi.org/10.1145/3764915.3770717},\n    doi       = {10.1145/3764915.3770717},\n    booktitle = {The 1st ACM SIGSPATIAL International Workshop on Generative and Agentic AI for Multi-Modality Space-Time Intelligence},\n    series    = {GeoGenAgent '25},\n    pages     = {1--5},\n    numpages  = {5},\n    keywords  = {Physics-guided Generative Foundation Models, Foundation Models, Physics-guided Machine Learning}\n  }",
    "image": "assets/figures/pub-pggenfm.png"
  },
  {
    "id": "smhybrid",
    "representative": true,
    "year": "2025",
    "title": "Towards Surrogate Models with Hybrid Spatial Neural Networks: A Summary of Results",
    "titleUrl": "https://doi.org/10.1145/3764921.3770153",
    "authors": "Shengya Zhang, Arun Sharma, Majid Farhadloo, Mingzhou Yang, Ruolei Zeng, Subhankar Ghosh, Yao Zhang, Mu Hong, Licheng Liu, David Mulla and Shashi Shekhar",
    "venue": "Proceedings of the 8th ACM SIGSPATIAL International Workshop on Geospatial Simulation (GeoSIM '25), pp. 57-69, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3764921.3770153"
      }
    ],
    "abstract": "The goal is to develop an efficient and accurate surrogate model for Daycent, a widely used but computationally expensive ecosystem model. This problem is important due to its societal applications in sustainable agriculture. Challenges include balancing the trade-off between prediction time and solution quality (e.g., accuracy), as well as the need to capture spatial relationships both within and across sites, while also accounting for varied crop management practices that introduce irregular and non-stationary patterns, reducing predictability. Related work on surrogate models with traditional feed-forward artificial neural networks (SM-ANN) has shown that these models have limited accuracy and often fail to capture spatial dependencies. To address these limitations, we explore novel Surrogate Models with Hybrid Spatial Neural Networks (SM-Hybrid) capable of explicitly modeling spatial autocorrelation and tele-connections. Experimental results show that the proposed SM-Hybrid is more accurate than SM-ANN and is twice as fast as the Daycent model.",
    "bibtex": "@inproceedings{10.1145/3764921.3770153,\n    author    = {Zhang, Shengya and Sharma, Arun and Farhadloo, Majid and Yang, Mingzhou and Zeng, Ruolei and Ghosh, Subhankar and Zhang, Yao and Hong, Mu and Liu, Licheng and Mulla, David and Shekhar, Shashi},\n    title     = {Towards Surrogate Models with Hybrid Spatial Neural Networks: A Summary of Results},\n    year      = {2025},\n    isbn      = {9798400721847},\n    publisher = {Association for Computing Machinery},\n    address   = {New York, NY, USA},\n    url       = {https://doi.org/10.1145/3764921.3770153},\n    doi       = {10.1145/3764921.3770153},\n    booktitle = {Proceedings of the 8th ACM SIGSPATIAL International Workshop on Geospatial Simulation},\n    series    = {GeoSIM '25},\n    pages     = {57--69},\n    numpages  = {13},\n    keywords  = {surrogate modeling, spatial neural network, spatial autocorrelation, spatial teleconnection, sustainable agriculture, daycent model},\n    location  = {The Graduate Hotel Minneapolis, Minneapolis, MN, USA}\n  }",
    "image": "assets/figures/pub-smhybrid.png"
  },
  {
    "id": "ftbsc_kgml",
    "representative": true,
    "year": "",
    "title": "Towards Fine-Tuning-Based Site Calibration for Knowledge-Guided Machine Learning",
    "titleUrl": "https://ai-2-ase.github.io/papers/CameraReadys%203-41/38/CameraReady/SVA_KGML_109.pdf",
    "authors": "Ruolei Zeng, Arun Sharma, Shuai An, Mingzhou Yang, Shengya Zhang, Licheng Liu, David Mulla, and Shashi Shekhar",
    "venue": "5th Annual AAAI Workshop on AI to Accelerate Science and Engineering (AI2ASE)",
    "links": [
      {
        "label": "arXiv",
        "href": "https://arxiv.org/abs/2512.16013"
      }
    ],
    "abstract": "Accurate and cost-effective quantification of the agroecosystem carbon cycle at decision-relevant scales is essential for climate mitigation and sustainable agriculture. However, both transfer learning and the exploitation of spatial variability in this field are challenging, as they involve heterogeneous data and complex cross-scale dependencies. Conventional approaches often rely on location-independent parameterizations and independent training, underutilizing transfer learning and spatial heterogeneity in the inputs, and limiting their applicability in regions with substantial variability. We propose FTBSC-KGML (Fine-Tuning-Based Site Calibration-Knowledge-Guided Machine Learning), a pretraining- and fine-tuning-based, spatial-variability-aware, and knowledge-guided machine learning framework that augments KGML-ag with a pretraining-fine-tuning process and site-specific parameters. Using a pretraining-fine-tuning process with remote-sensing GPP, climate, and soil covariates collected across multiple midwestern sites, FTBSC-KGML estimates land emissions while leveraging transfer learning and spatial heterogeneity. A key component is a spatial-heterogeneity-aware transfer-learning scheme, which is a globally pretrained model that is fine-tuned at each state or site to learn place-aware representations, thereby improving local accuracy under limited data without sacrificing interpretability. Empirically, FTBSC-KGML achieves lower validation error and greater consistency in explanatory power than a purely global model, thereby better capturing spatial variability across states. This work extends the prior SDSA-KGML framework.",
    "bibtex": "@misc{zeng2025towards,\n  title={Towards Fine-Tuning-Based Site Calibration for Knowledge-Guided Machine Learning: A Summary of Results},\n  author={Zeng, Ruolei and Sharma, Arun and An, Shuai and Yang, Mingzhou and Zhang, Shengya and Liu, Licheng and Mulla, David and Shekhar, Shashi},\n  year={2025},\n  eprint={2512.16013},\n  archivePrefix={arXiv},\n  primaryClass={cs.LG},\n  url={https://arxiv.org/abs/2512.16013},\n  doi={10.48550/arXiv.2512.16013}\n}",
    "image": "assets/figures/pub-ftbsc_kgml.png"
  },
  {
    "id": "supercol",
    "representative": true,
    "year": "2025",
    "title": "Discovering Super-Colocation Patterns: A Summary of Results",
    "titleUrl": "https://doi.org/10.1145/3748777.3748790",
    "authors": "Shuai An, Shesha Sai Kumar Reddy Sadu, Arun Sharma, Majid Farhadloo and Shashi Shekhar",
    "venue": "Proceedings of the 19th International Symposium on Spatial and Temporal Data (SSTD '25), pp. 34-38, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3748777.3748790"
      }
    ],
    "abstract": "Given a collection of Boolean spatial features, the Super-Colocation Pattern Discovery process identifies subsets of features that are not only frequently located together but also have dense interactions. For example, the presence of multiple immune cells around cancer cells is more interesting to oncologists than simple colocation between immune and cancer cells. This problem is important due to its multiple societal applications, including oncology, economic analysis, and sports analytics. The problem is challenging due to the need to model interaction density among a subset of Boolean spatial features. Related work on colocation pattern mining is limited due to a lack of conceptual, logical, and physical models that accurately represent interaction density. Traditional interest measures (e.g., Participation Index) largely focus on the mere presence of another spatial feature type and overlook the number or density of neighboring instances. To address these limitations, we propose a novel interest measure, termed Super-Colocation Density, which utilizes a matrix or tensor along with a utility-based index to quantify the interaction density among subsets of spatial features. We also introduce novel Super-Colocation Mining algorithms and evaluate the proposed methods through both theoretical analysis and experiments with real and synthetic data.",
    "bibtex": "@inproceedings{10.1145/3748777.3748790,\n    author    = {An, Shuai and Sadu, Shesha Sai Kumar Reddy and Sharma, Arun and Farhadloo, Majid and Shekhar, Shashi},\n    title     = {Discovering Super-Colocation Patterns: A Summary of Results},\n    year      = {2025},\n    publisher = {Association for Computing Machinery},\n    address   = {New York, NY, USA},\n    url       = {https://doi.org/10.1145/3748777.3748790},\n    doi       = {10.1145/3748777.3748790},\n    booktitle = {Proceedings of the 19th International Symposium on Spatial and Temporal Data},\n    series    = {SSTD '25},\n    pages     = {34--38},\n    numpages  = {5},\n    keywords  = {Super-Colocation, Density Matrix, Density Index, Utility}\n  }",
    "image": "assets/figures/pub-supercol.png"
  },
  {
    "id": "mbor",
    "representative": true,
    "year": "2025",
    "title": "Towards Pareto-optimality with Multi-level Bi-objective Routing: A Summary of Results",
    "titleUrl": "https://doi.org/10.1145/3681772.3698215",
    "authors": "Mingzhou Yang, Ruolei Zeng, Arun Sharma, Shunichi Sawamura, William F. Northrop and Shashi Shekhar",
    "venue": "Proceedings of the 17th ACM SIGSPATIAL International Workshop on Computational Transportation Science GenAI and Smart Mobility Session (IWCTS'24), pp. 36-45, 2025",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/10.1145/3681772.3698215"
      }
    ],
    "abstract": "Given an origin, a destination, and a directed graph in which each edge is associated with a pair of non-negative costs, the bi-objective routing problem aims to find the set of all Pareto-optimal paths. This problem is societally important due to several applications, such as route finding that considers both vehicle travel time and energy consumption. The problem is challenging due to the potentially large number of candidate Pareto-optimal paths to be enumerated during the search, making existing compute-on-demand methods inefficient due to their high time complexity. One way forward is the introduction of precomputation algorithms. However, the large size of the Pareto-optimal set makes it infeasible to precompute and store all-pair solutions. In addition, generalizing traditional single-objective hierarchical algorithms to bi-objective cases is non-trivial because of the non-comparability of candidate paths and the need to accommodate multiple Pareto-optimal paths for each node pair. To overcome these limitations, we propose Multi-Level Bi-Objective Routing (MBOR) algorithms using three novel ideas: boundary multigraph representation, Pareto frontier encoding, and two-dimensional cost-interval-based pruning. Computational experiments using real road network data demonstrate that the proposed methods significantly outperform baseline methods in terms of online runtime and precomputation time.",
    "bibtex": "@inproceedings{10.1145/3681772.3698215,\n    author    = {Yang, Mingzhou and Zeng, Ruolei and Sharma, Arun and Sawamura, Shunichi and Northrop, William F. and Shekhar, Shashi},\n    title     = {Towards Pareto-optimality with Multi-level Bi-objective Routing: A Summary of Results},\n    year      = {2025},\n    isbn      = {9798400711510},\n    publisher = {Association for Computing Machinery},\n    address   = {New York, NY, USA},\n    url       = {https://doi.org/10.1145/3681772.3698215},\n    doi       = {10.1145/3681772.3698215},\n    booktitle = {Proceedings of the 17th ACM SIGSPATIAL International Workshop on Computational Transportation Science GenAI and Smart Mobility Session},\n    series    = {IWCTS'24},\n    pages     = {36--45},\n    numpages  = {10},\n    keywords  = {Bi-objective routing, Pareto optimality, Spatial algorithms, Spatial query processing},\n    location  = {Atlanta, GA, USA}\n  }",
    "image": "assets/figures/pub-mbor.png"
  },
  {
    "id": "kicdpm",
    "representative": true,
    "year": "2024",
    "title": "Towards Kriging-informed Conditional Diffusion for Regional Sea-Level Data Downscaling: A Summary of Results",
    "titleUrl": "https://doi.org/10.1145/3678717.3691304",
    "authors": "Subhankar Ghosh, Arun Sharma, Jayant Gupta, Aneesh Subramanian, Shashi Shekhar",
    "venue": "Proceedings of the 32nd ACM International Conference on Advances in Geographic Information Systems (SIGSPATIAL '24), pp. 372-383, 2024",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3678717.3691304"
      },
      {
        "label": "page",
        "href": "projects/kriging-informed-diffusion/"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/physflow-earth"
      }
    ],
    "abstract": "Given coarser-resolution projections from global climate models or satellite data, the downscaling problem aims to estimate finer-resolution regional climate data, capturing fine-scale spatial patterns and variability. Downscaling is any method to derive high-resolution data from low-resolution variables, often to provide more detailed and local predictions and analyses. This problem is societally crucial for effective adaptation, mitigation, and resilience against significant risks from climate change. The challenge arises from spatial heterogeneity and the need to recover finer-scale features while ensuring model generalization. Most downscaling methods fail to capture the spatial dependencies at finer scales and underperform on real-world climate datasets, such as sea-level rise. We propose a novel Kriging-informed Conditional Diffusion Probabilistic Model (Ki-CDPM) to capture spatial variability while preserving fine-scale features. Experimental results on climate data show that our proposed method is more accurate than state-of-the-art downscaling techniques.",
    "bibtex": "@inproceedings{10.1145/3678717.3691304,\n  author    = {Ghosh, Subhankar and Sharma, Arun and Gupta, Jayant and Subramanian, Aneesh and Shekhar, Shashi},\n  title     = {Towards Kriging-informed Conditional Diffusion for Regional Sea-Level Data Downscaling: A Summary of Results},\n  year      = {2024},\n  isbn      = {9798400711077},\n  publisher = {Association for Computing Machinery},\n  address   = {New York, NY, USA},\n  url       = {https://doi.org/10.1145/3678717.3691304},\n  doi       = {10.1145/3678717.3691304},\n  booktitle = {Proceedings of the 32nd ACM International Conference on Advances in Geographic Information Systems},\n  pages     = {372--383},\n  numpages  = {12},\n  keywords  = {Climate Science, Diffusion Models, Downscaling, Generative AI, GeoAI, Geostatistics, Kriging, Remote Sensing},\n  location  = {Atlanta, GA, USA},\n  series    = {SIGSPATIAL '24}\n}",
    "image": "assets/figures/pub-kicdpm.png"
  },
  {
    "id": "intexpl",
    "representative": true,
    "year": "",
    "title": "Physics-based Abnormal Trajectory Gap Detection",
    "titleUrl": "https://dl.acm.org/doi/10.1145/3673235",
    "authors": "Arun Sharma, Subhankar Ghosh and Shashi Shekhar",
    "venue": "ACM Transactions on Intelligent Systems and Technology 15 (5), 1-31",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3673235"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/stagd-trajectory-gap"
      },
      {
        "label": "page",
        "href": "projects/stagd-trajectory-gap/"
      }
    ],
    "abstract": "Given trajectories with gaps (i.e., missing data), we investigate algorithms to identify abnormal gaps in trajectories which occur when a given moving object did not report its location, but other moving objects in the same geographic region periodically did. The problem is important due to its societal applications, such as improving maritime safety and regulatory enforcement for global security concerns such as illegal fishing, illegal oil transfers, and trans-shipments. The problem is challenging due to the difficulty of bounding the possible locations of the moving object during a trajectory gap, and the very high computational cost of detecting gaps in such a large volume of location data. The current literature on anomalous trajectory detection assumes linear interpolation within gaps, which may not be able to detect abnormal gaps since objects within a given region may have traveled away from their shortest path. In preliminary work, we introduced an abnormal gap measure that uses a classical space-time prism model to bound an object's possible movement during the trajectory gap and provided a scalable memoized gap detection algorithm (Memo-AGD). In this paper, we propose a Space Time-Aware Gap Detection (STAGD) approach to leverage space-time indexing and merging of trajectory gaps. We also incorporate a Dynamic Region Merge-based (DRM) approach to efficiently compute gap abnormality scores. We provide theoretical proofs that both algorithms are correct and complete and also provide analysis of asymptotic time complexity. Experimental results on synthetic and real-world maritime trajectory data show that the proposed approach substantially improves computation time over the baseline technique.",
    "bibtex": "@article{sharma2024physics,\n    title={Physics-based abnormal trajectory gap detection},\n    author={Sharma, Arun and Ghosh, Subhankar and Shekhar, Shashi},\n    journal={ACM Transactions on Intelligent Systems and Technology},\n    volume={15},\n    number={5},\n    pages={1--31},\n    year={2024},\n    publisher={ACM New York, NY, USA}\n}",
    "image": "assets/figures/pub-intexpl.png"
  },
  {
    "id": "extreme-parkour",
    "representative": false,
    "year": "2024",
    "title": "Towards Spatially-Lucid AI Classification in Non-Euclidean Space: An Application for MxIF Oncology Data",
    "titleUrl": "https://epubs.siam.org/doi/abs/10.1137/1.9781611978032.71",
    "authors": "Majid Farhadloo, Arun Sharma, Jayant Gupta, Alexey Leontovich, Svetomir N Markovic, and Shashi Shekhar",
    "venue": "SIAM Data Mining Conference (SDM) 2024",
    "links": [
      {
        "label": "paper",
        "href": "https://epubs.siam.org/doi/pdf/10.1137/1.9781611978032.71/"
      },
      {
        "label": "arXiv",
        "href": "https://arxiv.org/abs/2402.14974"
      }
    ],
    "abstract": "Given multi-category point sets from different place-types, our goal is to develop a spatially-lucid classifier that can distinguish between two classes based on the arrangements of their points. This problem is important for many applications, such as oncology, for analyzing immune-tumor relationships and designing new immunotherapies. It is challenging due to spatial variability and interpretability needs. Previously proposed techniques require dense training data or have limited ability to handle significant spatial variability within a single place-type. Most importantly, these deep neural network (DNN) approaches are not designed to work in non-Euclidean space, particularly point sets. Existing non-Euclidean DNN methods are limited to one-size-fits-all approaches. We explore a spatial ensemble framework that explicitly uses different training strategies, including weighted-distance learning rate and spatial domain adaptation, on various place-types for spatially-lucid classification. Experimental results on real-world datasets (e.g., MxIF oncology data) show that the proposed framework provides higher prediction accuracy than baseline methods.",
    "bibtex": "@inproceedings{farhadloo2024towards,\n      title={Towards Spatially-Lucid AI Classification in Non-Euclidean Space: An Application for MxIF Oncology Data},\n      author={Farhadloo, Majid and Sharma, Arun and Gupta, Jayant and Leontovich, Alexey and Markovic, Svetomir N and Shekhar, Shashi},\n      booktitle={Proceedings of the 2024 SIAM International Conference on Data Mining (SDM)},\n      pages={616--624},\n      year={2024},\n      organization={SIAM}\n    }",
    "image": "assets/figures/pub-extreme-parkour.png"
  },
  {
    "id": "diffcls",
    "representative": false,
    "year": "2024",
    "title": "Spatial computing opportunities in biomedical decision support: The atlas-ehr vision",
    "titleUrl": "https://dl.acm.org/doi/10.1145/3679201",
    "authors": "Majid Farhadloo, Arun Sharma, Shashi Shekhar, and Svetomir N Markovic",
    "venue": "ACM Transactions on Spatial Algorithms and Systems 10, no. 3 (2024): 1-36.",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3679201"
      }
    ],
    "abstract": "We consider the problem of reducing the time needed by healthcare professionals to understand patient medical history via the next generation of biomedical decision support. This problem is societally important because it has the potential to improve healthcare quality and patient outcomes. However, navigating electronic health records is challenging due to the high patient-doctor ratios, potentially long medical histories, the urgency of treatment for some medical conditions, and patient variability. The current electronic health record systems provides only a longitudinal view of patient medical history, which is time-consuming to browse, and doctors often need to engage nurses, residents, and others for initial analysis. To overcome this limitation, we envision an alternative spatial representation of patients' histories (e.g., electronic health records (EHRs)) and other biomedical data in the form of Atlas-EHR. Just like Google Maps allows a global, national, regional, and local view, the Atlas-EHR may start with an overview of the patient's anatomy and history before drilling down to spatially anatomical sub-systems, their individual components, or sub-components. Atlas-EHR presents a compelling opportunity for spatial computing since healthcare is almost a fifth of the US economy. However, the traditional spatial computing designed for geographic use cases (e.g., navigation, land-surveys, mapping) faces many hurdles in the biomedical domain. This paper presents a number of open research questions under this theme in five broad areas of spatial computing.",
    "bibtex": "@article{10.1145/3679201,\n            author = {Farhadloo, Majid and Sharma, Arun and Shekhar, Shashi and Markovic, Svetomir},\n            title = {Spatial Computing Opportunities in Biomedical Decision Support: The Atlas-EHR Vision},\n            year = {2024},\n            issue_date = {September 2024},\n            publisher = {Association for Computing Machinery},\n            address = {New York, NY, USA},\n            volume = {10},\n            number = {3},\n            issn = {2374-0353},\n            url = {https://doi.org/10.1145/3679201},\n            doi = {10.1145/3679201},\n            month = sep,\n            articleno = {21},\n            numpages = {36},\n            keywords = {Atlas-EHR, biomedical decision support, inner space, spatial computing, vision}\n            }",
    "image": "assets/figures/pub-diffcls.png"
  },
  {
    "id": "statcol",
    "representative": false,
    "year": "2024",
    "title": "Towards Statistically Significant Taxonomy Aware Co-Location Pattern Detection",
    "titleUrl": "https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.COSIT.2024.25",
    "authors": "Subhankar Ghosh, Arun Sharma, Jayant Gupta, Shashi Shekhar",
    "venue": "COSIT 2024",
    "links": [
      {
        "label": "paper",
        "href": "https://drops.dagstuhl.de/storage/00lipics/lipics-vol315-cosit2024/LIPIcs.COSIT.2024.25/LIPIcs.COSIT.2024.25.pdf"
      }
    ],
    "abstract": "Given a collection of Boolean spatial feature types, their instances, a neighborhood relation (e.g., proximity), and a hierarchical taxonomy of the feature types, the goal is to find the subsets of feature types or their parents whose spatial interaction is statistically significant. This problem is for taxonomy-reliant applications such as ecology (e.g., finding new symbiotic relationships across the food chain), spatial pathology (e.g., immunotherapy for cancer), retail, etc. The problem is computationally challenging due to the exponential number of candidate co-location patterns generated by the taxonomy. Most approaches for co-location pattern detection overlook the hierarchical relationships among spatial features, and the statistical significance of the detected patterns is not always considered, leading to potential false discoveries. This paper introduces two methods for incorporating taxonomies and assessing the statistical significance of co-location patterns. The baseline approach iteratively checks the significance of co-locations between leaf nodes or their ancestors in the taxonomy. Using the Benjamini-Hochberg procedure, an advanced approach is proposed to control the false discovery rate. This approach effectively reduces the risk of false discoveries while maintaining the power to detect true co-location patterns. Experimental evaluation and case study results show the effectiveness of the approach..",
    "bibtex": "@InProceedings{ghosh_et_al:LIPIcs.COSIT.2024.25,\n      author =  {Ghosh, Subhankar and Sharma, Arun and Gupta, Jayant and Shekhar, Shashi},\n      title = {{Towards Statistically Significant Taxonomy Aware Co-Location Pattern Detection}},\n      booktitle = {16th International Conference on Spatial Information Theory (COSIT 2024)},\n      pages = {25:1--25:11},\n      series =  {Leibniz International Proceedings in Informatics (LIPIcs)},\n      ISBN =  {978-3-95977-330-0},\n      ISSN =  {1868-8969},\n      year =  {2024},\n      volume =  {315},\n      editor =  {Adams, Benjamin and Griffin, Amy L. and Scheider, Simon and McKenzie, Grant},\n      publisher = {Schloss Dagstuhl -- Leibniz-Zentrum f{\\\"u}r Informatik},\n      address = {Dagstuhl, Germany},\n      URL =   {https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.COSIT.2024.25},\n      URN =   {urn:nbn:de:0030-drops-208404},\n      doi =   {10.4230/LIPIcs.COSIT.2024.25},\n      annote =  {Keywords: Co-location patterns, spatial data mining, taxonomy, hierarchy, statistical significance, false discovery rate, family-wise error rate} \n    }",
    "image": "assets/figures/pub-statcol.png"
  },
  {
    "id": "fdrcol",
    "representative": false,
    "year": "2023",
    "title": "Reducing False Discoveries in Statistically-Significant Regional-Colocation Mining: A Summary of Results",
    "titleUrl": "https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.GIScience.2023.3",
    "authors": "Subhankar Ghosh, Jayant Gupta, Arun Sharma, Shuai An, Shashi Shekhar",
    "venue": "GIScience 2023",
    "links": [
      {
        "label": "paper",
        "href": "https://drops.dagstuhl.de/storage/00lipics/lipics-vol277-giscience2023/LIPIcs.GIScience.2023.3/LIPIcs.GIScience.2023.3.pdf"
      }
    ],
    "abstract": "Given a set S of spatial feature types, its feature instances, a study area, and a neighbor relationship, the goal is to find pairs <region (r_{g}), a subset C of S> such that C is a statistically significant regional-colocation pattern in r_{g}. This problem is important for applications in various domains including ecology, economics, and sociology. The problem is computationally challenging due to the exponential number of regional colocation patterns and candidate regions. Previously, we proposed a miner [Subhankar et. al, 2022] that finds statistically significant regional colocation patterns. However, the numerous simultaneous statistical inferences raise the risk of false discoveries (also known as the multiple comparisons problem) and carry a high computational cost. We propose a novel algorithm, namely, multiple comparisons regional colocation miner (MultComp-RCM) which uses a Bonferroni correction. Theoretical analysis, experimental evaluation, and case study results show that the proposed method reduces both the false discovery rate and computational cost.",
    "bibtex": "@inproceedings{ghosh2023reducing,\n      title={Reducing False Discoveries in Statistically-Significant Regional-Colocation Mining: A Summary of Results},\n      author={Ghosh, Subhankar and Gupta, Jayant and Sharma, Arun and An, Shuai and Shekhar, Shashi},\n      booktitle={12th International Conference on Geographic Information Science (GIScience 2023)},\n      year={2023},\n      organization={Schloss-Dagstuhl-Leibniz Zentrum f{\\\"u}r Informatik}\n    }",
    "image": "assets/figures/pub-fdrcol.png"
  },
  {
    "id": "sear",
    "representative": true,
    "year": "2022",
    "title": "Towards a tighter bound on possible-rendezvous areas: preliminary results",
    "titleUrl": "https://dl.acm.org/doi/abs/10.1145/3557915.3561033",
    "authors": "Arun Sharma, Jayant Gupta, Subhankar Ghosh",
    "venue": "International Conference on Advances in Geographic Information Systems (ACM SIGSPATIAL 2022) (Oral)",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3557915.3561033"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/tgard-rendezvous"
      },
      {
        "label": "page",
        "href": "projects/tgard-rendezvous/"
      }
    ],
    "abstract": "Given trajectories with gaps, we investigate methods to tighten spatial bounds on areas (e.g., nodes in a spatial network) where possible rendezvous activity could have occurred. The problem is important for reducing manual effort to post-process possible rendezvous areas using satellite imagery and has many societal applications to improve public safety, security, and health. The problem of rendezvous detection is challenging due to the difficulty of interpreting missing data within a trajectory gap and the very high cost of detecting gaps in such a large volume of location data. Most recent literature presents formal models, namely space-time prism, to track an object's rendezvous patterns within trajectory gaps on a spatial network. However, the bounds derived from the space-time prism are rather loose, resulting in unnecessarily extensive postprocessing manual effort. To address these limitations, we propose a Time Slicing-based Gap-Aware Rendezvous Detection (TGARD) algorithm to tighten the spatial bounds in spatial networks. We propose a Dual Convergence TGARD (DC-TGARD) algorithm to improve computational efficiency using a bi-directional pruning approach. Theoretical results show the proposed spatial bounds on the area of possible rendezvous are tighter than that from related work (space-time prism). Experimental results on synthetic and real-world spatial networks (e.g., road networks) show that the proposed DC-TGARD is more scalable than the TGARD algorithm.",
    "bibtex": "@inproceedings{sharma2022towards,\n      title={Towards a tighter bound on possible-rendezvous areas: preliminary results},\n      author={Sharma, Arun and Gupta, Jayant and Ghosh, Subhankar},\n      booktitle={Proceedings of the 30th International Conference on Advances in Geographic Information Systems},\n      pages={1--11},\n      year={2022}\n    }",
    "image": "assets/figures/pub-sear.png"
  },
  {
    "id": "leap",
    "representative": true,
    "year": "2023",
    "title": "Analyzing trajectory gaps to find possible rendezvous region",
    "titleUrl": "https://dl.acm.org/doi/full/10.1145/3467977",
    "authors": "Arun Sharma and Shashi Shekhar",
    "venue": "ACM TIST 2023",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3467977"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/tss-rendezvous-region"
      },
      {
        "label": "page",
        "href": "projects/tss-rendezvous-region/"
      }
    ],
    "abstract": "Given trajectory data with gaps, we investigate methods to identify possible rendezvous regions. The problem has societal applications such as improving maritime safety and regulatory enforcement. The challenges come from two aspects. First, gaps in trajectory data make it difficult to identify regions where moving objects may have rendezvoused for nefarious reasons. Hence, traditional linear or shortest path interpolation methods may not be able to detect such activities, since objects in a rendezvous may have traveled away from their usual routes to meet. Second, user detecting a rendezvous regions involve a large number of gaps and associated trajectories, making the task computationally very expensive. In preliminary work, we proposed a more effective way of handling gaps and provided examples to illustrate potential rendezvous regions. In this article, we are providing detailed experiments with both synthetic and real-world data. Experiments on synthetic data show that the accuracy improved by 50 percent, which is substantial as compared to the baseline approach. In this article, we propose a refined algorithm Temporal Selection Search for finding a potential rendezvous region and finding an optimal temporal range to improve computational efficiency. We also incorporate two novel spatial filters: (i) a Static Ellipse Intersection Filter and (ii) a Dynamic Circle Intersection Spatial Filter. Both the baseline and proposed approaches account for every possible rendezvous pattern. We provide a theoretical evaluation of the algorithms correctness and completeness along with a time complexity analysis. Experimental results on synthetic and real-world maritime trajectory data show that the proposed approach substantially improves the area pruning effectiveness and computation time over the baseline technique. We also performed experiments based on accuracy and precision on synthetic dataset on both proposed and baseline techniques.",
    "bibtex": "@article{sharma2022analyzing,\n      title={Analyzing trajectory gaps to find possible rendezvous region},\n      author={Sharma, Arun and Shekhar, Shashi},\n      journal={ACM Transactions on Intelligent Systems and Technology (TIST)},\n      volume={13},\n      number={3},\n      pages={1--23},\n      year={2022},\n      publisher={ACM New York, NY}\n    }",
    "image": "assets/figures/pub-leap.png"
  },
  {
    "id": "swim",
    "representative": false,
    "year": "2022",
    "title": "Mining taxonomy-aware colocations: a summary of results",
    "titleUrl": "https://dl.acm.org/doi/abs/10.1145/3557915.3561034",
    "authors": "Jayant Gupta and Arun Sharma",
    "venue": "ACM SIGSPATIAL 2022",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3557915.3561034"
      }
    ],
    "abstract": "Given a collection of Boolean spatial feature-types, their instances, a neighborhood relation (e.g., proximity), and a hierarchical taxonomy on the feature-types, taxonomy-aware colocation pattern discovery finds the subsets of feature-types or their parents frequently located together. Taxonomy-aware colocations are important due to their use in taxonomy-reliant societal applications in ecology (e.g., finding new symbiotic relationships across food-chain), spatial pathology (e.g., immunotherapy for cancer), etc. Due to the taxonomy, the number of candidate patterns increases considerably (i.e., exponential in the number of colocated instances, where a subset of instances have a parent-child relation). Existing algorithms for mining general colocations are not designed to use taxonomy and will incur redundant computations across the hierarchy. We propose a taxonomy-aware colocation miner (TCM) algorithm which uses a user-defined taxonomy to find taxonomy-aware colocation patterns. We also propose TCM-Prune algorithm that prunes duplicate colocations instances having a parent-child relation. Experiments with synthetic and real data sets show that TCM and TCM-Prune can find colocation patterns missed by the traditional approach (i.e., the ones which do not take hierarchy into account), and TCM-Prune can remove duplicate colocation instances.",
    "bibtex": "@inproceedings{gupta2022mining,\n      title={Mining taxonomy-aware colocations: a summary of results},\n      author={Gupta, Jayant and Sharma, Arun},\n      booktitle={Proceedings of the 30th International Conference on Advances in Geographic Information Systems},\n      pages={1--11},\n      year={2022}\n    }",
    "image": "assets/figures/pub-swim.png"
  },
  {
    "id": "vrb",
    "representative": true,
    "year": "2022",
    "title": "Abnormal Trajectory-Gap Detection: A Summary (Short Paper)",
    "titleUrl": "https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.COSIT.2022.26",
    "authors": "Arun Sharma, Jayant Gupta, Shashi Shekhar",
    "venue": "COSIT 2022 (Oral)",
    "links": [
      {
        "label": "paper",
        "href": "https://drops.dagstuhl.de/storage/00lipics/lipics-vol240-cosit2022/LIPIcs.COSIT.2022.26/LIPIcs.COSIT.2022.26.pdf"
      },
      {
        "label": "page",
        "href": "projects/stagd-trajectory-gap/"
      }
    ],
    "abstract": "Given trajectories with gaps (ie, missing data), we investigate algorithms to identify abnormal gaps for testing possible hypotheses of anomalous regions. Here, an abnormal gap within a trajectory is defined as an area where a given moving object did not report its location, but other moving objects did periodically. The problem is important due to its societal applications, such as improving maritime safety and regulatory enforcement for global security concerns such as illegal fishing, illegal oil transfer, and trans-shipments. The problem is challenging due to the difficulty of interpreting missing data within a trajectory gap, and the high computational cost of detecting gaps in such a large volume of location data proves computationally very expensive. The current literature assumes linear interpolation within gaps, which may not be able to detect abnormal gaps since objects within a given region may have traveled away from their shortest path. To overcome this limitation, we propose an abnormal gap detection (AGD) algorithm that leverages the concepts of a space-time prism model where we assume space-time interpolation. We then propose a refined memoized abnormal gap detection (Memo-AGD) algorithm that reduces comparison operations. We validated both algorithms using synthetic and real-world data. The results show that abnormal gaps detected by our algorithms give better estimates of abnormality than linear interpolation and can be used for further investigation from the human analysts.",
    "bibtex": "@inproceedings{sharma2022abnormal,\n    title={Abnormal Trajectory-Gap Detection: A Summary (Short Paper)},\n    author={Sharma, Arun and Gupta, Jayant and Shekhar, Shashi},\n    booktitle={15th International Conference on Spatial Information Theory (COSIT 2022)},\n    year={2022},\n    organization={Schloss Dagstuhl-Leibniz-Zentrum f{\\\"u}r Informatik}\n  }",
    "image": "assets/figures/pub-vrb.png"
  },
  {
    "id": "crossmodal_2023",
    "representative": false,
    "year": "2022",
    "title": "Towards geographically robust statistically significant regional colocation pattern detection",
    "titleUrl": "https://dl.acm.org/doi/abs/10.1145/3557989.3566158",
    "authors": "Subhankar Ghosh, Jayant Gupta, Arun Sharma, Shuai An, and Shashi Shekhar",
    "venue": "ACM GeoSim 2022",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3557989.3566158"
      }
    ],
    "abstract": "Given a set S of spatial feature-types, its feature-instances, a study area, and a neighbor relationship, the goal is to find pairs <region (rg), a subset C of S> such that C is a statistically significant regional colocation pattern in region rg. For example Caribou Coffee and Starbucks are significantly co-located in Minneapolis but not in Dallas at present. This problem has applications in a wide variety of domains including ecology, economics, and sociology. The problem is computationally challenging due to the exponential number of regional colocation patterns and candidate regions. The current literature on regional colocation pattern detection has not addressed statistical significance which can result in spurious (chance) pattern instances. In this paper, we propose a novel technique for mining statistically significant regional colocation patterns. Our approach determines regions based on geographically defined boundaries (e.g., counties) unlike previous works which employed clustering, or regular polygons to enumerate candidate regions. To reduce spurious patterns, we perform a statistical significance test by modeling the observed data points with multiple Monte Carlo simulations within the corresponding regions. Using Safegraph POI dataset, this paper provides a case study on retail establishments in Minnesota for validation of proposed ideas. The paper also provides a detailed interpretation of discovered patterns using game theory and regional economics..",
    "bibtex": "@inproceedings{ghosh2022towards,\n      title={Towards geographically robust statistically significant regional colocation pattern detection},\n      author={Ghosh, Subhankar and Gupta, Jayant and Sharma, Arun and An, Shuai and Shekhar, Shashi},\n      booktitle={Proceedings of the 5th ACM SIGSPATIAL International Workshop on GeoSpatial Simulation},\n      pages={11--20},\n      year={2022}\n    }",
    "image": "assets/figures/pub-crossmodal_2023.png"
  },
  {
    "id": "legmanip",
    "representative": true,
    "year": "",
    "title": "Book Chapter: Spatiotemporal Data Mining",
    "titleUrl": "https://doi.org/10.4337/9781789903942.00029",
    "authors": "Arun Sharma, Zhe Jiang, and Shashi Shekhar",
    "venue": "Handbook of Spatial Analysis in the Social Sciences",
    "links": [
      {
        "label": "code",
        "href": "https://github.com/arunshar/stdm-survey-toolkit"
      },
      {
        "label": "page",
        "href": "projects/stdm-survey-toolkit/"
      }
    ],
    "abstract": "Spatiotemporal data mining aims to discover interesting, useful but non-trivial patterns in big spatial and spatiotemporal data. They are used in various application domains such as public safety, ecology, epidemiology, earth science etc. This problem is challenging because of the high societal cost of spurious patterns and exorbitant computational cost. Recent surveys of spatiotemporal data mining need update due to rapid growth. In addition, they did not adequately survey parallel techniques for spatiotemporal data mining. This paper provides a more up-to-date survey of spatiotemporal data mining methods. Furthermore, it has a detailed survey of parallel formulations of spatiotemporal data mining.",
    "bibtex": "@incollection{sharma2022spatiotemporal,\n      title={Spatiotemporal data mining},\n      author={Sharma, Arun and Jiang, Zhe and Shekhar, Shashi},\n      booktitle={Handbook of Spatial Analysis in the Social Sciences},\n      pages={352--368},\n      year={2022},\n      publisher={Edward Elgar Publishing}\n    }",
    "image": "assets/figures/pub-legmanip.png"
  },
  {
    "id": "alan",
    "representative": true,
    "year": "2022",
    "title": "Understanding Covid-19 Effects on Mobility: A Community-Engaged Approach",
    "titleUrl": "https://agile-giss.copernicus.org/articles/3/14/2022/",
    "authors": "Arun Sharma, Majid Farhadloo, Yan Li, Jayant Gupta, Aditya Kulkarni, Shashi Shekhar",
    "venue": "AGILE: GIScience 2022",
    "links": [
      {
        "label": "PDF",
        "href": "assets/papers/covid-mobility.pdf"
      },
      {
        "label": "article",
        "href": "https://agile-giss.copernicus.org/articles/3/14/2022/"
      },
      {
        "label": "dashboard",
        "href": "projects/covid-mobility/"
      }
    ],
    "abstract": "Given aggregated mobile device data, the goal is to understand the impact of COVID-19 policy interventions on mobility. This problem is vital due to important societal use cases, such as safely reopening the economy. Challenges include understanding and interpreting questions of interest to policymakers, cross-jurisdictional variability in choice and time of interventions, the large data volume, and unknown sampling bias. The related work has explored the COVID-19 impact on travel distance, time spent at home, and the number of visitors at different points of interest. However, many policymakers are interested in long-duration visits to high-risk business categories and understanding the spatial selection bias to interpret summary reports. We provide an Entity Relationship diagram, system architecture, and implementation to support queries on long-duration visits in addition to fine resolution device count maps to understand spatial bias. We closely collaborated with policymakers to derive the system requirements and evaluate the system components, the summary reports, and visualizations.",
    "bibtex": "@article{sharma2022understanding,\n      title={Understanding covid-19 effects on mobility: A community-engaged approach},\n      author={Sharma, Arun and Farhadloo, Majid and Li, Yan and Gupta, Jayant and Kulkarni, Aditya and Shekhar, Shashi},\n      journal={AGILE: GIScience Series},\n      volume={3},\n      pages={14},\n      year={2022},\n      publisher={Copernicus Publications G{\\\"o}ttingen, Germany}\n    }",
    "image": "assets/figures/pub-alan.png"
  },
  {
    "id": "flavr",
    "representative": true,
    "year": "2021",
    "title": "Analyzing trajectory gaps for possible rendezvous: A summary of results",
    "titleUrl": "https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.GIScience.2021.I.13",
    "authors": "Arun Sharma, Xun Tang, Jayant Gupta, Majid Farhadloo, Shashi Shekhar",
    "venue": "GIScience 2021 (Oral)",
    "links": [
      {
        "label": "paper",
        "href": "https://drops.dagstuhl.de/storage/00lipics/lipics-vol177-giscience2021/LIPIcs.GIScience.2021.I.13/LIPIcs.GIScience.2021.I.13.pdf"
      },
      {
        "label": "page",
        "href": "projects/tss-rendezvous-region/"
      }
    ],
    "abstract": "Given trajectory data with gaps, we investigate methods to identify possible rendezvous regions. Societal applications include improving maritime safety and regulations. The challenges come from two aspects. If trajectory data are not available around the rendezvous then either linear or shortest-path interpolation may fail to detect the possible rendezvous. Furthermore, the problem is computationally expensive due to the large number of gaps and associated trajectories. In this paper, we first use the plane sweep algorithm as a baseline. Then we propose a new filtering framework using the concept of a space-time grid. Experimental results and case study on real-world maritime trajectory data show that the proposed approach substantially improves the Area Pruning Efficiency over the baseline technique.",
    "bibtex": "@inproceedings{sharma2020analyzing,\n      title={Analyzing trajectory gaps for possible rendezvous: A summary of results},\n      author={Sharma, Arun and Tang, Xun and Gupta, Jayant and Farhadloo, Majid and Shekhar, Shashi},\n      booktitle={11th International Conference on Geographic Information Science (GIScience 2021)-Part I},\n      year={2020},\n      organization={Schloss Dagstuhl-Leibniz-Zentrum f{\\\"u}r Informatik}\n    }",
    "image": "assets/figures/pub-flavr.png"
  },
  {
    "id": "vision-loco",
    "representative": true,
    "year": "2018",
    "title": "WebGlobe - A cloud-based geospatial analysis framework for interacting with climate data",
    "titleUrl": "https://dl.acm.org/doi/abs/10.1145/3282834.3282835",
    "authors": "Arun Sharma, Syed Mohammed Arshad Zaidi, Varun Chandola, Melissa R Allen, and Budhendra L Bhaduri",
    "venue": "ACM BIGSPATIAL 2018",
    "links": [
      {
        "label": "paper",
        "href": "https://dl.acm.org/doi/pdf/10.1145/3282834.3282835"
      },
      {
        "label": "code",
        "href": "https://github.com/arunshar/webglobe-raster"
      },
      {
        "label": "page",
        "href": "projects/webglobe-raster/"
      }
    ],
    "abstract": "While climate models have evolved over time to produce high fidelity and high resolution climate forecasts, visualization and analysis of the output of the model simulations has been limited, typically constrained to single dimensional charts for visualization and basic aggregate statistics for analytics. Same is true for the large troves of observational data available from meteorological stations all over the world. For richer understanding of climate and the impact of climate change, one needs computational tools that allow researchers, policymakers, and general public, to interact with the climate data. In this paper, we describe webGlobe, a browser-based GIS framework for interacting with climate data, and other datasets available in similar format. webGlobe is a unique resource that allows unprecedented access to climate data through a browser-based framework and also allows for deploying machine learning based analytical applications on the climate data without putting computational burden on the client. Instead, webGlobe uses a client-server framework, where the server, deployed on a cloud infrastructure, allows for dynamic allocation of resources for running compute-intensive applications. The capabilities of the framework will be discussed in context of a use case: identifying extreme events from real and simulated climate data using a Gaussian process based change detection algorithm.",
    "bibtex": "@inproceedings{sharma2018webgiobe,\n      title={WebGIobe-A cloud-based geospatial analysis framework for interacting with climate data},\n      author={Sharma, Arun and Zaidi, Syed Mohammed Arshad and Chandola, Varun and Allen, Melissa R and Bhaduri, Budhendra L},\n      booktitle={Proceedings of the 7th ACM SIGSPATIAL International Workshop on Analytics for Big Geospatial Data},\n      pages={42--46},\n      year={2018}\n    }",
    "image": "assets/figures/pub-vision-loco.png"
  }
];
