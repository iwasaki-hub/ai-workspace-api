import { ObjectId } from "mongodb";
import { getDemoCollection } from "../config/database.js";

function toPublicDocument(doc) {
  return {
    id: doc._id.toHexString(),
    name: doc.name ?? null,
    status: doc.status ?? null,
    purpose: doc.purpose ?? null,
  };
}

function sendDatabaseError(error, res) {
  console.error("MongoDB read failed:", error.name, error.code || "unknown");

  if (error.code === "DB_NOT_CONFIGURED") {
    return res.status(503).json({
      error: "service_unavailable",
      message: "データベース接続は設定中です。",
    });
  }

  return res.status(503).json({
    error: "service_unavailable",
    message: "データを取得できませんでした。時間をおいて再試行してください。",
  });
}

export async function listUsers(req, res) {
  const status = req.query.status;
  if (status !== undefined && (typeof status !== "string" || !["active", "inactive"].includes(status))) {
    return res.status(400).json({
      error: "invalid_status",
      message: "statusにはactiveまたはinactiveを指定してください。",
    });
  }

  const filter = { demo: true };
  if (status !== undefined) filter.status = status;

  try {
    const collection = await getDemoCollection();
    const docs = await collection
      .find(filter, { projection: { name: 1, status: 1, purpose: 1 }, maxTimeMS: 5000 })
      .sort({ _id: 1 })
      .limit(50)
      .toArray();

    return res.json(docs.map(toPublicDocument));
  } catch (error) {
    return sendDatabaseError(error, res);
  }
}

export async function getUserById(req, res) {
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    return res.status(400).json({
      error: "invalid_id",
      message: "IDは24桁の16進数で指定してください。",
    });
  }

  try {
    const collection = await getDemoCollection();
    const doc = await collection.findOne(
      { _id: new ObjectId(id), demo: true },
      { projection: { name: 1, status: 1, purpose: 1 }, maxTimeMS: 5000 },
    );

    if (!doc) {
      return res.status(404).json({
        error: "not_found",
        message: "指定されたデータは見つかりませんでした。",
      });
    }

    return res.json(toPublicDocument(doc));
  } catch (error) {
    return sendDatabaseError(error, res);
  }
}
