export type Project = {
  name:string;
  slug:string;
  family:string;
  summary:string;
  purpose:string;
  architecture:string[];
  stack:string[];
  repoUrl:string;
  liveUrl?:string;
};

export const projects:Project[]=[
  {
    name:"Mak'ma AI OS",
    slug:"makma-ai-os",
    family:"Agency / orchestration",
    summary:"A personal AI runtime built around memory, planning, permissioned tools, observability and durable workflows.",
    purpose:"Make agent behavior inspectable and controllable instead of hiding tool use behind a chat box.",
    architecture:["Input","Memory","Planner","Permission gate","Tool bus","Execution","Telemetry"],
    stack:["Python","FastAPI","SQLite","Agents"],
    repoUrl:"https://github.com/maharshimak/makma-ai-os",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/"
  },
  {
    name:"Agentic RAG Engine",
    slug:"agentic-rag-engine",
    family:"Knowledge / retrieval",
    summary:"An inspectable hybrid retrieval pipeline with lexical and vector search, fusion, reranking, citations and evaluation.",
    purpose:"Make retrieval quality measurable and understandable.",
    architecture:["Query","BM25","Vector","RRF","Rerank","Evidence","Response"],
    stack:["Python","FastAPI","BM25","RRF"],
    repoUrl:"https://github.com/maharshimak/agentic-rag-engine",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/agentic-rag-engine/"
  },
  {
    name:"Multimodal AI Studio",
    slug:"multimodal-ai-studio",
    family:"Agency / media",
    summary:"A natural-language media planning system that turns creative instructions into ordered, inspectable operations.",
    purpose:"Treat multimodal generation as a controllable pipeline instead of a single opaque prompt.",
    architecture:["Instruction","Intent parse","Media plan","Operations","Validation","Output"],
    stack:["Python","Multimodal","Planning","Pipelines"],
    repoUrl:"https://github.com/maharshimak/multimodal-ai-studio"
  },
  {
    name:"Knowledge Twin",
    slug:"knowledge-twin",
    family:"Knowledge / graph",
    summary:"An evidence-bearing entity and relationship graph for traversal, retrieval and knowledge-centric AI workflows.",
    purpose:"Represent knowledge as inspectable relationships with provenance.",
    architecture:["Evidence","Entities","Resolution","Graph store","Traversal","Retrieval"],
    stack:["Graph","SQLite","Retrieval","Evidence"],
    repoUrl:"https://github.com/maharshimak/knowledge-twin",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/knowledge-twin/"
  },
  {
    name:"Clinical Document Intelligence",
    slug:"clinical-document-intelligence",
    family:"Knowledge / document AI",
    summary:"A document extraction and validation pipeline for structured study fields with evidence and review provenance.",
    purpose:"Extract structured information without losing the exact source evidence.",
    architecture:["Document","Parse","Extract","Validate","Human review","Provenance"],
    stack:["Document AI","FastAPI","Extraction","Validation"],
    repoUrl:"https://github.com/maharshimak/clinical-document-intelligence",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/clinical-document-intelligence/"
  },
  {
    name:"Secure Data Copilot",
    slug:"secure-data-copilot",
    family:"Agency / data safety",
    summary:"A read-only analytics copilot with deterministic planning, SQL restrictions, bounded results and auditable query metadata.",
    purpose:"Let an AI assistant work with data while preserving explicit safety boundaries.",
    architecture:["Question","Planner","Policy gate","SQL","Bounded result","Audit"],
    stack:["Python","SQLite","Guardrails","Analytics"],
    repoUrl:"https://github.com/maharshimak/secure-data-copilot"
  },
  {
    name:"LLM Eval & Observability",
    slug:"llm-eval-observability",
    family:"Reliability / evaluation",
    summary:"An experiment and release-evaluation workstation for quality, citations, latency, cost and regressions.",
    purpose:"Detect model or RAG regressions that still return successful HTTP responses.",
    architecture:["Dataset","Candidate run","Metrics","Budget gate","Trace","Release"],
    stack:["Evaluation","Observability","FastAPI","SLOs"],
    repoUrl:"https://github.com/maharshimak/llm-eval-observability",
    liveUrl:"https://maharshimak.github.io/makma-ai-os/projects/llm-eval-observability/"
  },
  {
    name:"MLOps Control Plane",
    slug:"mlops-control-plane",
    family:"Reliability / governance",
    summary:"A model registry with evaluation gates, controlled promotion, dataset fingerprints and drift checks.",
    purpose:"Make promotion decisions explicit, repeatable and observable.",
    architecture:["Model","Evaluate","Register","Gate","Promote","Monitor"],
    stack:["Python","MLOps","Registry","Governance"],
    repoUrl:"https://github.com/maharshimak/mlops-control-plane"
  },
  {
    name:"MLOps Production Pipeline",
    slug:"mlops-production-pipeline",
    family:"Reliability / lifecycle",
    summary:"Production ML lifecycle building blocks with deterministic training, held-out evaluation, quality gates and drift monitoring.",
    purpose:"Treat model delivery as a lifecycle rather than a notebook export.",
    architecture:["Data","Train","Evaluate","Gate","Deploy","Monitor","Drift"],
    stack:["Python","ML","CI/CD","Monitoring"],
    repoUrl:"https://github.com/maharshimak/mlops-production-pipeline"
  }
];

export const experience=[
  {period:"Oct 2023 — Jan 2024",company:"Substrate AI",role:"Data Analytics Intern",signal:"Analytics / experimentation"},
  {period:"Jan — Mar 2024",company:"X & Y Corp",role:"NLP & Algorithm Developer",signal:"NLP / algorithms"},
  {period:"Jul — Sep 2024",company:"Algo Ético",role:"PM & Data Analyst",signal:"Responsible AI"},
  {period:"Sep — Dec 2024",company:"CMI Strategies",role:"Data Analyst",signal:"Data / decision systems"},
  {period:"Jan — Aug 2025",company:"Pangea Summit",role:"ML Engineer",signal:"RAG / agents / knowledge"},
  {period:"Oct 2025 — Jan 2026",company:"FPT Software",role:"AI Developer",signal:"Applied AI systems"},
  {period:"Jan — Apr 2026",company:"CERC",role:"AI Engineer",signal:"Clinical document intelligence"}
];

export const skillSystems=[
  {name:"INTELLIGENCE",items:["LLMs","NLP","Prompting","Embeddings","Model behaviour"]},
  {name:"KNOWLEDGE",items:["RAG","Semantic search","Vector retrieval","Knowledge graphs","Reranking"]},
  {name:"AGENCY",items:["Agents","Multi-agent systems","Tools","Memory","Planning"]},
  {name:"SYSTEMS",items:["Python","FastAPI","APIs","SQL","Backend architecture"]},
  {name:"PRODUCTION",items:["AWS","Docker","CI/CD","MLOps","Evaluation","Monitoring"]}
];

export const profile={
  name:"Maharshi Patel",
  role:"AI Engineer — Intelligent Systems",
  location:"Paris, France",
  school:"aivancity — Grande École, AI & Data Science for Business",
  certification:"AWS Certified Machine Learning Engineer — Associate",
  github:"https://github.com/maharshimak",
  linkedin:"https://www.linkedin.com/in/maharshi-patel-6bb638298/",
  email:"mailto:pmaharshi999@gmail.com"
};
