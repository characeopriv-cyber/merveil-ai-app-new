const API_ORIGIN = "https://api.junction.technology";
const SUPABASE_URL = "https://dixfybqlepticyudikuz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zOtxw1q_OCpiTunktzypw_14pQnQOh";

function isApiRequest(pathname) { return pathname === "/api" || pathname.startsWith("/api/"); }
function localDeveloperConfig(request) {
  if (request.method !== "GET") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { "cache-control": "no-store" } });
  return Response.json({ data: { supabase_url: SUPABASE_URL, supabase_publishable_key: SUPABASE_PUBLISHABLE_KEY, api_base_url: "/api/v1" } }, { headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } });
}
async function proxyApi(request) {
  const incoming = new URL(request.url); const target = new URL(incoming.pathname + incoming.search, API_ORIGIN); const headers = new Headers(request.headers);
  headers.set("x-merveil-edge", "cloudflare"); headers.set("x-merveil-forwarded-host", incoming.host);
  const proxied = new Request(target.toString(), { method: request.method, headers, body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body, redirect: "follow" });
  const response = await fetch(proxied); const out = new Response(response.body, response); out.headers.set("cache-control", "no-store"); out.headers.set("x-merveil-api-proxy", "cloudflare"); return out;
}
async function serveAsset(env, request, path) { const url = new URL(request.url); url.pathname = path; return env.ASSETS.fetch(new Request(url.toString(), request)); }
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/developer" || url.pathname === "/developer/") return serveAsset(env, request, "/developer-portal/index.html");
  if (url.pathname === "/developer/console" || url.pathname === "/developer/console/" || url.pathname === "/developer/console.html") return serveAsset(env, request, "/developer-portal/console-live.html");
  if (url.pathname === "/developer/onboarding" || url.pathname === "/developer/onboarding/") return serveAsset(env, request, "/developer-portal/onboarding.html");
  if (url.pathname === "/api/v1/developer/config" || url.pathname === "/api/v1/developer/config/" || url.pathname === "/api/developer/config" || url.pathname === "/developer/config") return localDeveloperConfig(request);
  if (isApiRequest(url.pathname)) { try { return await proxyApi(request); } catch (_) { return Response.json({ error: "api_proxy_failed", message: "Merveil Developer API is temporarily unavailable." }, { status: 502, headers: { "cache-control": "no-store" } }); } }
  return env.ASSETS.fetch(request);
} };