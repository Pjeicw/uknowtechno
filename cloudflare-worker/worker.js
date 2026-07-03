/**
 * UknowTechno API health-router (Phase 3, Layer C failover).
 *
 * Sits in front of api.uknowtechno.com. Normally it transparently proxies to
 * the Mac Mini origin (via Cloudflare Tunnel). If the origin is down — power
 * cut, internet drop, tunnel gone — it returns graceful "offline" responses so
 * the portfolio (served separately on Cloudflare Pages) keeps working and the
 * chat widget shows a clean maintenance notice instead of hanging.
 *
 * Configure ORIGIN_URL as a Worker variable (e.g. https://origin.uknowtechno.com
 * or the internal tunnel hostname). Deploy with `wrangler deploy`.
 */

const ORIGIN_TIMEOUT_MS = 8000;

export default {
  async fetch(request, env) {
    const origin = env.ORIGIN_URL;
    const url = new URL(request.url);

    try {
      // Proxy to origin with a hard timeout so a hung origin can't hang clients.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS);

      const originReq = new Request(origin + url.pathname + url.search, request);
      const resp = await fetch(originReq, { signal: controller.signal });
      clearTimeout(timer);
      return resp;
    } catch (err) {
      // Origin unreachable -> degrade gracefully per endpoint.
      return offlineResponse(url.pathname);
    }
  },
};

function offlineResponse(pathname) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  };

  // /api/config: tell the widget the engine is offline (200 so it parses cleanly).
  if (pathname.startsWith("/api/config")) {
    return new Response(
      JSON.stringify({ status: "offline", model: "Offline", reason: "Origin unreachable" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // /api/chat: emit a one-shot SSE message so the streaming UI renders it and stops.
  if (pathname.startsWith("/api/chat")) {
    const body =
      `data: ${JSON.stringify({ content: "The AI engine is temporarily offline for maintenance. Please try again shortly." })}\n\n` +
      `data: [DONE]\n\n`;
    return new Response(body, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/event-stream" },
    });
  }

  // Everything else: a small JSON 503.
  return new Response(
    JSON.stringify({ status: "offline", detail: "Backend is offline for maintenance." }),
    { status: 503, headers: { ...cors, "Content-Type": "application/json" } }
  );
}
