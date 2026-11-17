import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const SITE_ORIGIN = "https://ai-workspace-api-327r.onrender.com";
export const SOCIAL_IMAGE_PATH = "/social-card.png";
export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

export const SOCIAL_PAGES = Object.freeze({
  "/": Object.freeze({
    title: "AI Workspace API | 学んで試せるREST API",
    description: "Express・MongoDB Atlasで作られた公開REST API。ユーザー・ToDoのデモデータ、APIプレイグラウンド、Swagger UI、アクセス統計を試せます。",
  }),
  "/statistics": Object.freeze({
    title: "統計ダッシュボード | AI Workspace API",
    description: "APIリクエストの今日・今月の件数、エンドポイント別アクセス数、同意済みWebサイト訪問者数を可視化しています。",
  }),
  "/examples": Object.freeze({
    title: "APIコードサンプル | AI Workspace API",
    description: "JavaScript・Python・curlの実行可能なGET APIサンプルを切り替え、コピーできる使い方ガイドです。",
  }),
  "/swagger": Object.freeze({
    title: "Swagger UI | AI Workspace API",
    description: "AI Workspace APIのOpenAPI 3.1仕様書をSwagger UIで確認。公開GET APIのレスポンスを試せます。",
  }),
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let imagePromise;

/** Convert only our committed, local SVG, never user-controlled content. */
export function getSocialCardPng() {
  if (!imagePromise) {
    imagePromise = readFile(path.join(__dirname, "public", "social-card.svg"))
      .then((svg) => sharp(svg, { density: 72 }).resize(SOCIAL_IMAGE_WIDTH, SOCIAL_IMAGE_HEIGHT).png({ compressionLevel: 9 }).toBuffer())
      .catch((error) => {
        imagePromise = undefined;
        throw error;
      });
  }
  return imagePromise;
}

export function sendSocialCard(_req, res) {
  void getSocialCardPng()
    .then((png) => {
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      res.send(png);
    })
    .catch((error) => {
      console.error("Social image rendering failed:", error.name);
      res.status(503).end();
    });
}
