import { createHash } from "node:crypto";
import { japanDateKey } from "./metrics.js";
import { getVisitorCollection } from "../config/metrics.js";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MS_DAY = 86_400_000;

function endOfJstPeriod(period, kind) {
  // Store only period-scoped hashes. TTL drops records 40 days after period end.
  const following = kind === "day"
    ? new Date(Date.parse(period + "T00:00:00Z") + MS_DAY)
    : new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1));
  return new Date(following.getTime() - 9 * 60 * 60 * 1000 + 40 * MS_DAY);
}

export function visitorPeriod(date) {
  const day = japanDateKey(date);
  return { day: "day:" + day, month: "month:" + day.slice(0, 7) };
}

export function pseudonymousKey(visitorId, period) {
  // Random UUID has 122 bits of entropy. Never persist the raw browser token.
  return period + ":" + createHash("sha256").update(period + ":" + visitorId).digest("hex");
}

export function createVisitorHandlers({
  collectionProvider = getVisitorCollection,
  now = () => new Date(),
} = {}) {
  async function collect(req, res) {
    res.set("Cache-Control", "no-store");
    if (!req.is("application/json") || !ID_PATTERN.test(req.body?.visitorId || "")) {
      return res.status(400).json({ error: "invalid_visitor", message: "無効な計測リクエストです。" });
    }
    if (req.get("origin") && req.get("origin") !== req.protocol + "://" + req.get("host")) {
      return res.status(403).json({ error: "forbidden", message: "このサイトからのみ利用できます。" });
    }
    if (req.get("sec-fetch-site") && !["same-origin", "none"].includes(req.get("sec-fetch-site"))) {
      return res.status(403).json({ error: "forbidden", message: "このサイトからのみ利用できます。" });
    }
    try {
      const collection = await collectionProvider();
      const { day, month } = visitorPeriod(now());
      // Idempotent upsert. Individual ID hashes cannot be correlated across periods.
      for (const [period, kind] of [[day, "day"], [month, "month"]]) {
        const stamp = period.slice(period.indexOf(":") + 1);
        await collection.updateOne(
          { _id: pseudonymousKey(req.body.visitorId, period) },
          { $setOnInsert: { period, expiresAt: endOfJstPeriod(stamp, kind) } },
          { upsert: true },
        );
      }
      return res.status(204).end();
    } catch (error) {
      console.error("Visitor aggregation write failed:", error.name, error.code || "unknown");
      return res.status(503).json({ error: "service_unavailable", message: "訪問者数を記録できませんでした。" });
    }
  }

  async function statistics(_req, res) {
    res.set("Cache-Control", "no-store");
    try {
      const collection = await collectionProvider();
      const { day, month } = visitorPeriod(now());
      const [todayVisitors, monthVisitors] = await Promise.all([
        collection.countDocuments({ period: day }, { maxTimeMS: 5000 }),
        collection.countDocuments({ period: month }, { maxTimeMS: 5000 }),
      ]);
      return res.json({
        todayVisitors,
        monthVisitors,
        date: day.slice(4),
        month: month.slice(6),
        timezone: "Asia/Tokyo",
        measurement: "consented_browsers",
      });
    } catch (error) {
      console.error("Visitor aggregation read failed:", error.name, error.code || "unknown");
      return res.status(503).json({ error: "service_unavailable", message: "訪問者数を取得できませんでした。" });
    }
  }

  return { collect, statistics };
}
