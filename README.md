# noahcarpenter.me

Personal site and projects. Plain static HTML — no build step.

## Structure

- `index.html` — homepage
- `state-slam.html` — State Slam (50-states game)
- `noah.webp` — header artwork
- `404.html` — not-found page

## Adding a project

1. Drop the project's HTML file in the root (or a folder with its own `index.html`).
2. Add a card to the `<ul class="projects">` grid in `index.html`, above the
   `<li class="empty">` placeholder:

```html
<li>
  <a class="project" href="your-project.html">
    <h2>Project Name</h2>
    <p>One line about what it does.</p>
  </a>
</li>
```

3. Commit and push. Cloudflare Pages deploys automatically.

The grid is `repeat(auto-fit, minmax(240px, 1fr))`, so cards reflow from one
column on a phone to two or three as you add them. Delete the
`<li class="empty">More on the way.</li>` cell once you have enough projects.

## Local preview

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173
