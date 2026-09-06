const developerRoutes = {
  projects: () => import('./server/merveil-v1/developer/projects.js'),
  brief: () => import('./server/merveil-v1/developer/brief.js'),
  build: () => import('./server/merveil-v1/developer/build-engine.js'),
  cloudflare: () => import('./server/merveil-v1/developer/cloudflare.js'),
  databases: () => import('./server/merveil-v1/developer/databases.js'),
  deploy: () => import('./server/merveil-v1/developer/deploy.js'),
  chatbot: () => import('./server/merveil-v1/developer/chatbot.js'),
  'voice-build': () => import('./server/merveil-v1/developer/voice-build.js')
};

function installEnv(env) {
  const p = globalThis.process || {};
  const current = p.env || {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') current[key] = value;
  }
  p.env = current;
  globalThis.process = p;
}

function nodeHeaders(request) {
  const headers = {};
  request.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
  return headers;
}

async function nodeRequest(request) {
  const url = new URL(request.url);
  let body;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const text = await request.text();
    body = text || undefined;
  }
  const query = {};
  url.searchParams.forEach((value, key) => { query[key] = value; });
  return { method: request.method, url: request.url, headers: nodeHeaders(request), query, body };
}

class NodeResponse {
  constructor() { this.headers = new Headers(); this.statusCode = 200; this.result = null; }
  setHeader(name, value) { this.headers.set(name, String(value)); }
  status(code) { this.statusCode = code; return this; }
  json(body) {
    this.result = new Response(JSON.stringify(body), { status: this.statusCode, headers: new Headers([...this.headers, ['content-type', 'application/json; charset=utf-8']]) });
    return this.result;
  }
  end() { this.result = new Response(null, { status: this.statusCode, headers: this.headers }); return this.result; }
}

async function handleDeveloperApi(request, env) {
  installEnv(env);
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/developer\/([^/]+)\/?$/);
  if (!match) return null;
  const route = decodeURIComponent(match[1]);
  if (route === 'config') {
    return new Response(JSON.stringify({ ok: true, provider: 'cloudflare', access: 'passport', intelligence: 'merveil', server_ready: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  const loader = developerRoutes[route];
  if (!loader) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  try {
    const mod = await loader();
    const req = await nodeRequest(request);
    const res = new NodeResponse();
    const output = await mod.default(req, res);
    return output instanceof Response ? output : (res.result || new Response(null, { status: 204 }));
  } catch (error) {
    console.error('[merveil-worker]', route, error);
    return new Response(JSON.stringify({ error: 'internal_server_error', message: error?.message || 'Request failed' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}

async function handleDeveloperPages(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  // One Developer Platform: Home, Workspace and Infrastructure are interfaces inside the same product.
  if (path === '/developer' || path === '/developer/index.html') {
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
  if (path === '/developer/console' || path === '/developer/console.html') {
    return env.ASSETS.fetch(new Request(new URL('/console.html', url), request));
  }
  return null;
}

export default {
  async fetch(request, env) {
    const apiResponse = await handleDeveloperApi(request, env);
    if (apiResponse) return apiResponse;
    const pageResponse = await handleDeveloperPages(request, env);
    if (pageResponse) return pageResponse;
    return env.ASSETS.fetch(request);
  }
};
