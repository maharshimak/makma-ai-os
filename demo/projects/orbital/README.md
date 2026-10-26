# MAK'MA Orbital Experience — unpublished design branch

A self-contained, original cinematic storytelling experiment for the existing MAK'MA Labs Projects hub.

## Scope

- Route after an approved merge: /makma-ai-os/projects/orbital/
- Preserves the current /projects/ hub and all nine existing live tool routes.
- Uses an original scroll-chapter implementation, original MAK'MA copy, and original generated cinematic background assets.
- Inspired by the general cinematic journey and orbital-to-compute storytelling category exemplified by Edolus, but not a copy of its code, trademarks, 3D models, audio or artwork.
- Uses plain HTML, CSS, and JavaScript; no new runtime dependency or server is required.
- No production deployment is included in this branch until explicitly approved.

## Features

1. Asset-aware intro and initiate experience
2. Six scroll chapters, progress markers and background transitions
3. All nine system links in chapter narratives and searchable directory
4. User-initiated optional synthesized ambient audio
5. Responsive mobile, reduced-motion mode and semantic dialog
6. Lightweight background canvas particles

## Honest limitations

This is an original cinematic first implementation, not a pixel-identical recreation of Edolus's proprietary real-time 3D film. The scenes use 2D cinematic images and coded parallax transitions rather than an interactive 3D camera. Individual linked tools remain the existing GitHub Pages browser demos, not hosted AI backends. Visual quality and actual mobile/battery performance require browser review before any release.

## Development / validation

Run from repository root:

- npm ci
- npm run build
- npm run test:e2e

Entry files: demo/projects/orbital/index.html, style.css, app.js, and assets/*.png.
