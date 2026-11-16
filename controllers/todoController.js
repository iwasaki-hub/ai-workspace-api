import { ObjectId } from "mongodb";
import { getTodosCollection } from "../config/database.js";

const publicFields = { title: 1, completed: 1 };

function toPublicTodo(doc) {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    completed: doc.completed,
  };
}

function sendError(error, res) {
  console.error("MongoDB todos read failed:", error.name, error.code || "unknown");
  return res.status(503).json({
    error: "service_unavailable",
    message: error.code === "DB_NOT_CONFIGURED"
      ? "データベース接続は設定中です。"
      : "データを取得できませんでした。時間をおいて再試行してください。",
  });
}

// Only explicitly marked demo data, with a strict field allowlist, is public.
export function createTodoHandlers(collectionProvider = getTodosCollection) {
  async function listTodos(_req, res) {
    try {
      const collection = await collectionProvider();
      const docs = await collection
        .find({ demo: true }, { projection: publicFields, maxTimeMS: 5000 })
        .sort({ _id: 1 })
        .limit(50)
        .toArray();
      return res.json(docs.map(toPublicTodo));
    } catch (error) {
      return sendError(error, res);
    }
  }

  async function getTodoById(req, res) {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({
        error: "invalid_id",
        message: "IDは24桁の16進数で指定してください。",
      });
    }
    try {
      const collection = await collectionProvider();
      const doc = await collection.findOne(
        { _id: new ObjectId(id), demo: true },
        { projection: publicFields, maxTimeMS: 5000 },
      );
      if (!doc) {
        return res.status(404).json({
          error: "not_found",
          message: "指定されたデータは見つかりませんでした。",
        });
      }
      return res.json(toPublicTodo(doc));
    } catch (error) {
      return sendError(error, res);
    }
  }

  return { listTodos, getTodoById };
}
