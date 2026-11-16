# AI Workspace API

Node.js + Express + EJS + MongoDB Atlas の学習用REST API。GitHubからRenderへ自動デプロイします。

## ページとエンドポイント

| Method | Path | 内容 |
| --- | --- | --- |
| GET | `/` | EJSによるAPI仕様ページ |
| GET | `/health` | サーバーの稼働確認（DB接続確認は行いません） |
| GET | `/api/users` | デモデータを取得（最大50件） |
| GET | `/api/users?status=active` | activeのデモデータを取得（inactiveも指定可能） |
| GET | `/api/users/:id` | 指定したデモデータを1件取得 |

GET APIの対象は、`ai_workspace_db.connection_test` の `demo: true` のレコードのみです。返却フィールドは `id`, `name`, `status`, `purpose` のみです。MongoDBの `_id` は文字列の `id` に変換します。書き込み用APIはありません。

**接続が設定されていない場合やAtlasへ到達できない場合、データAPIはHTTP 503を返します。** `/health` が200でもDB接続済みという意味ではありません。

## ローカル実行

Node.js 20以上:

```bash
npm install
npm start
```

ローカルでDB接続を試す場合は、Git管理対象外の`.env`に接続情報を設定し、Node.js起動時に読み込ませてください（Node.js 20以上の `node --env-file=.env server.js` など）。通常の `npm start` は `.env` を自動では読み込みません。

必要な環境変数:

- `MONGODB_URI`：MongoDB Atlasの接続URI（データベース用ユーザーの認証情報を含む）
- `MONGODB_DB`：データベース名。省略すると `ai_workspace_db`

## Renderの設定

Render Web Service: `ai-workspace-api`

- Build Command: `npm install`
- Start Command: `npm start`
- Auto Deploy: `main`

Renderの **Environment** に `MONGODB_URI` をSecretとして設定します。必要なら `MONGODB_DB=ai_workspace_db` も設定します。実際のパスワードをGitHub、README、チャット等に貼り付けないでください。

MongoDB AtlasのIP Access Listには、Renderダッシュボードのサービスの **Connect → Outbound** に表示される送信元IP範囲を登録してください。すべてのIPを許可する `0.0.0.0/0` は避けます。

AtlasのMongoDBユーザー `ai_workspace_app` は既存のreadWrite権限ですが、**公開APIはGETのみ**です。さらに安全にするため、将来はこのAPI専用のread権限のユーザーを作成することを推奨します。

## ステータスコード

- 200: 成功
- 400: IDやstatusの形式が不正
- 404: 対象IDのデモデータが見つからない
- 503: DB設定がない、またはDBへの接続・読取不可

## ディレクトリ

```text
server.js
config/database.js
controllers/userController.js
routes/apiRoutes.js
views/index.ejs
views/partials/
public/css/style.css
public/js/main.js
```
