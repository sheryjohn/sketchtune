// Sketchtune API relay. Forwards requests to an OpenAI-compatible API and adds the CORS headers
// that let a web page call it. It stores nothing: the user's API key passes through in the Authorization header.
//
// Deploy on Cloudflare Workers (free tier is plenty):
//   1. dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker -> Deploy, then "Edit code"
//   2. Replace the code with this file, set ALLOWED_ORIGINS below, Deploy
//   3. Your relay URL is https://<name>.<account>.workers.dev
//   In Sketchtune, set Base URL to https://<name>.<account>.workers.dev/nvidia/v1 (or /openai/v1, see UPSTREAMS)

const UPSTREAMS = {
  nvidia: 'https://integrate.api.nvidia.com',
  openai: 'https://api.openai.com',
  groq: 'https://api.groq.com/openai',
  openrouter: 'https://openrouter.ai/api',
};

// Pages allowed to use this relay. Keep this tight so nobody else burns your Worker quota.
const ALLOWED_ORIGINS = [
  'https://sheryjohn.github.io',
  'http://localhost:8000',
];

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!allowed) return new Response(JSON.stringify({ error: { message: 'origin not allowed' } }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });

    const url = new URL(request.url);
    const [, name, ...rest] = url.pathname.split('/');
    const upstream = UPSTREAMS[name];
    if (!upstream) return new Response(JSON.stringify({ error: { message: 'unknown upstream; use /nvidia/v1/... or /openai/v1/...' } }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });

    const target = upstream + '/' + rest.join('/') + url.search;
    const headers = new Headers();
    for (const h of ['authorization', 'content-type', 'accept']) { const v = request.headers.get(h); if (v) headers.set(h, v); }

    let res;
    try {
      res = await fetch(target, { method: request.method, headers, body: request.method === 'POST' ? await request.arrayBuffer() : undefined });
    } catch (e) {
      return new Response(JSON.stringify({ error: { message: 'upstream unreachable: ' + e.message } }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const out = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) out.set(k, v);
    return new Response(res.body, { status: res.status, headers: out });
  },
};
