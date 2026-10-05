export type Project = {
  name:string;
  slug:string;
  family:string;
  summary:string;
  purpose:string;
  challenge:string;
  architecture:string[];
  stack:string[];
  implemented:string[];
  proof:string[];
  boundary:string;
  next:string;
  repoUrl:string;
  liveUrl?:string;
};

export const projects:Project[]=[
  {
    name:"Mak'ma AI OS",
    slug:"makma-ai-os",
    family:"Agency / orchestration",
    summary:"A personal AI runtime built around memory, planning, permissioned tools, observability and durable workflows.",
    purpose:"Make agent behaviour inspectable and controllable instead of hiding tool use behind a chat box.",
    challenge:"Tool-using assistants become difficult to trust when planning, memory, permissions and execution are invisible. Mak'ma exposes those layers as explicit engineering surfaces.",
    architecture:["Input","Memory","Planner","Permission gate","Tool bus","Execution","Telemetry"],
    stack:["Python","FastAPI","SQLite","Agents","Docker","OpenTelemetry"],
    implemented:[
      "Deterministic, hybrid and schema-constrained planning with provider routing",
      "Persistent SQLite conversation memory with ranked lexical and optional semantic recall",
      "Typed permissioned tool registry with risk metadata and approval hooks",
      "Durable dependency-aware workflows with pause/resume checkpoints",
      "Run history, per-tool traces, latency and bounded telemetry",
      "Optional RAG, Data Copilot, Eval and MLOps satellite integrations"
    ],
    proof:[
      "Live browser runtime console plus a real FastAPI backend contract",
      "Browser/Python parity fixtures for intentionally shared deterministic behaviour",
      "CI, Docker support and automated interaction tests across the MAK'MA product family"
    ],
    boundary:"Browser storage is local and unencrypted, so the public experience is designed for synthetic data. High-risk shell/filesystem/browser mutation tools are not registered by default.",
    next:"Multi-user identity and session ownership, server-owned approval challenges, asynchronous persistence and deeper OpenTelemetry export.",
    repoUrl:"https://github.com/maharshimak/makma-ai-os",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/"
  },
  {
    name:"Agentic RAG Engine",
    slug:"agentic-rag-engine",
    family:"Knowledge / retrieval",
    summary:"An inspectable hybrid retrieval pipeline with lexical and semantic search, fusion, reranking, citations and evaluation.",
    purpose:"Make retrieval quality measurable and understandable instead of reducing RAG to embed → search → prompt.",
    challenge:"A RAG answer can look fluent even when the retrieval path is weak. The system separates every retrieval stage so ranking quality and evidence can be inspected independently.",
    architecture:["Query","BM25","Semantic","RRF","Rerank","Context budget","Answer + citations"],
    stack:["Python","FastAPI","BM25","RRF","Embeddings","Docker"],
    implemented:[
      "Document chunking with BM25-style lexical retrieval and cosine semantic retrieval",
      "Reciprocal-rank fusion across lexical, semantic and planned-query rankings",
      "Deterministic multi-query decomposition and interpretable reranking",
      "Token-budgeted citation context construction",
      "Recall@K, Precision@K, MRR and Hit Rate evaluation",
      "OpenAI-compatible embedding and generation adapters"
    ],
    proof:[
      "Editable live retrieval laboratory with per-stage ranking scores and JSON export",
      "Python/browser parity fixtures for hashing, BM25 and RRF contracts",
      "Persistent source-document and optional embedding caches in SQLite"
    ],
    boundary:"The reproducible browser semantic mode uses deterministic hash vectors rather than pretending to run a learned embedding model. Real model endpoints are explicit optional adapters.",
    next:"Persistent vector-store adapters, calibrated learned reranking, stronger labeled domain benchmarks and iterative retrieval.",
    repoUrl:"https://github.com/maharshimak/agentic-rag-engine",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/agentic-rag-engine/"
  },
  {
    name:"Multimodal AI Studio",
    slug:"multimodal-ai-studio",
    family:"Agency / media",
    summary:"A media automation and AI inference toolkit that converts creative intent into ordered, validated and inspectable operations.",
    purpose:"Treat multimodal generation and editing as a controllable pipeline rather than a single opaque prompt.",
    challenge:"Creative AI workflows mix expensive inference with deterministic media operations. The system makes the plan, workload and unavailable capabilities explicit before rendering.",
    architecture:["Instruction","Intent parse","Media plan","Validation","Execution adapters","Output"],
    stack:["Python","FFmpeg","Planning","Whisper","Diffusers","Pipelines"],
    implemented:[
      "Typed prompt-to-edit planning for retiming, grading, denoising, subtitles and background operations",
      "Stage validation, duplicate-operation checks and render-budget enforcement",
      "Shell-free FFmpeg execution for supported deterministic edits",
      "Optional faster-whisper transcription with timestamped SRT output",
      "Optional Hugging Face Diffusers image-generation adapter",
      "Runtime capability detection so unavailable AI backends fail explicitly"
    ],
    proof:[
      "Live preflight tool calculates output workload, frame counts, warnings and a fingerprinted plan",
      "Real ffprobe inspection and bounded FFmpeg execution in the Python package",
      "CI verifies planner correctness and explicit failure paths"
    ],
    boundary:"The public browser experience is a deterministic preflight planner; it does not falsely claim to run local transcription, diffusion or GPU rendering.",
    next:"Measured hardware profiles, richer typed operation parameters, real compositor adapters, asynchronous render jobs and cancellation.",
    repoUrl:"https://github.com/maharshimak/multimodal-ai-studio",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/multimodal-ai-studio/"
  },
  {
    name:"Knowledge Twin",
    slug:"knowledge-twin",
    family:"Knowledge / graph",
    summary:"An evidence-bearing entity and relationship graph for traversal, retrieval, identity resolution and knowledge-centric AI workflows.",
    purpose:"Represent knowledge as inspectable relationships with provenance rather than disconnected chunks.",
    challenge:"A graph is only useful when relationships remain traceable to evidence and ambiguous identities are handled explicitly.",
    architecture:["Evidence","Entities","Resolution","Graph store","Traversal","Retrieval"],
    stack:["Python","Graphs","SQLite","Retrieval","Evidence","Entity resolution"],
    implemented:[
      "Typed entities and directed evidence-bearing relationships",
      "Directed BFS neighbourhood traversal and shortest-path search",
      "Keyword retrieval plus explicit fuzzy entity-resolution scoring",
      "Graph-quality audit for orphans, duplicates, coverage and components",
      "Optional SQLite persistence for entities, relationships and evidence",
      "Optional model-assisted extraction with fail-closed verbatim evidence anchoring"
    ],
    proof:[
      "Live graph workspace with editable entities/edges, traversal and JSON export",
      "Explicit resolution thresholds and top-candidate inspection",
      "Validation rejects malformed graph state instead of silently accepting it"
    ],
    boundary:"Evidence is supplied or extracted from user-provided source text and is not independently verified. Similarity scores are deterministic matching signals, not AI probabilities.",
    next:"Versioned graph imports, provenance-source records, conflict-aware human entity merging and stronger semantic retrieval.",
    repoUrl:"https://github.com/maharshimak/knowledge-twin",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/knowledge-twin/"
  },
  {
    name:"Clinical Document Intelligence",
    slug:"clinical-document-intelligence",
    family:"Knowledge / document AI",
    summary:"Evidence-grounded clinical document extraction with validation, human-review provenance and optional document-understanding/model adapters.",
    purpose:"Extract structured study information without losing the exact source evidence or the history of human corrections.",
    challenge:"Document extraction becomes unsafe when structured fields are detached from their source spans. This pipeline keeps evidence, normalized values and review provenance together.",
    architecture:["Document","Parse","Extract","Validate","Human review","Provenance"],
    stack:["Python","Document AI","FastAPI","Docling","Extraction","Validation"],
    implemented:[
      "Study/protocol, phase, participants, treatment, endpoint, sponsor and study-design extraction",
      "Normalization and schema validation for structured study metadata",
      "Verbatim source-evidence spans for every recognized field",
      "Human corrections stored separately from original extraction evidence",
      "Bounded text, Markdown and text-bearing PDF ingestion",
      "Optional OpenAI-compatible extraction and optional Docling document-understanding path"
    ],
    proof:[
      "Live review workspace exposes offsets, highlights, validation and corrected values",
      "Model-backed extraction fails closed when a field cannot be anchored to a verbatim source span",
      "Document and extraction behaviour are protected by regression tests"
    ],
    boundary:"This is a synthetic document-engineering system, not medical advice or a clinical decision tool. No patient or confidential employer documents are included.",
    next:"Versioned review records, adjudicated extraction-quality datasets, richer OCR/layout evaluation and calibrated confidence.",
    repoUrl:"https://github.com/maharshimak/clinical-document-intelligence",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/clinical-document-intelligence/"
  },
  {
    name:"Secure Data Copilot",
    slug:"secure-data-copilot",
    family:"Agency / data safety",
    summary:"A read-only analytics copilot with deterministic planning, SQL restrictions, bounded execution and auditable query metadata.",
    purpose:"Let an AI assistant reason over business data without silently gaining write access to the database.",
    challenge:"Natural-language-to-SQL demos often collapse planning and execution into one unsafe step. This design treats every generated query as untrusted input.",
    architecture:["Question","Planner","Authorization","SQL policy","Read-only execution","Audit"],
    stack:["Python","SQLite","sqlglot","FastAPI","Guardrails","Analytics"],
    implemented:[
      "SQLite schema introspection and typed query plans",
      "Parsed SQL AST policy using sqlglot with multi-statement and mutation blocking",
      "Table/column authorization plus structural complexity and query-risk budgets",
      "Native read-only/query-only SQLite execution with enforced outer row limits",
      "Execution timing, numeric summaries and query-audit metadata",
      "Optional OpenAI-compatible schema-aware planner behind the same safety boundary"
    ],
    proof:[
      "Live workspace exposes the generated plan, risk budget, result rows and export",
      "Mutation intent is rejected before planning in the browser workflow",
      "CSV export neutralizes formula-leading cells and backend queries are deadline-bounded"
    ],
    boundary:"AST validation is defense in depth, not a complete SQL sandbox. Production multi-user identity, row-level security and a least-privilege PostgreSQL adapter remain future work.",
    next:"Row-level authorization, persistent audit storage, database-native cost estimation and a production PostgreSQL least-privilege adapter.",
    repoUrl:"https://github.com/maharshimak/secure-data-copilot",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/secure-data-copilot/"
  },
  {
    name:"LLM Eval & Observability",
    slug:"llm-eval-observability",
    family:"Reliability / evaluation",
    summary:"An experiment and release-evaluation workstation for quality, citations, latency, cost, regressions and release decisions.",
    purpose:"Detect AI regressions that still return successful HTTP responses.",
    challenge:"An AI deployment can become slower, more expensive or less grounded without throwing an exception. Reliability has to be measured as product behaviour.",
    architecture:["Dataset","Candidate run","Metrics","Regression budget","Trace","Release gate"],
    stack:["Python","Evaluation","Observability","FastAPI","SLOs","Statistics"],
    implemented:[
      "Typed evaluation cases with relevance, citation and forbidden-output checks",
      "Latency p95, pass-rate, token/cost and reliability summaries",
      "Versioned datasets and reproducible experiment manifests",
      "Baseline deltas, regression budgets and release quality gates",
      "JSONL trace storage and OpenAI-compatible live candidate execution",
      "Optional strict-JSON model judge with fail-closed rubric validation"
    ],
    proof:[
      "Live batch-evaluation workstation with case-level failures and export",
      "Wilson interval and nearest-rank p95 calculations are surfaced explicitly",
      "CI regression gates protect evaluation behaviour"
    ],
    boundary:"Citation checks verify identifiers rather than factual entailment, and synthetic evaluation cases are not a substitute for production benchmarks.",
    next:"Paired statistical comparisons, semantic/faithfulness evaluators, provider trace ingestion and richer production datasets.",
    repoUrl:"https://github.com/maharshimak/llm-eval-observability",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/llm-eval-observability/"
  },
  {
    name:"MLOps Control Plane",
    slug:"mlops-control-plane",
    family:"Reliability / governance",
    summary:"A model lifecycle policy workbench for registration, evaluation gates, controlled promotion, canary decisions and drift monitoring.",
    purpose:"Make model promotion decisions explicit, repeatable and observable.",
    challenge:"Shipping a model is a governance decision as much as a training result. The system records what was evaluated, why promotion was allowed and what should happen under drift.",
    architecture:["Model","Evaluate","Register","Gate","Promote","Monitor","Rollback"],
    stack:["Python","MLOps","SQLite","Registry","Governance","PSI"],
    implemented:[
      "Model artifact registry with dataset fingerprints and evaluation records",
      "One-way lifecycle transitions with immutable persisted transition history",
      "Directional quality thresholds and baseline-delta gates",
      "Population Stability Index drift monitoring",
      "Canary snapshots, traffic recommendations and rollback precedence",
      "Typed HTTPS deployment-target boundary without arbitrary shell execution"
    ],
    proof:[
      "Live lifecycle workbench exports fingerprinted governance decisions",
      "SQLite-backed registry preserves model lifecycle state across restarts",
      "Promotion and canary policies validate malformed or unsafe inputs"
    ],
    boundary:"The browser workbench and core package do not automatically change production infrastructure. Artifact references remain metadata unless connected to an external controller.",
    next:"Authenticated registry, signed artifacts, real rollout-controller integration and deeper deployment telemetry.",
    repoUrl:"https://github.com/maharshimak/mlops-control-plane",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/mlops-control-plane/"
  },
  {
    name:"MLOps Production Pipeline",
    slug:"mlops-production-pipeline",
    family:"Reliability / lifecycle",
    summary:"Reproducible ML lifecycle building blocks with deterministic training, held-out evaluation, integrity gates and drift monitoring.",
    purpose:"Treat model delivery as a traceable lifecycle rather than a notebook export.",
    challenge:"A model artifact is not enough: teams need reproducible data/config fingerprints, held-out evidence, integrity checks and a release decision.",
    architecture:["Data","Train","Evaluate","Fingerprint","Gate","Deploy decision","Monitor drift"],
    stack:["Python","ML","CI/CD","SQLite","Monitoring","Reproducibility"],
    implemented:[
      "Deterministic single-feature OLS and multi-feature ridge-stabilized regression",
      "Seeded train/evaluation splitting with held-out MAE",
      "Dataset, configuration and model-artifact SHA-256 fingerprints",
      "Normalized PSI drift checks and integrity-aware deployment gates",
      "Reproducible artifact serialization",
      "SQLite run ledger for parameters, metrics, fingerprints and terminal run state"
    ],
    proof:[
      "Live browser workflow exposes coefficients, errors, drift, artifact hashing and gate decisions",
      "Edits invalidate artifact verification until integrity is checked again",
      "Shared Python/browser fixtures protect selected mathematical contracts"
    ],
    boundary:"This is a compact lifecycle engineering system, not a full production serving platform. It does not pretend to own infrastructure deployment or a hosted feature/model store.",
    next:"Trusted signed manifests, stronger dataset versioning, CI deployment integrations and broader estimator support.",
    repoUrl:"https://github.com/maharshimak/mlops-production-pipeline",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/mlops-production-pipeline/"
  }
];

