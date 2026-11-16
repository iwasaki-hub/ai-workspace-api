# AI Workspace API

Node.js + Express を使用した、Render に初回デプロイするための最小アプリです。

## 現在の機能

- `GET /` — 日本語の初期案内ページ
- `GET /health` — 稼働確認用JSON（`{"status":"ok","service":"ai-workspace-api"}`）

**まだMongoDB Atlasへの接続、EJSページ、公開データAPIは実装していません。** 今回はRenderで起動できることの確認が目的です。

## ローカル起動

Node.js 20以上をインストールして、以下を実行します。

```bash
npm install
npm start
```

- http://localhost:3000/
- http://localhost:3000/health

## Render の初回設定

RenderのDashboardから **New → Web Service** を選択し、GitHubリポジトリ `iwasaki-hub/ai-workspace-api` を接続します。

| 設定 | 値 |
| --- | --- |
| Language | Node |
| Branch | main |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free（学習用） |

Renderが設定する`PORT`環境変数をアプリが使用し、`0.0.0.0`で待ち受けます。最初はMongoDBの接続情報を登録する必要はありません。

## セキュリティ

- `.env`やAPIキー、DBパスワードはGitHubにコミットしないでください。
- 将来のDB接続情報はRenderの **Environment** で設定します。
- MongoDB AtlasのIP Access Listは、Renderサービス作成後に確認できるOutbound IP範囲に合わせて設定します。
- APIの公開は当面読み取り専用を予定しています。

## 今後の予定

1. Renderに初回デプロイし、`/`と`/health`が応答することを確認
2. EJSによるAPI仕様ページ
3. MongoDB Atlasの読み取り専用GET API
