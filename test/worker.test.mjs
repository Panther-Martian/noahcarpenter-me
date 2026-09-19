/**
 * Exercises worker.js routing against stand-ins for the assets and KV
 * bindings. Loads the module graph by hand (see test/scores.test.mjs for why
 * the repo has no package.json).
 */
import { readFile } from 'node:fs/promises';

const b64 = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
const read = p => readFile(new URL(p, import.meta.url), 'utf8');

const scoresUrl = b64(await read('../src/scores.js'));
const workerSrc = (await read('../worker.js')).replace('./src/scores.js', scoresUrl);
const worker = (await import(b64(workerSrc))).default;

const kv = new Map();
const env = {
  SCORES: { get: async k => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); } },
  ASSETS: { fetch: async req => new Response('ASSET:' + new URL(req.url).pathname, { status: 200 }) }
};
const hit = (path, init) => worker.fetch(new Request('https://x' + path, init), env);

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${extra}`); }
};

console.log('\n— the API route reaches the handler —');
{
  const r = await hit('/api/scores?game=map-slam');
  const j = await r.json();
  check('GET /api/scores returns the board, not an asset', r.status === 200 && j.ok === true && Array.isArray(j.rows));

  const p = await hit('/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: 'map-slam', name: 'Noah', ms: 65000, score: 47 })
  });
  const pj = await p.json();
  check('POST /api/scores records a score', p.status === 200 && pj.rows[0].name === 'Noah');

  const g = await (await hit('/api/scores?game=map-slam')).json();
  check('the score persists to the next GET', g.rows.length === 1 && g.rows[0].score === 47);

  const bad = await hit('/api/scores', { method: 'PUT' });
  check('PUT is rejected with 405', bad.status === 405);
}

console.log('\n— everything else falls through to static assets —');
{
  for (const p of ['/', '/index.html', '/map-slam.html', '/game.css', '/noah.webp', '/nope']) {
    const r = await hit(p);
    check(`${p} is served from assets`, (await r.text()) === 'ASSET:' + p);
  }
}

console.log('\n— the API is not shadowed by assets —');
{
  const r = await hit('/api/scores?game=list-race');
  check('/api/scores never hits the asset binding', !(await r.clone().text()).startsWith('ASSET:'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
