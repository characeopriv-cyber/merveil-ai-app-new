const API_ORIGIN = "https://api.junction.technology";

function isApiRequest(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

async function proxyApi(request) {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set("x-merveil-edge", "cloudflare");
  headers.set("x-merveil-forwarded-host", incoming.host);

  const proxied = new Request(target.toString(), {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });

  const response = await fetch(proxied);
  const out = new Response(response.body, response);
  out.headers.set("cache-control", "no-store");
  out.headers.set("x-merveil-api-proxy", "cloudflare");
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep the developer console on the same origin while its existing
    // backend remains on the production API service. This preserves the
    // existing Supabase/developer authentication implementation instead of
    // duplicating it inside a static-assets Worker.
    if (isApiRequest(url.pathname)) {
      try {
        return await proxyApi(request);
      } catch (error) {
        return Response.json(
          {
            error: "api_proxy_failed",
            message: "Merveil Developer API is temporarily unavailable.",
          },
          { status: 502, headers: { "cache-control": "no-store" } },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
