# Portfolio V5 — The Impossible Observatory × Proof Foundry

This is the canonical design brief **for the isolated Observatory feature branch**.
The earlier "Galactic Systems" art direction is preserved in Git history and on the protected release branch.

## Objective
Create a singular, readable AI engineer portfolio that transforms an impossible
painted sky into a spatial observatory, then reveals the engineering discipline
behind nine independently inspectable AI systems and seven professional missions.

Emotional progression: curiosity → identity → discovery → controlled action →
verification → career experience → principles → invitation.

### Originality
Original stone geometry, brushed-brass mechanisms, physically motivated
project instruments, authored cloud painting and atmospheric materials.
Avoid HUD overlays, synthetic orbit guides, excessive particle effects,
borrowed branded imagery, copyrighted characters, unnecessary sound and
photographic art dependencies.

## Nine HTML chapter anchors / six spatial environments
| Journey progress | Anchor | Environment |
|---|---|---|
| 0–10% | departure | Cloud Threshold / painted observatory entrance |
| 10–18% | profile | Identity gallery with full HTML profile |
| 18–27% | foundation | Impossible Aperture: four-layer painting-to-world reveal |
| 27–39% | knowledge | Library / three traceable knowledge instruments |
| 39–51% | agency | Workshop / memory, tools and permissions |
| 51–63% | reliability | Inspection hall / testing, governance and ML operations |
| 63–77% | flight-log | Seven professional exhibit panels |
| 77–89% | principle | Monumental Knowledge–Agency–Reliability core |
| 89–100% | comms | Open Horizon and contact invitation |

Full narrative progress is anchored to the actual position of the relevant
HTML section, not an assumed proportional distribution of page height.

## Camera rules
One camera, one native scroll owner, deterministic motion state. Full journey
camera keyframes live in ThresholdScene.tsx. No autonomous scroll hijacking,
no endless ornamental animation loops. Every chapter is accessible directly
through regular hash links; reverse scroll reverses the motion.

Portal open: 20–24.5%; painted cloud depth fades during 23.7–26.7%;
Knowledge Chamber enters at 27%. Future art refinement should test camera
collision and panel visibility in screenshots instead of hiding scene swaps
behind flashes.

## Content preservation
Nine technical projects, seven professional missions, full About Me, aivancity
PGE4, Ganpat IT diploma, AWS certification, skills, languages, recruiter mode,
Atlas, full EN/FR pages and direct project dossier routes remain semantic HTML.
WebGL supplies depth only and is aria-hidden. Technical claims follow the
existing source data and should not be inflated.

## Render tiers
High <=1.5 DPR, medium <=1.25 DPR, low 1 DPR; low budgets use simplified
geometry. Reduced motion receives a static atmospheric fallback. Rendering
on the feature branch is demand-based with explicit invalidate signals for
scroll and camera damping. Hidden tabs do not continuously render.

## Performance / accessibility acceptance
- Render one Canvas, suspend idle and hidden work, release unused scene assets.
- Test 360/390 mobile, 1366 laptop, 1440 desktop and ultrawide.
- Keyboard, screen-reader, direct hashes, history and recruiter overlay.
- Test WebGL context loss, unavailable 3D, reduced motion and reduced data.
- Typecheck, Next.js static build, preservation contracts and visual QA.
- Evaluate real Web Vitals, dropped frames and GPU memory; do not claim unmeasured FPS.
- Preserve exact source/credential correctness; external site links require audit.

## Release process
Protected branches: main, v5-release; original portfolio repo untouched.
This work lives only on feature/v5-threshold-prototype-20261013.
No merge or production deployment without explicit user approval.
