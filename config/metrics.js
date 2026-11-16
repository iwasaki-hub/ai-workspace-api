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
