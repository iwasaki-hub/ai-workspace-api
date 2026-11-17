import { MongoClient } from "mongodb";

/**
 * Dedicated MongoDB connection for aggregate counters.
 * Do not use the existing read-only API connection for writes.
 */
const metricsUri = process.env.MONGODB_METRICS_URI;
const databaseName = process.env.MONGODB_DB || "ai_workspace_db";
let clientPromise;

export async function getMetricsCollection() {
  if (!metricsUri) {
    const error = new Error("Metrics database connection is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }
  if (!clientPromise) {
    const client = new MongoClient(metricsUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 3,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return (await clientPromise).db(databaseName).collection("api_metrics");
}

let visitorIndexPromise;

/** Visitor records contain only period-specific irreversible hashes and expire automatically. */
export async function getVisitorCollection() {
  await getMetricsCollection();
  const collection = (await clientPromise).db(databaseName).collection("website_visitors");
  if (!visitorIndexPromise) {
    visitorIndexPromise = Promise.all([
      collection.createIndex({ period: 1 }, { name: "visitor_period" }),
      collection.createIndex({ expiresAt: 1 }, { name: "visitor_expiry_ttl", expireAfterSeconds: 0 }),
    ]).catch((error) => {
      visitorIndexPromise = undefined;
      throw error;
    });
  }
  await visitorIndexPromise;
  return collection;
}
