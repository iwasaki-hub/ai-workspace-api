# AI Workspace API

## 開発記録

- [2026-11-16 開発工程記録（企画・要件定義から初期MVPの接続確認まで）](docs/development/2026-11-16-development-history.md)
- [2026-11-16 GET APIの正常系・異常系テストと自動化](docs/development/2026-11-16-api-tests.md)
- [2026-11-16 mainブランチ保護の設定と失敗テストによる実地検証](docs/development/2026-11-16-branch-protection.md)
- [2026-11-16 公開APIのスモークテストと定期自動実行](docs/development/2026-11-16-production-smoke.md)
- [2026-11-16 ブラウザでAPIを試す機能](docs/development/2026-11-16-api-explorer.md)
- [2026-11-16 OpenAPI 3.1 / Swagger UI の導入](docs/development/2026-11-16-openapi-swagger.md)
- [2026-11-16 OpenAPIリンクの視認性改善](docs/development/2026-11-16-openapi-link-visibility.md)
- [2026-11-16 Font Awesomeアイコンの一元管理](docs/development/2026-11-16-fontawesome-icons.md)
- [2026-11-16 公開APIのセキュリティ強化](docs/development/2026-11-16-api-security.md)
- [2026-11-16 利用できるリソースのセクション追加](docs/development/2026-11-16-resources-section.md)
- [2026-11-16 MotionによるUIアニメーション追加](docs/development/2026-11-16-motion-ui.md)
- 公開ページ: https://ai-workspace-api-327r.onrender.com/
- 初期MVP: 利用者による `/health` と `/api/users` の接続成功を確認（個別検索・異常系の網羅テストは今後実施）

Node.js + Express + EJS + MongoDB Atlas の学習用REST API。GitHubからRenderへ自動デプロイします。

## UIアニメーション

公式npmパッケージ `motion` を使い、スクロール時の表示やカード・ボタンの控えめなアニメーションを追加しています。すべての動きは `public/js/animations.js` で一元管理し、動きを減らすユーザー設定を尊重します。既存デザインとEJS構造はそのままです。

## アイコンの管理

Font Awesome FreeのSVGアイコンを使用しています。**アイコンの選択と名称は `ui/icons.js` に集約**し、EJS画面では `<%- icon("overview") %>` のように用途別のキーで表示します。追加・変更する場合はこのファイルを編集してください。CDNやFont Awesome Kitの設定は不要です。

## OpenAPI / Swagger UI

標準形式のOpenAPI 3.1仕様書を `openapi.json` に追加し、URLからも参照できます。

- [Swagger UI（画面でAPI仕様を確認・GET実行）](https://ai-workspace-api-327r.onrender.com/swagger)
- [OpenAPI JSON（機械可読な仕様書）](https://ai-workspace-api-327r.onrender.com/openapi.json)
- [従来のEJSドキュメント](https://ai-workspace-api-327r.onrender.com/)

Swagger UIでの操作はGETのみです。APIを追加・変更するときは `openapi.json` とテストを同時に更新してください。

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

## 利用できるリソース

トップページの[Resources](https://ai-workspace-api-327r.onrender.com/#resources)に、現在公開されている `/api/users` のリンクと公開一覧の表示件数を掲載しています。リソースの表示定義は `ui/resources.js` に一元管理しており、実装済みのGET APIが増えたときに拡張できます。現在は最大50件の表示件数を示します。

## ブラウザでAPIを試す

公開ページの [APIを試す](https://ai-workspace-api-327r.onrender.com/#try-api) から、GET `/health`、ユーザー一覧、status検索、ID検索をフォーム操作で実行できます。JSON結果は画面内に表示されます。書き込み機能はありません。

## 公開APIの保護

`/api/*` はIPごとに**60秒あたり120リクエスト**に制限します。超過した場合はHTTP 429と `Retry-After`・`RateLimit` ヘッダーを返します。`/health`、ドキュメント、Swagger UIは対象外です。基本的なHTTPセキュリティヘッダーも設定済みです。カウントはアプリのメモリ内で管理するため、再起動でリセットされ、複数インスタンスには共有されません。詳しくは[開発記録](docs/development/2026-11-16-api-security.md)を参照してください。

## テスト

`npm test` でMongoDBの認証情報不要の回帰テスト（33ケース）を実行できます。GitHub Actionsも `main` へのpushとPull Requestで自動実行します。実データベースへの統合テストとは区別してください。

### 本番スモークテスト

GitHub Actionsの `Production API Smoke Test` が、`main` へのpush・毎日09:00 JST・手動実行で公開GET APIの応答を検証します。MongoDB認証情報は使用せず、Renderの公開エンドポイントにアクセスします。

```bash
node scripts/smoke-test.mjs
```

詳細は[公開APIのスモークテスト手順](docs/development/2026-11-16-production-smoke.md)を参照してください。

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

AtlasにはAPI専用の読み取り専用ユーザー `ai_workspace_api_user`（`ai_workspace_db` に `read` 権限）を作成済みです。Renderではこの専用ユーザーのURIを使用してください。既存の `ai_workspace_app` は `readWrite` 権限を持ちますが、公開API用には使用しません。新規DBユーザー名は `_user` で終える命名規則とします。

## ステータスコード

- 200: 成功
- 400: IDやstatusの形式が不正
- 404: 対象IDのデモデータが見つからない
- 503: DB設定がない、またはDBへの接続・読取不可
- 429: 一定時間内のAPIリクエスト上限を超過

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
