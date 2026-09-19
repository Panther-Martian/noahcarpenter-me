# noahcarpenter.me

Personal site and projects. Plain static HTML with one Cloudflare Pages
Function for the shared leaderboard. No build step, no dependencies — do not
add a `package.json` unless you also configure the build, or deploys break.

## Structure

- `index.html` — homepage
- `404.html` — not-found page
- `noah.webp` — header artwork
- `map-slam.html` — Map Slam (tap each state, name it)
- `list-race.html` — List Race (type all 50 from memory)
- `game.css` — shared styling for both games
- `game.js` — shared helpers, the name gate, the leaderboard client
- `states.js` — state names + SVG paths (Map Slam only, ~107KB)
- `state-names.js` — just the 50 names (List Race only)
- `functions/api/scores.js` — leaderboard API
- `test/scores.test.mjs` — tests for the leaderboard API

## The leaderboard

Scores are shared by everyone and live in a Workers KV namespace, one key per
game (`board:map-slam`, `board:list-race`), each holding the top 10.

### One-time setup

1. ~~Create the KV namespace.~~ Done — `noah-scores`, id
   `6e18c86b2347477d8413da094cbd0eca`.
2. Your Pages project → **Settings** → **Bindings** → **Add** → **KV namespace**.
   - Variable name: `SCORES`  ← must be exactly this
   - KV namespace: `noah-scores`
3. Add it for both **Production** and **Preview**, then redeploy.

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
```

There is deliberately no `package.json` and no lockfile. Cloudflare Pages
tries to install and build anything that looks like a Node project, and this
site has nothing to build — leave the build command empty and the output
directory `/`. The test loads the Function source directly so the repo can
stay zero-config.

Runs the API against an in-memory stand-in for KV — ordering, the top-10 cap,
name shaping, bad input, and the unconfigured case. No network, no deploy.

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

Then open http://localhost:4173. The leaderboard will report itself
unavailable, since `/api/scores` only exists on Cloudflare. To exercise the
API locally instead:

```bash
npx wrangler pages dev . --kv SCORES
```
