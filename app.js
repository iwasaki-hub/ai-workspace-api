import express from "express";
import swaggerUiDist from "swagger-ui-dist";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRouter } from "./routes/apiRoutes.js";
import { isDatabaseConfigured } from "./config/database.js";
import { icon } from "./ui/icons.js";
import { publicResources } from "./ui/resources.js";
import { applySecurityHeaders, createApiRateLimiter } from "./middleware/security.js";
import { createMetricsHandlers } from "./middleware/metrics.js";
import { createAccessLogger } from "./middleware/accessLogger.js";
import { createVisitorHandlers } from "./middleware/visitors.js";
import { SITE_ORIGIN, SOCIAL_PAGES, sendSocialCard } from "./social.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ collectionProvider, todoCollectionProvider, metricsCollectionProvider, databaseConfigured = isDatabaseConfigured(), rateLimitOptions, metricsNow, accessLogOptions, visitorCollectionProvider, visitorNow } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(applySecurityHeaders);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  // Shared, allowlisted SVG icon renderer for every EJS page.
  app.locals.icon = icon;
  app.locals.socialOrigin = SITE_ORIGIN;
  app.use(express.static(path.join(__dirname, "public")));
  // Serve the installed Motion browser build locally: no CDN or API key required.
  app.use("/motion-assets", express.static(path.join(__dirname, "node_modules", "motion", "dist"), { index: false }));

  // Serve the OpenAPI contract and bundled Swagger UI assets from this server.
  app.get("/openapi.json", (_req, res) => res.sendFile(path.join(__dirname, "openapi.json")));
  app.get("/social-card.png", sendSocialCard);
  app.use("/swagger-assets", express.static(swaggerUiDist.getAbsoluteFSPath(), { index: false }));
  app.get("/swagger", (_req, res) => res.render("swagger", { social: SOCIAL_PAGES["/swagger"], socialPath: "/swagger" }));
  app.get("/swagger/", (_req, res) => res.render("swagger"));

  app.get("/", (_req, res) => {
    const endpoints = [
      { method: "GET", path: "/health", description: "APIサーバーの稼働状態を確認します。", available: true },
      { method: "GET", path: "/api/users", description: "登録済みのデモデータをすべて取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users/:id", description: "IDで指定したデモデータを1件取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/users?status=active", description: "status条件に一致するデモデータを検索します。", available: databaseConfigured },
      { method: "GET", path: "/api/todos", description: "公開デモToDoを一覧取得します。", available: databaseConfigured },
      { method: "GET", path: "/api/todos/:id", description: "IDで指定した公開デモToDoを1件取得します。", available: databaseConfigured },
    ];
    res.render("index", { endpoints, resources: publicResources, configured: databaseConfigured, social: SOCIAL_PAGES["/"], socialPath: "/" });
  });

  app.get("/statistics", (_req, res) => res.render("statistics", { pageTitle: "統計ダッシュボード", social: SOCIAL_PAGES["/statistics"], socialPath: "/statistics" }));
  app.get("/examples", (_req, res) => res.render("examples", { pageTitle: "使い方・コードサンプル", social: SOCIAL_PAGES["/examples"], socialPath: "/examples" }));

  const accessLogger = createAccessLogger(accessLogOptions);
  const visitorHandlers = createVisitorHandlers({ collectionProvider: visitorCollectionProvider, now: visitorNow });
  // Consent-only first-party browser pings; never counted as public API traffic.
  app.post("/visitor/collect", createApiRateLimiter(rateLimitOptions), express.json({ limit: "1kb" }), visitorHandlers.collect);
  app.use("/health", accessLogger);
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "ai-workspace-api" });
  });

  const { trackRequest, getStats, getDetailedStats } = createMetricsHandlers(metricsCollectionProvider, metricsNow);
  // Log every API response, including 429, 404 and 503, before rate limiting.
  app.use("/api", accessLogger);
  app.use("/api", createApiRateLimiter(rateLimitOptions));
  app.get("/api/stats", getStats);
  app.get("/api/stats/details", getDetailedStats);
  app.get("/api/stats/visitors", visitorHandlers.statistics);
  app.use("/api", trackRequest);
  app.use("/api", createApiRouter(collectionProvider, todoCollectionProvider));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "APIエンドポイントが見つかりません。" });
  });

  return app;
}
