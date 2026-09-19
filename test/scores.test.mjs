import { readFile } from 'node:fs/promises';

// The site is deliberately zero-config: no package.json, so Cloudflare Pages
// treats it as pure static + Functions and never tries to install or build.
// That leaves Node seeing functions/api/scores.js as CommonJS, so load it as
// a module by hand instead of importing it directly.
const src = await readFile(new URL('../src/scores.js', import.meta.url), 'utf8');
const { onRequestGet, onRequestPost } =
  await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

// minimal in-memory stand-in for a KV namespace
const makeKV = () => { const m = new Map();
  return { get: async k => m.has(k) ? m.get(k) : null, put: async (k,v) => { m.set(k,v); } }; };

const GET  = (env, q) => onRequestGet({ request: new Request(`https://x/api/scores?${q}`), env });
const POST = (env, body) => onRequestPost({
  request: new Request('https://x/api/scores', {method:'POST', body: typeof body==='string'?body:JSON.stringify(body)}), env });

let pass = 0, fail = 0;
const check = (label, cond, extra='') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${extra}`); }
};

console.log('\n— unconfigured (no KV bound) —');
{
  const env = {};
  const g = await GET(env, 'game=map-slam'); const gj = await g.json();
  check('GET reports unconfigured, not a crash', g.status===503 && gj.error==='leaderboard-unconfigured');
  const p = await POST(env, {game:'map-slam', name:'A', ms:1000, score:50}); const pj = await p.json();
  check('POST reports unconfigured', p.status===503 && pj.error==='leaderboard-unconfigured');
}

console.log('\n— bad input —');
{
  const env = {SCORES: makeKV()};
  check('unknown game rejected', (await GET(env,'game=nope')).status===400);
  check('missing game rejected', (await GET(env,'')).status===400);
  check('malformed JSON rejected', (await POST(env,'{oops')).status===400);
  check('bad time rejected', (await POST(env,{game:'map-slam',name:'A',ms:-5,score:10})).status===400);
  check('NaN time rejected', (await POST(env,{game:'map-slam',name:'A',ms:'abc',score:10})).status===400);
  check('score over 50 rejected', (await POST(env,{game:'map-slam',name:'A',ms:1000,score:99})).status===400);
  check('non-integer score rejected', (await POST(env,{game:'map-slam',name:'A',ms:1000,score:12.5})).status===400);
  check('list-race needs no score', (await POST(env,{game:'list-race',name:'A',ms:1000})).status===200);
}

console.log('\n— map-slam ordering: score desc, then time —');
{
  const env = {SCORES: makeKV()};
  await POST(env,{game:'map-slam',name:'Ann',ms:60000,score:40});
  await POST(env,{game:'map-slam',name:'Bo', ms:90000,score:50});
  await POST(env,{game:'map-slam',name:'Cy', ms:30000,score:50});
  const rows = (await (await GET(env,'game=map-slam')).json()).rows;
  check('highest score first, faster wins the tie',
        rows.map(r=>r.name).join(',')==='Cy,Bo,Ann', JSON.stringify(rows.map(r=>[r.name,r.score,r.ms])));
}

console.log('\n— list-race ordering: fastest first —');
{
  const env = {SCORES: makeKV()};
  await POST(env,{game:'list-race',name:'Slow',ms:90000});
  await POST(env,{game:'list-race',name:'Fast',ms:10000});
  const rows = (await (await GET(env,'game=list-race')).json()).rows;
  check('fastest first', rows[0].name==='Fast');
}

console.log('\n— boards are separate —');
{
  const env = {SCORES: makeKV()};
  await POST(env,{game:'map-slam',name:'M',ms:1000,score:50});
  const lr = (await (await GET(env,'game=list-race')).json()).rows;
  check('a map score does not appear on the list board', lr.length===0);
}

console.log('\n— top 10 cap —');
{
  const env = {SCORES: makeKV()};
  for (let i=0;i<15;i++) await POST(env,{game:'list-race',name:`P${i}`,ms:1000+i});
  const rows = (await (await GET(env,'game=list-race')).json()).rows;
  check('keeps only 10', rows.length===10, `got ${rows.length}`);
  check('keeps the fastest 10', rows[0].name==='P0' && rows[9].name==='P9');
}

console.log('\n— name shaping —');
{
  const env = {SCORES: makeKV()};
  await POST(env,{game:'list-race',name:'   ',ms:1000});
  await POST(env,{game:'list-race',name:'x'.repeat(80),ms:1001});
  await POST(env,{game:'list-race',name:'a\n\n  b',ms:1002});
  const rows = (await (await GET(env,'game=list-race')).json()).rows;
  check('blank name gets a fallback', rows.some(r=>r.name==='Mystery player'));
  check('long name capped at 24', rows.some(r=>r.name.length===24));
  check('whitespace collapsed', rows.some(r=>r.name==='a b'));
}

console.log('\n— corrupt stored value —');
{
  const kv = makeKV(); await kv.put('board:list-race','{not json');
  const env = {SCORES: kv};
  const r = await GET(env,'game=list-race');
  check('recovers instead of 500ing', r.status===200 && (await r.json()).rows.length===0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
