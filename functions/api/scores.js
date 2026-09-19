/**
 * Shared leaderboard for the games, backed by Workers KV.
 *
 * GET  /api/scores?game=map-slam   -> { ok:true, rows:[...] }
 * POST /api/scores                 -> { ok:true, rows:[...] }   body: {game,name,ms,score}
 *
 * Requires a KV namespace bound as SCORES. Without it the endpoint reports
 * "leaderboard-unconfigured" and the games carry on without a board rather
 * than breaking.
 */

const TOP_N = 10;

const GAMES = {
  "map-slam":  { needsScore: true,  sort: (a,b) => b.score - a.score || a.ms - b.ms },
  "list-race": { needsScore: false, sort: (a,b) => a.ms - b.ms }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });

const key = game => `board:${game}`;

async function read(env, game) {
  const raw = await env.SCORES.get(key(game));
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];   // don't let one bad write wedge the board forever
  }
}

export async function onRequestGet({ request, env }) {
  const game = new URL(request.url).searchParams.get("game");
  if (!GAMES[game]) return json({ ok: false, error: "unknown-game" }, 400);
  if (!env.SCORES)  return json({ ok: false, error: "leaderboard-unconfigured" }, 503);
  return json({ ok: true, rows: await read(env, game) });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: "bad-json" }, 400); }

  const game = body && body.game;
  const rules = GAMES[game];
  if (!rules)      return json({ ok: false, error: "unknown-game" }, 400);
  if (!env.SCORES) return json({ ok: false, error: "leaderboard-unconfigured" }, 503);

  // Light shaping only — this board is for friends, not a tournament. It keeps
  // junk from corrupting the stored array; it does not stop a determined faker.
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 24) || "Mystery player";
  const ms = Number(body.ms);
  if (!Number.isFinite(ms) || ms <= 0 || ms > DAY_MS) {
    return json({ ok: false, error: "bad-time" }, 400);
  }

  const entry = { name, ms: Math.round(ms), at: Date.now() };

  if (rules.needsScore) {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 0 || score > 50) {
      return json({ ok: false, error: "bad-score" }, 400);
    }
    entry.score = score;
  }

  const rows = await read(env, game);
  rows.push(entry);
  rows.sort(rules.sort);
  const top = rows.slice(0, TOP_N);

  await env.SCORES.put(key(game), JSON.stringify(top));
  return json({ ok: true, rows: top });
}
