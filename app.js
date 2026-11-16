import express from "express";
import swaggerUiDist from "swagger-ui-dist";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./routes/apiRoutes.js";
import { isDatabaseConfigured } from "./config/database.js";
import { icon } from "./ui/icons.js";
import { publicResources } from "./ui/resources.js";
import { applySecurityHeaders, createApiRateLimiter } from "./middleware/security.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ collectionProvider, databaseConfigured = isDatabaseConfigured(), rateLimitOptions } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(applySecurityHeaders);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  // Shared, allowlisted SVG icon renderer for every EJS page.
  app.locals.icon = icon;
  app.use(express.static(path.join(__dirname, "public")));

  // Serve the OpenAPI contract and bundled Swagger UI assets from this server.
  app.get("/openapi.json", (_req, res) => res.sendFile(path.join(__dirname, "openapi.json")));
  app.use("/swagger-assets", express.static(swaggerUiDist.getAbsoluteFSPath(), { index: false }));
  app.get("/swagger", (_req, res) => res.render("swagger"));
  app.get("/swagger/", (_req, res) => res.render("swagger"));

  app.get("/", (_req, res) => {
    const endpoints = [
      { method: "GET", path: "/health", description: "APIサーバーの稼働状態を確認します。", available: true },
      { method: "GET", path: "/api/users", description: "登録済みのデモデータをすべて取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users/:id", description: "IDで指定したデモデータを1件取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users?status=active", description: "status条件に一致するデモデータを検索します。", available: databaseConfigured },
    ];
    res.render("index", { endpoints, resources: publicResources, configured: databaseConfigured });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "ai-workspace-api" });
  });

  app.use("/api", createApiRateLimiter(rateLimitOptions));
  app.use("/api", createApiRouter(collectionProvider));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "APIエンドポイントが見つかりません。" });
  });

  return app;
}
