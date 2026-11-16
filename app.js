import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./routes/apiRoutes.js";
import { isDatabaseConfigured } from "./config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ collectionProvider, databaseConfigured = isDatabaseConfigured() } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (_req, res) => {
    const endpoints = [
      { method: "GET", path: "/health", description: "APIサーバーの稼働状態を確認します。", available: true },
      { method: "GET", path: "/api/users", description: "登録済みのデモデータをすべて取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users/:id", description: "IDで指定したデモデータを1件取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users?status=active", description: "status条件に一致するデモデータを検索します。", available: databaseConfigured },
    ];
    res.render("index", { endpoints, configured: databaseConfigured });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "ai-workspace-api" });
  });

  app.use("/api", createApiRouter(collectionProvider));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "APIエンドポイントが見つかりません。" });
  });

  return app;
}
