import { isIP } from "node:net";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_REQUEST_LIMIT = 120;

/**
 * Limit requests to the expensive public /api routes only, not health checks,
 * documentation assets, or the home page.
 *
 * Render's public proxy overwrites CF-Connecting-IP. Only trust that value
 * on Render, and validate it before use. Never trust arbitrary X-Forwarded-For.
 * The fallback is the socket IP (no implicit trust-proxy configuration).
 */
export function createApiRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  limit = DEFAULT_REQUEST_LIMIT,
  isRender = process.env.RENDER === "true",
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator(req) {
      const cfAddress = isRender ? req.get("cf-connecting-ip") : null;
      const address = typeof cfAddress === "string" && isIP(cfAddress) ? cfAddress : req.socket.remoteAddress;
      return ipKeyGenerator(address || "unknown");
    },
    handler(_req, res) {
      return res.status(429).json({
        error: "rate_limited",
        message: "リクエストが集中しています。時間をおいて再試行してください。",
      });
    },
  });
}

export function applySecurityHeaders(_req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
}
