# MAK’MA Labs engineering upgrade — 21 September 2026

A MAK’MA Studio delivery across all nine products. This report describes implemented behavior, not a claim of enterprise production readiness.

## Architecture and source of truth

`makma-ai-os/demo` owns the nine browser workspaces and their stable GitHub Pages URLs. Individual repositories own Python packages, Python tests, wheels and containers. Keeping one web deployment preserves existing links and avoids an unnecessary frontend migration.

The browser has three layers: `core.js` for escaped rendering and accessible controls; `domain.js` for pure validation and domain algorithms; `workbench.js` for run/reset/export/error/loading behavior. Product controllers implement distinct workflows. The obsolete unused frontend controller was removed. JavaScript and HTML were formatted for maintainability.

`backend-lock.json` pins immutable Python revisions for parity regeneration. `scripts/generate_parity.py` executes those Python implementations; Node tests compare browser vectors, rankings, scores, metrics, OLS, PSI, canary decisions and exact-byte SHA-256. Algorithms that intentionally differ are labeled in the UI and READMEs.

## Product changes

| Product | Previous weakness | Implemented useful workflow | Validation and regression protection | Boundary |
|---|---|---|---|---|
| MAK’MA AI OS | Narrow calculator demonstration; incomplete session export; invented provider latency component | Ordered remember/recall/calculator planning, persistent conversation and run history, complete JSON export, explicit local approval for deleting browser memory, measured tool timing, no-provider latency of zero | Safe arithmetic precedence, right-associative exponentiation and signed modulo; booleans rejected by Python; finite arithmetic; request bounds; storage failures handled; connection timeouts; memory/session interaction tests | Browser mode is deterministic and calls no LLM. FastAPI/provider connection remains optional; no backend service was provisioned by this release |
| Agentic RAG | Browser/backend divergence and weak comparison/validation | Text or JSON corpus editing, duplicate detection, strict retrieval parameters, stage scores, cited context, same-dataset baseline comparison, export and corpus reset | SHA-256/256-dimensional hash parity, Unicode and empty fixtures, BM25/RRF/reranker/ranking parity, no-judgment metric semantics, candidate count and unknown-ID rejection | Hashing is not learned semantics. Python additionally chunks/budgets context and supports model adapters |
| Knowledge Twin | Highest similarity could be accepted for nonsense | Thresholded resolution, exact-match label/top candidates, separate keyword search, directed neighborhood and shortest paths, inspectable nodes/edges/evidence, quality gate and export | Duplicate/missing entity fields, unknown endpoints, blank relations, traversal bounds, evidence/orphan/duplicate/component audit; Python shortest path and duplicate protections | Browser fuzzy score is Levenshtein + Jaccard; Python uses SequenceMatcher + Jaccard. Supplied evidence is not verified externally |
| Multimodal AI Studio | A few keyword outputs with no meaningful planning decision | Source/output-aware preflight, ordered operations, retiming/output frames, per-operation weighted workload, budget utilization, warnings, plan fingerprint and export | Empty/unsupported plans block; source/output/FPS/duration/speed/budget validation; operation/stage validation; render-budget rejection | No rendering. Workload is heuristic, not measured GPU time or VRAM. Python legacy estimate and browser output-aware v2 are explicitly separate |
| Clinical Document Intelligence | Extraction without practical human review; partial number parsing | Source highlights, raw/normalized values and offsets, structured record, corrections with separate provenance, completeness/evidence/schema metrics, quality gate, fingerprint and export | Whole-line parsing, empty fields cannot capture following lines, decimals/trailing count text cannot be truncated, invalid/missing fields block, correction fields validated | Synthetic document engineering only. No medical advice, OCR or clinical decision system. Browser offsets are UTF-16; Python offsets count code points |
| Secure Data Copilot | Displayed SQL suggested execution that actually used fixed handlers | Editable data and sample/starter selection, real local plan execution over supplied rows, schema/SQL/safety/risk/privacy inspection, numerical summaries, CSV/JSON exports | All listed mutation/admin intents rejected, JSON/data/ID/reference/date/amount bounds, actual row limits, safe table rendering and formula-neutralized CSV; Python planner confidence is null rather than a fabricated probability | Browser executes a structured query plan; Python executes SQLite. Four question families, no unrestricted language-to-SQL model |
| LLM Eval & Observability | Single-answer scoring lacked a release decision | Baseline/candidate case datasets, per-case evidence/failure reasons, supplied cost/latency/token observations, sample/pass/p95/cost SLOs, Wilson confidence interval, regression gate and export | Same case definitions required for comparison, unique case IDs, finite prices/tokens/latencies, forbidden-output block, successes <= samples, citation regression gate in Python | Deterministic relevance proxy, no semantic judge or live inference. Separate manual reliability population cannot change the case-derived release decision |
| MLOps Control Plane | Disconnected numerical controls | Candidate identity, multiple directional evaluation metrics, production deltas, promotion/drift/canary/rollback orchestration and exportable governance manifest | Required metadata, unique metrics, finite values, integer requests/traffic and bounded probabilities; failed promotion/critical drift cannot advance traffic | Evaluates policy; does not deploy or change traffic. URI/fingerprint metadata and snapshots are supplied, not remotely verified |
| MLOps Production Pipeline | Coefficients and metrics without meaningful lifecycle integrity | Editable train/held-out data, OLS predictions/MAE/PSI, exact-byte artifact digest, tamper testing, combined deployment gate and current manifest/export | Constant/nonfinite features reject, distribution totals cannot overflow, quality/sample thresholds block; Python integrity_valid=False blocks; edited artifacts immediately invalidate approval | One-feature OLS, no actual deployment or signed registry. Digest equality establishes byte identity against a supplied reference, not trust |

