/* Shared helpers, the name gate, and the leaderboard client. */

const norm = s => s.toLowerCase().replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; };
const fmtFine = ms => `${fmt(ms)}.${Math.floor(ms/100)%10}`;
const esc = s => String(s).replace(/[<&]/g, c => c==="<"?"&lt;":"&amp;");

const MAX_NAME = 24;

/* ---------- Player name ---------- */
const Player = {
  KEY: "noah-player-name",
  get(){ try { return localStorage.getItem(this.KEY) || ""; } catch { return ""; } },
  set(n){ try { localStorage.setItem(this.KEY, n); } catch {} }
};

/**
 * Gates the game behind a name. Nothing is revealed until a name is entered,
 * so every score on the board belongs to somebody.
 * onStart(name) fires once; later name changes fire onRename(name).
 */
function initGate({ onStart, onRename }){
  const gate   = document.getElementById("gate");
  const form   = document.getElementById("gateForm");
  const input  = document.getElementById("who");
  const err    = document.getElementById("gateErr");
  const game   = document.getElementById("gameArea");
  const bar    = document.getElementById("playing");
  const label  = document.getElementById("playingName");
  const change = document.getElementById("changeName");
  let started = false;

  input.maxLength = MAX_NAME;
  input.value = Player.get();

  const show = () => {
    gate.hidden = false; game.hidden = true; bar.hidden = true;
    input.focus(); input.select();
  };
  const hide = name => {
    gate.hidden = true; game.hidden = false; bar.hidden = false;
    label.textContent = name;
  };

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, MAX_NAME);
    if (!name) {
      err.hidden = false;
      gate.classList.remove("shake");
      void gate.offsetWidth;          // restart the animation
      gate.classList.add("shake");
      input.focus();
      return;
    }
    err.hidden = true;
    Player.set(name);
    hide(name);
    if (!started) { started = true; onStart && onStart(name); }
    else { onRename && onRename(name); }
  });

  change.addEventListener("click", show);

  show();   // the gate is always the first thing you see
  return { name: () => Player.get(), reopen: show };
}

/* ---------- Leaderboard ---------- */
const Board = {
  async load(game){
    try {
      const r = await fetch(`/api/scores?game=${encodeURIComponent(game)}`, {cache:"no-store"});
      const j = await r.json();
      return r.ok && j.ok ? {ok:true, rows:j.rows} : {ok:false, reason:j.error || "unavailable"};
    } catch { return {ok:false, reason:"offline"}; }
  },
  async submit(game, entry){
    try {
      const r = await fetch("/api/scores", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({game, ...entry})
      });
      const j = await r.json();
      return r.ok && j.ok ? {ok:true, rows:j.rows} : {ok:false, reason:j.error || "unavailable"};
    } catch { return {ok:false, reason:"offline"}; }
  }
};

const BOARD_MESSAGES = {
  "leaderboard-unconfigured": "Leaderboard isn't switched on yet.",
  "offline": "Can't reach the leaderboard right now.",
  "unavailable": "Leaderboard unavailable."
};

/**
 * Paints rows into a <tbody>. `cells` turns a row into an array of <td> html.
 * Highlights the current player's most recent entry.
 */
function paintBoard(tbody, res, cells, emptyText, mine){
  if (!res.ok) {
    tbody.innerHTML = `<tr><td class="empty">${esc(BOARD_MESSAGES[res.reason] || BOARD_MESSAGES.unavailable)}</td></tr>`;
    return;
  }
  if (!res.rows.length) {
    tbody.innerHTML = `<tr><td class="empty">${esc(emptyText)}</td></tr>`;
    return;
  }
  tbody.innerHTML = res.rows.map((r,i) => {
    const hit = mine && r.name === mine.name && r.ms === mine.ms;
    return `<tr${hit ? ' class="you"' : ''}><td>${i+1}. ${esc(r.name)}</td>${cells(r).join("")}</tr>`;
  }).join("");
}
