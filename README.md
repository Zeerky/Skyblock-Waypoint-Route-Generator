# Project Showcase (GitHub Pages)

This repo is structured as a **showcase homepage** plus individual project apps.

## Structure

- `Showcase/` — static homepage (`site.json` for branding, `projects.json` for cards)
- `RouteFinder/` — Coal Route Finder app (Vite + React)

GitHub Pages deploy:
- Homepage at `/<repo>/`
- RouteFinder at `/<repo>/routefinder/`

## Adding a new project later

1. Create a new folder at repo root for the app (example `MyCoolTool/`).
2. Ensure it builds into `dist/` (or adjust the workflow copy step).
3. Add it to `Showcase/projects.json` with an `href` like `./mycooltool/`.
4. Update `.github/workflows/deploy-pages.yml` to build + copy it into `dist/mycooltool/`.

