# V5 browser quality gate

The `Portfolio V5 Visual QA` GitHub Actions workflow builds the static Next.js
export, serves it locally, and exercises the **actual exported HTML and assets**
in headless Chromium. It is a release gate on `v5-release`, not proof of
production deployment.

## What is checked

- Desktop (1440 px), laptop, and mobile viewport layout; English hero, profile,
  foundation, project cards, experience, atlas, recruiter cut, contact sections
- French overview and representative project-dossier routes
- Serious/critical WCAG violations (axe-core), project actions and readable
  contrast, clipped content and document-level horizontal overflow
- Project card/inspector interactions, modal close behavior, and render errors
- **Keyboard safety:** typing `r` or `a` into an input must not activate the
  global recruiter/atlas shortcuts
- **Idle scroll performance:** after the page settles, fewer than five
  `--journey` style-property writes may occur during a 750 ms idle interval

Run locally using the same commands as `.github/workflows/portfolio-v5-visual.yml`
from `v5/`: install dependencies, install Chromium for Playwright, run
`npm run build`, serve `out/` at localhost:3000, then run
`node scripts/visual-qa.mjs`.

## Performance and design boundaries

V5 uses **real** NASA/ESA/CSA/JPL imagery, Three.js physically shaded worlds,
subtle atmospheric light and animated moons. The approved art direction
specifically excludes synthetic orbit guides and decorative HUD elements.
Quality automatically degrades on small or constrained devices; the planet
textures request right-sized assets. The page does not autoplay sound.

The scroll controller eases camera progress **only when needed**, instead of
writing CSS variables continuously while idle. Background WebGL rendering
still incurs GPU load; the automated idle-DOM check is **not** a GPU or
battery-use benchmark.

## Remaining manual checks before release

1. Inspect real screenshots at common mobile widths, ultrawide desktops,
   low-powered laptops, Safari and Firefox; automated CI currently uses Chromium.
2. Test an actual low-memory device, coarse pointer, reduced-motion preference,
   and reduced-data connection; validate perceived smoothness and initial load.
3. Verify NASA asset availability, model licensing, attribution and recovery
   from external CDN failures.
4. Check all public GitHub, live-demo, recruiter and CV URLs.
5. Compare the released static site against the preview and request explicit
   approval before merging the V5 release PR or deploying to production.

A passing CI build does **not** imply that these manual acceptance tests were run.
