import { getMetricsCollection } from "../config/metrics.js";

const METRIC_ID = "public-api";
export const ENDPOINTS = Object.freeze([
  Object.freeze({ key: "usersList", path: "GET /api/users" }),
  Object.freeze({ key: "usersDetail", path: "GET /api/users/:id" }),
  Object.freeze({ key: "todosList", path: "GET /api/todos" }),
  Object.freeze({ key: "todosDetail", path: "GET /api/todos/:id" }),
]);

/** Date boundaries always use Japan Standard Time (UTC+9), not server local time. */
export function japanDateKey(date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function endpointKey(method, path) {
  if (method !== "GET") return null;
  if (path === "/users") return "usersList";
  if (/^\/users\/[^/]+$/.test(path)) return "usersDetail";
  if (path === "/todos") return "todosList";
  if (/^\/todos\/[^/]+$/.test(path)) return "todosDetail";
  return null;
}

export function isCountedApiRequest(method, path) {
  return endpointKey(method, path) !== null;
}

function safeCounter(value) {
  if (value === undefined) return 0; // Existing single-total record predates detailed counters.
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid counter value");
  return value;
}

function validateDocument(doc) {
  if (!doc || !Number.isSafeInteger(doc.total) || doc.total < 0) {
    throw new Error("Metric counter is missing or invalid");
  }
  const startedAt = typeof doc.startedAt === "string"
    ? doc.startedAt
    : doc.startedAt?.toISOString?.();
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
    throw new Error("Metric start time is invalid");
  }
  return { totalRequests: doc.total, startedAt };
}

function errorResponse(res, error) {
  console.error("API metrics read failed:", error.name, error.code || "unknown");
  res.set("Cache-Control", "no-store");
  return res.status(503).json({
    error: "service_unavailable",
    message: "利用状況を取得できませんでした。時間をおいて再試行してください。",
  });
}

export function createMetricsHandlers(collectionProvider = getMetricsCollection, now = () => new Date()) {
  function trackRequest(req, res, next) {
    const routeKey = endpointKey(req.method, req.path);
    if (routeKey) {
      res.once("finish", () => {
        // One atomic MongoDB update increments total, day, month and route together.
        // It does not delay the public API response; on sudden shutdown a count can be missed.
        const day = japanDateKey(now());
        const month = day.slice(0, 7);
        const increments = {
          total: 1,
          ["daily." + day]: 1,
          ["monthly." + month]: 1,
          ["byEndpoint." + routeKey]: 1,
        };
        Promise.resolve()
          .then(collectionProvider)
          .then((collection) => collection.updateOne(
            { _id: METRIC_ID },
            { $inc: increments },
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
      res.set("Cache-Control", "no-store");
      return res.json(validateDocument(doc));
    } catch (error) {
      return errorResponse(res, error);
    }
  }

  async function getDetailedStats(_req, res) {
    try {
      const collection = await collectionProvider();
      const doc = await collection.findOne(
        { _id: METRIC_ID },
        { projection: { total: 1, startedAt: 1, daily: 1, monthly: 1, byEndpoint: 1, _id: 0 }, maxTimeMS: 5000 },
      );
      const { totalRequests, startedAt } = validateDocument(doc);
      const today = japanDateKey(now());
      const month = today.slice(0, 7);
      const daily = doc.daily || {};
      const monthly = doc.monthly || {};
      const byEndpoint = doc.byEndpoint || {};
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today + "T00:00:00.000Z");
        date.setUTCDate(date.getUTCDate() - 6 + i);
        const key = date.toISOString().slice(0, 10);
        return { date: key, requests: safeCounter(daily[key]) };
      });
      const endpoints = ENDPOINTS.map(({ key, path }) => ({
        path,
        requests: safeCounter(byEndpoint[key]),
      }));
      res.set("Cache-Control", "no-store");
      return res.json({
        totalRequests,
        todayRequests: safeCounter(daily[today]),
        monthRequests: safeCounter(monthly[month]),
        date: today,
        month,
        timezone: "Asia/Tokyo",
        startedAt,
        last7Days,
        endpoints,
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  }

  return { trackRequest, getStats, getDetailedStats };
}
