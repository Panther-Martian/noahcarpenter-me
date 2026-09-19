/**
 * Entry point for the Worker.
 *
 * Static files live in public/ and are served by the assets binding. The one
 * dynamic route is the leaderboard API, whose handlers live in src/scores.js.
 *
 * Note: this project is a Worker, not a Pages project, so the Pages-only
 * `functions/` directory convention does not apply — routes are wired here.
 */
import { onRequestGet, onRequestPost } from './src/scores.js';

const methodNotAllowed = () =>
  new Response(JSON.stringify({ ok: false, error: "method-not-allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", "Allow": "GET, POST" }
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/scores") {
      if (request.method === "GET")  return onRequestGet({ request, env });
      if (request.method === "POST") return onRequestPost({ request, env });
      return methodNotAllowed();
    }

    return env.ASSETS.fetch(request);
  }
};
