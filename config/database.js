import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "ai_workspace_db";
let clientPromise;

export const isDatabaseConfigured = () => Boolean(uri);

export async function getCollection(collectionName) {
  if (!["connection_test", "todos"].includes(collectionName)) {
    throw new Error("Unsupported collection name");
  }
  if (!uri) {
    const error = new Error("MongoDB connection is not configured");
    error.code = "DB_NOT_CONFIGURED";
    throw error;
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 5,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }

  const client = await clientPromise;
  return client.db(databaseName).collection(collectionName);
}

export async function getDemoCollection() {
  return getCollection("connection_test");
}

export async function getTodosCollection() {
  return getCollection("todos");
}
