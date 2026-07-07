# Max Simon — BTS Cloud Computing Portfolio

Personal portfolio, live at [max-netzwerk.work](https://max-netzwerk.work).
Built with [Astro](https://astro.build) — content lives in JSON data files, layout in reusable components.

## Development

```bash
npm install
npm run dev      # dev server at http://localhost:4321
npm run build    # static build into dist/
npm run preview  # preview the built site
```

## Project structure

```
src/
  data/          projects.json, skills.json, experience.json, visits.json
  components/    Nav, Footer, PageHeader, ProjectDetail, TimelineItem, CertCard
  layouts/       BaseLayout.astro (head, nav, footer, lightbox)
  pages/         one .astro file per page (built as /<name>.html)
  scripts/       main.js (client-side: nav, filters, accordion, lightbox, tabs)
  styles/        global.css
public/          static assets served as-is (img/, certificates/, Downloads/, flyer.html, CNAME)
scripts/         generate-flyer-pdf.mjs (renders public/flyer.html to PDF via puppeteer)
```

## Editing content

- **New project** → add an entry to `src/data/projects.json` (see existing entries for the section types: `text`, `tech`, `features`, `list`, `team`, `screenshots`, `downloads`).
- **Skills / certificates** → `src/data/skills.json`
- **Experience / visits** → `src/data/experience.json`, `src/data/visits.json`
- **BTS semester progress** → `src/pages/goal-bts.astro` (data arrays at the top of the file)

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds the site
and deploys `dist/` to GitHub Pages.

> **One-time setup:** in the repo settings under *Pages*, the source must be set to
> **GitHub Actions** (instead of "Deploy from a branch").
