# Persocal

Static copy of [persocal.com](https://www.persocal.com), rebuilt page by page from the live site.

Every page lives at its original path (`about/index.html`, `destinations/albania/index.html`, ...). All images, fonts, stylesheets and scripts are stored under `_assets/` and referenced with relative paths, so the site works from any host or sub-folder.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Deploy

In the repository settings, open **Pages** and set the source to **Deploy from a branch**, choosing this branch and the `/ (root)` folder. GitHub then publishes the site at `https://benjamingjoel2.github.io/new/`.

If the source is set to **GitHub Actions** instead, run the manual workflow in `.github/workflows/pages.yml`.

## Vercel

Import this repository at https://vercel.com/new, keep the framework preset on **Other** and leave the build settings empty. `vercel.json` marks the site as static with trailing-slash URLs. Set the project's production branch to `claude/dazzling-sagan-t07wfp` under Settings, then Git.
