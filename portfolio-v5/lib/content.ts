export const projects = [
  {
    name: "MAK'MA AI OS",
    domain: "Agent runtime / orchestration",
    summary: "A permissioned personal AI runtime with memory, provider routing, typed tools, audit history and durable workflows.",
    proof: "Persistent memory · permissioned tools · pause/resume workflows",
    stack: ["Python", "FastAPI", "SQLite", "Tool runtime"],
    architecture: ["Prompt / event", "Planner", "Permission gate", "Tool bus", "Memory + telemetry"],
    challenge: "Build a personal AI runtime whose planning, memory and tool use can be inspected instead of hidden behind a chat box.",
    implemented: ["SQLite-backed session memory and audit history", "Typed permissioned tool registry with approval gates", "Deterministic / hybrid / schema-constrained planning", "Durable dependency-aware workflows with pause and resume"],
    boundary: "The browser demo is deliberately deterministic; high-risk shell, filesystem and autonomous mutation tools are not enabled by default.",
    slug: "makma-ai-os",
    liveUrl: "https://maharshimak.github.io/makma-ai-os/",
    repoUrl: "https://github.com/maharshimak/makma-ai-os",
    accent: "#ff9b54"
  },
  {
    name: "Agentic RAG Engine",
    domain: "Retrieval / evaluation",
    summary: "An inspectable retrieval laboratory with lexical + semantic ranking, fusion, reranking, citations and evaluation.",
    proof: "BM25 + semantic retrieval · RRF · rerank · Recall/MRR/Hit Rate",
    stack: ["Python", "FastAPI", "BM25", "RRF"],
    architecture: ["Query", "Lexical + semantic", "RRF fusion", "Rerank", "Context + evaluation"],
    challenge: "Make retrieval quality observable so engineers can see why evidence was ranked and whether changes actually improve answers.",
    implemented: ["Document chunking plus BM25 lexical retrieval", "Semantic retrieval and reciprocal-rank fusion", "Transparent reranking and context budgeting", "Recall@K, Precision@K, MRR and Hit Rate evaluation"],
    boundary: "The reproducible offline embedding path uses lexical hashing rather than a trained semantic model; learned reranking remains a future adapter.",
    slug: "agentic-rag-engine",
    liveUrl: "https://maharshimak.github.io/makma-ai-os/projects/agentic-rag-engine/",
    repoUrl: "https://github.com/maharshimak/agentic-rag-engine",
    accent: "#78d8ff"
  },
  {
    name: "Knowledge Twin",
    domain: "Knowledge systems",
    summary: "An evidence-bearing entity and relationship graph for traversal, inspection, search and data-quality workflows.",
    proof: "Directed BFS · shortest paths · evidence strings · SQLite persistence",
    stack: ["Graph", "SQLite", "Evidence", "Resolution"],
    architecture: ["Evidence", "Entity resolution", "Graph store", "Traversal", "Audit"],
    challenge: "Represent relationships as evidence-bearing graph structure that a human can inspect, traverse and audit.",
    implemented: ["Typed entities and directed relationships", "Directed BFS neighborhoods and shortest paths", "Keyword / fuzzy matching with explicit scoring modes", "Optional SQLite persistence for graph state"],
    boundary: "There is no dedicated graph database or automatic ontology inference; evidence supplied by the user is preserved but not independently verified.",
    slug: "knowledge-twin",
    liveUrl: "https://maharshimak.github.io/makma-ai-os/projects/knowledge-twin/",
    repoUrl: "https://github.com/maharshimak/knowledge-twin",
    accent: "#c7a6ff"
  },
  {
    name: "Clinical Document Intelligence",
    domain: "Document AI",
    summary: "Evidence-grounded study metadata extraction with validation, source spans and human-review provenance.",
    proof: "Evidence spans · correction provenance · validation gate · optional Docling",
    stack: ["Document AI", "Docling", "FastAPI", "Provenance"],
    architecture: ["Document", "Parse", "Extract", "Validate", "Human review + provenance"],
    challenge: "Extract study metadata without losing the exact source evidence or the history of human corrections.",
    implemented: ["Structured clinical-study field extraction", "Verbatim evidence spans and normalized values", "Validation gates and human-correction provenance", "Optional model-backed extraction and Docling ingestion"],
    boundary: "The project uses synthetic examples and is a document-engineering demonstration, not a medical diagnosis or clinical decision system.",
    slug: "clinical-document-intelligence",
    liveUrl: "https://maharshimak.github.io/makma-ai-os/projects/clinical-document-intelligence/",
    repoUrl: "https://github.com/maharshimak/clinical-document-intelligence",
    accent: "#ffcf70"
  },
  {
    name: "LLM Eval & Observability",
    domain: "Quality / telemetry",
    summary: "A release-evaluation workstation for comparing LLM/RAG candidates across quality, latency, cost and regressions.",
    proof: "Regression budgets · p95/cost/pass-rate · trace store · semantic judge adapter",
    stack: ["Eval", "SLOs", "FastAPI", "Observability"],
    architecture: ["Dataset", "Candidate run", "Metrics", "Budget gate", "Trace + release"],
    challenge: "Catch LLM and RAG regressions that still return HTTP 200 but become slower, more expensive or less useful.",
    implemented: ["Batch evaluation cases and versioned datasets", "Latency, cost, pass-rate and citation metrics", "Regression budgets and release-quality gates", "JSONL traces plus an optional semantic judge adapter"],
    boundary: "Citation checks validate identifiers, not factual entailment; the project is an evaluation workstation rather than a continuous production telemetry platform.",
    slug: "llm-eval-observability",
    liveUrl: "https://maharshimak.github.io/makma-ai-os/projects/llm-eval-observability/",
    repoUrl: "https://github.com/maharshimak/llm-eval-observability",
    accent: "#8af0c7"
  }
] as const;