## Correctness, safety and accessibility

- User configuration is rejected explicitly instead of silently clamped. Shared validation covers required text, finite bounded numbers, integers, probabilities, JSON, array lengths and distribution totals.
- RAG internal empty-judgment convention matches Python: recall=1, precision=0, MRR=0, hit=0. The UI reports N/A because no judgments cannot support a meaningful quality conclusion.
- Baseline comparisons do not silently mix different RAG corpora/queries/judgments or evaluation case definitions.
- Text, errors, trace entries and table cells are escaped before rendering. There is no arbitrary JavaScript, shell or code execution path.
- Artifact edits invalidate the gate and update the manifest/export. A substituted digest cannot approve a different artifact as the current training result.
- CSV spreadsheet formula prefixes are neutralized. Data queries fail closed on write/administrative intent.
- Controls have associated labels; dynamic results expose live status and busy states; table headers have column scope; focus indicators and text verdicts complement color. Desktop and mobile interaction suites exercise both layouts.
- Asset versions derive from content hashes at build time. `release.json` records the deployed commit and asset digests; manual `?v=2` updates are no longer the cache strategy.

## Test inventory and execution evidence

Python regression inventory:

| Repository | Tests |
|---|---:|
| makma-ai-os | 31 |
| agentic-rag-engine | 24 |
| multimodal-ai-studio | 10 |
| knowledge-twin | 9 |
| clinical-document-intelligence | 11 |
| secure-data-copilot | 33 |
| llm-eval-observability | 19 |
| mlops-control-plane | 21 |
| mlops-production-pipeline | 14 |
| **Total Python** | **172** |

Web inventory: **20 Node domain/parity tests** plus **27 Playwright scenarios in two projects (desktop Chromium and mobile Chromium), 54 executions**. This is 246 test executions, not 246 independently distinct scenarios. The suites cover changed inputs, good results, invalid inputs, forbidden data operations, artifact tampering, persistence, export, and hostile HTML cell content.

The initial release `53ed377bd04c3dac4f296d407456b69c3490a244` passed the then-current 52 browser executions and deployed successfully. Its post-deployment job verified the exact release SHA and HTTP application markers on all nine products plus the hub. The follow-up adds the final administrative-intent and hostile-markup checks and fixes the stale artifact manifest discovered in the live audit.

Use [the Actions history](https://github.com/maharshimak/makma-ai-os/actions) for the authoritative status of the commit containing this report. Each backend's Python CI runs lint, unit/regression tests, wheel and Docker builds. The Pages workflow runs Python quality, pinned backend parity, JavaScript checks, build, desktop/mobile interactions, deployment and public HTTP verification. Publishing is blocked when its pre-deploy checks fail.

The dependency stack currently emits FastAPI/Starlette/httpx deprecation warnings in tests; these do not fail the suite and are not hidden. A dependency compatibility update is worthwhile before those deprecated interfaces are removed.

## Live audit observations

The first deployed version was exercised directly in a browser across all nine products. Observed examples included:

- Flagship: remember deployment region and calculate 8200 / 4 as two ordered tool steps, producing 2050; recall returns the stored fact.
- RAG: Candidate K below Top K rejects with the explicit configuration error.
- Graph: an unknown nonsense name produces “No confident entity resolution”.
- Media: unsupported intent produces PREFLIGHT BLOCK rather than a successful empty plan.
- Clinical: negative participant correction produces a quality block with the exact validation reason.
- Data: DROP intent is rejected before local execution.
- Evaluation: an unrealistically low latency threshold blocks the candidate with reasons.
- Control plane: a high candidate error rate recommends rollback and zero candidate traffic.
- Pipeline: changed artifact bytes produce INTEGRITY FAILED and DEPLOYMENT BLOCKED. The audit also identified and corrected a stale manifest display.

## Remaining limitations and next high-value engineering work

1. **Hosted, authenticated backend integration.** Static Pages hosts the browser products. It does not host FastAPI services, inference, render workers or rollout infrastructure. Add authenticated session-scoped APIs, storage and provider integration tests before exposing real customer data.
2. **Measured data and calibrated decisions.** Add versioned labeled retrieval/evaluation/extraction benchmarks and calibrated hardware render profiles. Synthetic examples and user-supplied observations must remain labeled.
3. **Eliminate selected mode differences.** Prioritize embedded read-only SQLite, one shared media workload contract and one entity-resolution implementation. The current differences are explicit and tested where mathematical equivalence is claimed.
4. **Trusted provenance.** Add signed model/artifact manifests, immutable evaluation datasets and durable human-review audit records. A local SHA-256 digest alone is not an authenticity guarantee.
5. **Broader runtime compatibility.** Add Firefox/WebKit and a dedicated automated accessibility audit, then test real provider adapters and production-like datasets. Current browser coverage is Chromium desktop/mobile.

These are future improvements. No real model inference, media rendering, production traffic switching or enterprise deployment is claimed by this release.