export const experience=[
  {period:"Oct 2023 — Jan 2024",company:"Substrate AI",role:"Data Analytics Intern",signal:"Analytics / experimentation",detail:"Built an early foundation in analytical workflows, data interpretation and experimentation."},
  {period:"Jan — Mar 2024",company:"X & Y Corp",role:"NLP & Algorithm Developer",signal:"NLP / algorithms",detail:"Moved deeper into language systems and algorithmic problem solving."},
  {period:"Jul — Sep 2024",company:"Algo Ético",role:"PM & Data Analyst",signal:"Responsible AI",detail:"Worked at the intersection of delivery, data analysis and responsible-AI thinking."},
  {period:"Sep — Dec 2024",company:"CMI Strategies",role:"Data Analyst",signal:"Data / decision systems",detail:"Used analytics to turn operational data into clearer decision signals."},
  {period:"Jan — Aug 2025",company:"Pangea Summit",role:"ML Engineer",signal:"RAG / agents / knowledge",detail:"Worked across RAG, a Digital Knowledge Twin, knowledge graphs, compliance-oriented AI, prompt evaluation and agentic product concepts."},
  {period:"Oct 2025 — Jan 2026",company:"FPT Software",role:"AI Developer",signal:"Applied AI systems",detail:"Focused on applied AI development and the engineering discipline required to turn models into usable systems."},
  {period:"Jan — Apr 2026",company:"CERC",role:"AI Engineer",signal:"Clinical document intelligence",detail:"Worked on clinical-trial document mapping, structured extraction and knowledge-base workflows."}
];