export const flightLog = [
  {
    year:"2023–24",
    company:"Substrate AI",
    role:"Data Analytics Intern",
    span:"Oct 2023 — Jan 2024",
    capability:"Analytics / experimentation",
    note:"Early applied analytics work across data preparation, analysis and reporting.",
    tags:["Analytics","Data","Reporting"]
  },
  {
    year:"2024",
    company:"X & Y Corp",
    role:"NLP & Algorithm Developer",
    span:"Jan — Mar 2024",
    capability:"NLP / Algorithms",
    note:"Built language-processing and algorithmic prototypes at the intersection of NLP and software logic.",
    tags:["NLP","Algorithms","Python"]
  },
  {
    year:"2024",
    company:"Algo Ético",
    role:"PM & Data Analyst",
    span:"Jul — Sep 2024",
    capability:"Responsible AI",
    note:"Worked across delivery, analysis and responsible-AI context, connecting technical work with project constraints.",
    tags:["Responsible AI","Analysis","Delivery"]
  },
  {
    year:"2024",
    company:"CMI Strategies",
    role:"Data Analyst",
    span:"Sep — Dec 2024",
    capability:"Data analysis",
    note:"Turned business questions into structured analysis, data outputs and decision-ready reporting.",
    tags:["Data Analysis","Business","Reporting"]
  },
  {
    year:"2025",
    company:"Pangea Summit",
    role:"ML Engineer",
    span:"Jan — Aug 2025",
    capability:"RAG / Knowledge",
    note:"Worked on RAG Digital Knowledge, a Knowledge Twin, compliance workflows, agentic tools, evaluation and dashboards.",
    tags:["RAG","Agents","Knowledge Graph","Evaluation"]
  },
  {
    year:"2025–26",
    company:"FPT Software",
    role:"AI Developer",
    span:"Oct 2025 — Jan 2026",
    capability:"AI development",
    note:"Remote AI development across applied model workflows, software integration and production-minded experimentation.",
    tags:["AI","Software","Remote"]
  },
  {
    year:"2026",
    company:"CERC",
    role:"AI Engineer",
    span:"Jan — Apr 2026",
    capability:"Clinical document intelligence",
    note:"Built clinical-trial document mapping, extraction and knowledge-base workflows with evidence and structured outputs.",
    tags:["Document AI","Extraction","Knowledge Base"]
  }
] as const;

export const profile = {
  name: "Maharshi Patel",
  role: "AI / Data Engineer",
  school: "aivancity · Paris",
  github: "https://github.com/maharshimak",
  linkedin: "https://www.linkedin.com/in/maharshi-patel-6bb638298/",
  email: "mailto:pmaharshi999@gmail.com"
};
