# noahcarpenter.me

Personal site and projects. Plain static HTML served by a Cloudflare **Worker**,
with one dynamic route for the shared leaderboard. No build step, no
dependencies — do not add a `package.json` unless you also configure the build,
or deploys break.

This is a Worker, not a Pages project. The Pages-only `functions/` directory
convention does **not** apply here; routes are wired explicitly in
`worker.js`. Configuration lives in `wrangler.jsonc`.

## Structure

- `wrangler.jsonc` — Worker config: entry point, assets directory, KV binding
- `worker.js` — entry point; routes `/api/scores`, serves everything else from `public/`
- `src/scores.js` — leaderboard API handlers
- `public/` — everything served as static files:
  - `index.html` — homepage
  - `404.html` — not-found page
  - `skull.webp` — header artwork
  - `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` — site icons
  - `map-slam.html` — Map Slam (tap each state, name it)
  - `list-race.html` — List Race (type all 50 from memory)
  - `collection-organizer.html` — MTG Card Organizer, Collection tab (the entry point)
  - `stack-organizer.html` — MTG Card Organizer, Stack tab
  - `game.css` — shared styling for both games
  - `game.js` — shared helpers, the name gate, the leaderboard client
  - `states.js` — state names + SVG paths (Map Slam only, ~107KB)
  - `state-names.js` — just the 50 names (List Race only)
- `test/scores.test.mjs` — tests for the leaderboard API
- `test/worker.test.mjs` — tests for request routing

## The leaderboard

Scores are shared by everyone and live in a Workers KV namespace, one key per
game (`board:map-slam`, `board:list-race`), each holding the top 10.

### One-time setup

Both are already done. The namespace `noah-scores`
(id `6e18c86b2347477d8413da094cbd0eca`) exists, and the binding is declared in
`wrangler.jsonc`, so it is recreated on every deploy rather than depending on
dashboard state.

Until that binding exists the API returns `leaderboard-unconfigured` and the
games display "Leaderboard isn't switched on yet." They stay fully playable —
only the board is missing.

### API

```
GET  /api/scores?game=map-slam     -> { ok: true, rows: [...] }
POST /api/scores                   -> { ok: true, rows: [...] }
     body: { game, name, ms, score }   (score is Map Slam only)
```

Map Slam ranks by score descending, time breaking ties. List Race ranks by
time ascending, and only records a clean sweep of all 50.

Validation is deliberately light — this board is for friends. The server caps
name length, collapses whitespace, and range-checks the numbers so junk can't
corrupt the stored array, but it does not stop someone determined to POST a
fake score by hand.

Writes are read-modify-write against KV and are not atomic, so two people
finishing in the same instant could drop one entry. Fine at this scale.

### Tests

```bash
node test/scores.test.mjs
node test/worker.test.mjs
```

There is deliberately no `package.json` and no lockfile. Cloudflare Pages
tries to install and build anything that looks like a Node project, and this
site has nothing to build — leave the build command empty and the output
directory `/`. The test loads the Function source directly so the repo can
stay zero-config.

Runs the API against an in-memory stand-in for KV — ordering, the top-10 cap,
name shaping, bad input, and the unconfigured case. No network, no deploy.

## The card organizers

`collection-organizer.html` and `stack-organizer.html` are self-contained
single-file apps copied in from elsewhere. They have their own look and share
nothing with the rest of the site — no `game.css`, no `game.js`, no site
favicon. Leave them that way unless asked.

They are presented as one project, **MTG Card Organizer**, with Collection as
the entry point and a tab bar switching to Stack. They stay two separate pages
because both define `#dropZone` and `#fileInput`; merging them into one
document would mean renaming ids and rewiring both scripts. The only edits to
either file are the tab CSS, the `<nav class="tabs">` block, and the title and
h1 — no app logic was touched.

Their only runtime dependency is Scryfall's public API
(`POST https://api.scryfall.com/cards/collection`). CSVs are supplied by the
user at runtime; none are stored in this repo.

## Adding a project

1. Drop the project's HTML file in `public/` (or a folder under it with its own `index.html`).
2. Add a card to the `<ul class="projects">` grid in `public/index.html`:

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
column on a phone to two or three as you add them.

## Local preview

```bash
npx wrangler dev
```

That serves `public/` and the API together with a local KV. For static-only
checks without wrangler:

```bash
cd public && python3 -m http.server 4173
```

The leaderboard will report itself unavailable there, since `/api/scores` needs
the Worker.