export const skillSystems=[
  {name:"INTELLIGENCE",items:["LLMs","NLP","Prompting","Transformers","Model behaviour","PyTorch","TensorFlow"]},
  {name:"KNOWLEDGE",items:["RAG","Semantic search","BM25","Vector retrieval","Knowledge graphs","Reranking"]},
  {name:"AGENCY",items:["Agents","Multi-agent systems","Tools","Memory","Planning","Permission boundaries"]},
  {name:"SYSTEMS",items:["Python","FastAPI","Java","C/C++","JavaScript","SQL","APIs","Next.js"]},
  {name:"PRODUCTION",items:["AWS","Docker","CI/CD","MLOps","Evaluation","Monitoring","Observability"]},
  {name:"ANALYTICS",items:["scikit-learn","Power BI","Experimentation","Statistics","Data workflows"]}
];

export const profile={
  name:"Maharshi Patel",
  role:"AI Engineer — Intelligent Systems",
  location:"Paris, France",
  school:"aivancity — Grande École, AI & Data Science for Business",
  program:"PGE4 Alternance · AI & Data Science for Business",
  rhythm:"1 week school / 3 weeks company",
  priorEducation:"Ganpat University — Diploma in Information Technology",
  certification:"AWS Certified Machine Learning Engineer — Associate",
  languages:["English · Fluent","French · A2","Hindi · C2","Gujarati · C2"],
  focus:["Agentic AI","RAG","Document Intelligence","Knowledge Graphs","LLM Evaluation","MLOps","Applied ML"],
  principles:[
    "Evidence over plausibility",
    "Permission before action",
    "Evaluation before release",
    "Inspectable systems over black boxes"
  ],
  about:[
    "I work across the full AI-system surface: data, retrieval, models, agents, APIs, evaluation, infrastructure and product behaviour.",
    "My strongest interest is not a model in isolation, but the engineering around it — how it gets evidence, how it decides what it may do, how humans inspect it and how a team knows whether it is safe to release.",
    "I build independent portfolio systems with synthetic examples and explicit limitations so the work can be inspected without exposing employer code or confidential data."
  ],
  stats:[
    {value:"9",label:"PUBLIC AI SYSTEMS"},
    {value:"7",label:"AI / DATA MISSIONS"},
    {value:"4",label:"WORKING LANGUAGES"},
    {value:"1",label:"AWS ML CERTIFICATION"}
  ],
  github:"https://github.com/maharshimak",
  linkedin:"https://www.linkedin.com/in/maharshi-patel-6bb638298/",
  email:"mailto:pmaharshi999@gmail.com"
};
