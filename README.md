# Atoll Navigator

Sliding-maze puzzle & economy simulator for a summer camp game.
Built with React + Recharts, deployed to GitHub Pages via Vite.

## Live demo

https://kolejarz.github.io/AtollSim/

## Local development

```bash
npm install
npm run dev       # starts dev server at localhost:5173
```

## Deploy to GitHub Pages

```bash
npm run build     # compiles into docs/
git add -A && git commit -m "build" && git push
```

GitHub Pages must be configured to serve from the `docs/` folder on the `master` branch
(Settings → Pages → Source: "Deploy from a branch" → Branch: `master`, folder: `/docs`).
