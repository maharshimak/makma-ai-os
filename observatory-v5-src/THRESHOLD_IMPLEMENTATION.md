# Observatory feature branch — implementation review

## Status
Implementation present on branch feature/v5-threshold-prototype-20261013.
Based on protected v5-release starting commit 5ad78edeba74a5fff8e850f102a832fbd720d623.
Not merged or deployed. CI/test conclusions must be checked on the exact final head.

## What is built
1. Original procedural cloud painting and monumental stone/brass observatory
   (ThresholdScene.tsx).
2. Hinged mechanical portal with continuous camera travel into the first room.
3. Full 0–100% camera keyframes and real chapter-anchor synchronization.
4. Nine project-specific installations across knowledge, agency and reliability
   (ObservatoryChapters.tsx).
5. Seven physical exhibits in the professional Flight Log gallery.
6. Central engineering-principle instrument and final Open Horizon.
7. Single R3F canvas, High/Medium/Low quality, demand-driven rendering,
   tab suspension, and static reduced-motion fallback.
8. Observatory CSS design system for desktop/mobile and authored local case
   study backgrounds. Production art is not fetched from third-party media CDNs.
9. All existing nine project dossiers, experience, profile, Atlas,
   Recruiter Cut, links and EN/FR pages retained.

## Code entry points
- v5/components/SynthesisPortfolio.tsx — semantic document and scroll source
- v5/components/WorldCanvas.tsx — one canvas, quality governor, invalidation
- v5/components/ThresholdScene.tsx — original entrance and shared camera
- v5/components/ObservatoryChapters.tsx — scene scheduler and all other rooms
- v5/app/observatory.css — final art direction and responsive treatment
- v5/lib/content.ts — canonical portfolio claims
- v5/scripts/threshold-validation.mjs — preservation contracts
- v5/scripts/visual-qa.mjs — exported-site browser tests

## Manual quality checklist before release
- Inspect scene at chapter boundaries in forward and reverse scroll.
- Validate portrait/mobile framing and topbar controls.
- Verify page-wide/active chapter text geometry on 1366×768 laptop.
- Test no WebGL, reduced motion, keyboard navigation, Safari and Firefox.
- Inspect screenshot coherence and project exhibit differentiation.
- Measure Web Vitals and actual GPU work. Targets are not measured results.
- Verify all external GitHub, demo, LinkedIn and CV links. The existing
  versioned CV link was preserved until a confirmed current destination exists.
- Review all repository project claims for factual accuracy.
- Create a rollback plan and request separate deployment approval.

## Explicit limitations
The site has not been visually inspected through a live preview in this
connector-only implementation session. GitHub Actions can typecheck, build
and run automated Chromium checks; that does not replace artistic/real-device
inspection. Scenes are original procedural implementations, not pre-rendered
cinematic assets or proof of observed FPS.
