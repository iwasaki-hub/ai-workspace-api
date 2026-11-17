/**
 * Privacy-safe structured access events for Render application logs.
 *
 * Do not log IPs, query parameters, headers, request/response bodies or raw IDs.
 * Records are intentionally not made available through a public endpoint.
 */
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function normalizedApiPath(baseUrl, path) {
  if (baseUrl === "/health") return "/health";
  if (baseUrl !== "/api") return "/api/*";
  if (path === "/english-phrases") return "/api/english-phrases";
  if (path === "/users") return "/api/users";
  if (/^\/users\/[^/]+$/.test(path)) return "/api/users/:id";
  if (path === "/todos") return "/api/todos";
  if (/^\/todos\/[^/]+$/.test(path)) return "/api/todos/:id";
  if (path === "/stats") return "/api/stats";
  if (path === "/stats/details") return "/api/stats/details";
  if (path === "/stats/visitors") return "/api/stats/visitors";
  return "/api/*"; // Unknown paths may carry sensitive data. Never print them.
}

/**
 * Attach before the rate limiter to include 429 responses.
 * Event emission is best effort; logger faults cannot change API responses.
 * Incomplete responses report statusCode:null rather than inventing a status.
 */
export function createAccessLogger({
  write = (line) => console.info(line),
  now = () => new Date(),
  monotonic = () => performance.now(),
} = {}) {
  return (req, res, next) => {
    const timestamp = now().toISOString();
    const started = monotonic();
    const method = METHODS.has(req.method) ? req.method : "OTHER";
    const endpoint = normalizedApiPath(req.baseUrl, req.path);
    let emitted = false;

    const emit = (aborted) => {
      if (emitted) return;
      emitted = true;
      const elapsed = monotonic() - started;
      const durationMs = Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed * 100) / 100) : 0;
      const record = {
        event: "api_access",
        timestamp,
        method,
        endpoint,
        statusCode: aborted ? null : res.statusCode,
        durationMs,
        aborted,
      };
      try {
        write(JSON.stringify(record));
      } catch {
        // Logging is observational only; never make a request fail.
      }
    };

    res.once("finish", () => emit(false));
    res.once("close", () => emit(!res.writableFinished));
    next();
  };
}
