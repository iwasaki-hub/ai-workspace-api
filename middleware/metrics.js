import { getMetricsCollection } from "../config/metrics.js";

const METRIC_ID = "public-api";

/**
 * Track user-facing GET endpoints, but not stats polling, health, docs,
 * unknown routes, or methods that would mutate resources.
 */
export function isCountedApiRequest(method, path) {
  return method === "GET" && /^\/(users|todos)(\/[^/]+)?$/.test(path);
}

export function createMetricsHandlers(collectionProvider = getMetricsCollection) {
  function trackRequest(req, res, next) {
    if (isCountedApiRequest(req.method, req.path)) {
      res.once("finish", () => {
        // Do not delay or fail a public API response when metric storage is down.
        // This is an operational counter, not an accounting/billing counter.
        Promise.resolve()
          .then(collectionProvider)
          .then((collection) => collection.updateOne(
            { _id: METRIC_ID },
            { $inc: { total: 1 } },
            { upsert: false },
          ))
          .catch((error) => {
            console.error("API metrics write failed:", error.name, error.code || "unknown");
          });
      });
    }
    next();
  }

  async function getStats(_req, res) {
    try {
      const collection = await collectionProvider();
      const doc = await collection.findOne(
        { _id: METRIC_ID },
        { projection: { total: 1, startedAt: 1, _id: 0 }, maxTimeMS: 5000 },
      );
      if (!doc || !Number.isSafeInteger(doc.total) || doc.total < 0) {
        throw new Error("Metric counter is missing or invalid");
      }
      const startedAt = typeof doc.startedAt === "string"
        ? doc.startedAt
        : doc.startedAt?.toISOString?.();
      if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
        throw new Error("Metric start time is invalid");
      }
      res.set("Cache-Control", "no-store");
      return res.json({ totalRequests: doc.total, startedAt });
    } catch (error) {
      console.error("API metrics read failed:", error.name, error.code || "unknown");
      res.set("Cache-Control", "no-store");
      return res.status(503).json({
        error: "service_unavailable",
        message: "利用状況を取得できませんでした。時間をおいて再試行してください。",
      });
    }
  }
  return { trackRequest, getStats };
}
