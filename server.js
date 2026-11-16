import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Workspace API</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f8fa; color: #15283b; }
      main { max-width: 640px; margin: 24px; padding: 40px; background: white; border-radius: 18px; box-shadow: 0 10px 32px #15283b10; }
      h1 { margin-top: 0; }
      a { color: #0969a2; }
      code { background: #eef5f7; padding: 3px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <main>
      <h1>AI Workspace API</h1>
      <p>Express API の初期ページです。MongoDB Atlas との接続と API ドキュメントは今後追加します。</p>
      <p>稼働確認: <a href="/health"><code>GET /health</code></a></p>
    </main>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ai-workspace-api" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`AI Workspace API listening on port ${port}`);
});
