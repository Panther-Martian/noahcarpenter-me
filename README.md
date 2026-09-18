# noahcarpenter.me

Personal site and projects. Plain static HTML — no build step.

## Structure

- `index.html` — homepage
- `state-slam.html` — State Slam (50-states game)
- `404.html` — not-found page

## Adding a project

1. Drop the project's HTML file in the root (or a folder with its own `index.html`).
2. Add a card to the `<ul class="projects">` list in `index.html`:

```html
<li>
  <a class="project" href="your-project.html">
    <h3>Project Name</h3>
    <p>One line about what it does.</p>
  </a>
</li>
```

3. Commit and push. Cloudflare Pages deploys automatically.

## Local preview

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173
