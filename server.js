import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRoutes from "./routes/apiRoutes.js";
import { isDatabaseConfigured } from "./config/database.js";

const app = express();
const port = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_req, res) => {
  const configured = isDatabaseConfigured();
  const endpoints = [
    { method: "GET", path: "/health", description: "APIサーバーの稼働状態を確認します。", available: true },
    { method: "GET", path: "/api/users", description: "登録済みのデモデータをすべて取得します。", available: configured },
    { method: "GET", path: "/api/users/:id", description: "IDで指定したデモデータを1件取得します。", available: configured },
    { method: "GET", path: "/api/users?status=active", description: "status条件に一致するデモデータを検索します。", available: configured },
  ];

  res.render("index", { endpoints, configured });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-workspace-api" });
});

app.use("/api", apiRoutes);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found", message: "APIエンドポイントが見つかりません。" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`AI Workspace API listening on port ${port}`);
});
