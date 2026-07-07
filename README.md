# The Ekram Method — landing site

Source for **[ekrammethod.com](https://ekrammethod.com)**, the landing page for *The Ekram Method: Positioning to Win in the AI Era* — a free field manual on positioning for founders.

> Anyone can build now. Almost no one gets chosen. When execution is free, positioning is the only edge left.

The book is the collected thinking of [@ekrahm](https://x.com/ekrahm), compiled by [@somonaut](https://x.com/somonaut).

## What's here

A single, self-contained static site — no build step, no framework.

- `index.html` — the entire page (inline CSS, hero, 3D book-cover object, colophon)
- `downloads/` — the free book PDF (`The-Ekram-Method.pdf`, ~0.8 MB, no signup)
- `assets/` — Open Graph / Twitter share card
- `fonts/` — self-hosted web fonts (Jost, Source Serif 4, Anton, IBM Plex Mono)
- favicons + `apple-touch-icon.png`
- `vercel.json` — deploy configuration

## Design

Editorial and print-inspired: near-white paper, ink black, and a single oxblood-red accent (`#DA1C27`) reserved for the book cover — the one object of color on the page. The cover renders the method's core visual, an "invisible -> inevitable" axis.

## Deploy

Static site hosted on Vercel with Web Analytics. Every push to `main` auto-deploys to [ekrammethod.com](https://ekrammethod.com).

## Related

- Agent skill: [positioning-products on skills.sh](https://www.skills.sh/soheilmomeniii/positioning-products/positioning-products)
