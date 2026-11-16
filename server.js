import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT) || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const endpoints = [
  { method: "GET", path: "/health", description: "APIサーバーの稼働状態を確認します。", available: true },
  { method: "GET", path: "/api/users", description: "登録済みのデモデータをすべて取得します。", available: false },
  { method: "GET", path: "/api/users/:id", description: "IDで指定したデモデータを1件取得します。", available: false },
  { method: "GET", path: "/api/users?status=active", description: "status条件に一致するデモデータを検索します。", available: false },
];

app.get("/", (_req, res) => {
  res.render("index", { endpoints });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-workspace-api" });
});

app.use("/api", (_req, res) => {
  res.status(501).json({ error: "not_implemented", message: "このAPIは今後実装予定です。" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`AI Workspace API listening on port ${port}`);
});
