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
- [2026-11-16 モバイルメニューのスクロール時自動クローズ](docs/development/2026-11-16-mobile-menu-scroll.md)
- [2026-11-16 Todosリソース追加](docs/development/2026-11-16-todos-resource.md)
- [2026-11-16 API統計のリアルタイム表示](docs/development/2026-11-16-live-api-statistics.md)
- [2026-11-17 統計専用ページ・日別/月別/API別集計](docs/development/2026-11-17-statistics-dashboard.md)
- [2026-11-17 使い方専用ページとAPIコードサンプル](docs/development/2026-11-17-api-code-examples.md)
- [2026-11-17 APIアクセスログ（Render・プライバシー配慮）](docs/development/2026-11-17-api-access-logs.md)
- [2026-11-17 Webサイトのユニークブラウザ計測](docs/development/2026-11-17-unique-website-visitors.md)
- [2026-11-17 SNSのリンクプレビュー対応](docs/development/2026-11-17-social-share-preview.md)
- 公開ページ: https://ai-workspace-api-327r.onrender.com/
- 初期MVP: 利用者による `/health` と `/api/users` の接続成功を確認（個別検索・異常系の網羅テストは今後実施）

Node.js + Express + EJS + MongoDB Atlas の学習用REST API。GitHubからRenderへ自動デプロイします。

## SNS共有時のリンクプレビュー（OGP / Xカード）

Webサイトのトップページ、統計ページ、使い方ページ、Swagger UIに、EJSがサーバーからHTMLを返す時点でOpen GraphとX(Twitter)カードのメタタグを追加しています。SNSにURLを貼り付けた際、タイトル・説明文・画像を持つリンクカードの表示を意図したものです。各ページの正規URLは `link rel="canonical"` と `og:url` で固定しています。

- OGP画像：`https://ai-workspace-api-327r.onrender.com/social-card.png`（1200×630、PNG、サーバーがコミット済みSVGから生成しキャッシュ）
- デザイン原本：`public/social-card.svg`。画像に動的な訪問者数や個人情報は含めません。
- 各ページに固有の `og:title` / `og:description` / `twitter:title` / `twitter:description` を設定。
- `twitter:card=summary_large_image`、`og:image:alt`、`og:image:width/height` なども付与。
- JavaScript不要でボットが読み取れます。API・DBの契約、アクセスカウンターには影響しません。
- 最終的なカードの表示・キャッシュ反映時間はSNS各社に依存します。実際の投稿や各プラットフォームで確認してください。

## 日常英会話リソース

トップページの**「利用できるリソース」だけ**に `GET /api/english-phrases` を追加しました。日本語訳と場面カテゴリ付きの固定センテンス10件をJSONで返します。MongoDB不要・読み取り専用です。既存の「APIエンドポイント」「APIを試す」「使い方」のUIには追加しません。リソース一覧で10件と表示し、クリックするとJSONを別タブで表示します。

## UIアニメーション

公式npmパッケージ `motion` を使い、スクロール時の表示やカード・ボタンの控えめなアニメーションを追加しています。すべての動きは `public/js/animations.js` で一元管理し、動きを減らすユーザー設定を尊重します。既存デザインとEJS構造はそのままです。

## API Statistics

トップページに、集計開始後の累計GETリクエスト数・公開リソース数・開始年を表示します。APIのベースURLコピーと技術スタックの紹介も追加しました。累計数はMongoDB Atlasの`api_metrics`へ保存し、`GET /api/stats`で取得します。ブラウザは表示中のみ約15秒間隔で更新します（`/api/stats`自体はカウント対象外）。集計はベストエフォートで、障害時などの欠落の可能性があります。

統計専用の接続には環境変数`MONGODB_METRICS_URI`を使用し、従来の`MONGODB_URI`は読み取り専用のままです。詳細は[開発記録](docs/development/2026-11-16-live-api-statistics.md)をご確認ください。

## 詳細統計ダッシュボード

[専用ページ（/statistics）](https://ai-workspace-api-327r.onrender.com/statistics)で今日・今月・累計アクセス数、直近7日間の推移、API別の利用件数を確認できます。日本時間（JST）を基準に、15秒間隔（ページ表示時のみ）で更新します。

[GET /api/stats/details](https://ai-workspace-api-327r.onrender.com/api/stats/details)が詳細のJSONデータを返します。既存の `/api/stats` は仕様変更しません。**詳細な日・月・API別カウンターは新機能のデプロイ後から集計し、過去の内訳は復元されません。** 全期間の累計は従来値を引き継ぎます。

## 使い方・APIコードサンプル

[使い方の専用ページ（/examples）](https://ai-workspace-api-327r.onrender.com/examples)でJavaScript・Python・curlのコードサンプルを切り替えられます。公開GET APIの9種類の例を選び、そのままコードをコピーできます。ID検索は一覧から取得した24桁のObjectIdを入力してください。メニューの「使い方」はこの専用ページへ移動します。JavaScriptのサンプルは本サイトのブラウザ開発者ツールでの実行を想定しており、異なるWebサイトのブラウザから呼び出すとCORS制限を受ける場合があります。

## APIアクセスログ

`/api/*` と `/health` へのリクエストについて、日時（UTC）、HTTPメソッド、正規化したエンドポイント、ステータスコード、応答時間（ms）、途中切断の有無を **Renderのアプリケーションログへ1行JSON** で記録します。HTTP 429も対象です。

Renderのサービス管理画面の「Logs」で `api_access` を検索すると確認できます。プライバシーを保護するため、新しく追加したログはIP、ユーザーID実値、クエリ文字列、認証ヘッダーを保存しません。公開ログ取得APIはありません。**Render標準のリクエストログは別途存在し、その情報はこの匿名化対象外です。** ログ保持期間はRenderのプランに依存します。MongoDBの設定・既存の統計カウンターには変更ありません。

## Webサイトのユニーク訪問者（オプトイン）

`/statistics` に「今日・今月のユニークブラウザ」を追加しました。トップページ・統計ページ・使い方ページで、訪問者が明示的に同意した場合に限りブラウザ内でランダムなIDを生成し、期間別ハッシュのみをMongoDB Atlasに期限付きで保存します。IP・生のID・ページ履歴は保存しません。フッターの「訪問者計測の設定」から停止でき、GPC/DNTも尊重します。実際の人数ではなく同意したブラウザの概数です。過去分は推定補完しません。

新規 `GET /api/stats/visitors` は今日・今月の訪問者集計値のみを返します。既存APIカウンターは不変です。統計用Atlasユーザーで `website_visitors` コレクションとTTLインデックスを初期化し、期間終了から約40日後にレコードが失効します。詳しくは開発記録をご確認ください。

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
| GET | `/statistics` | EJSの専用統計ダッシュボード |
| GET | `/examples` | EJSの使い方・コードサンプル専用ページ |
| GET | `/health` | サーバーの稼働確認（DB接続確認は行いません） |
| GET | `/api/users` | デモデータを取得（最大50件） |
| GET | `/api/users?status=active` | activeのデモデータを取得（inactiveも指定可能） |
| GET | `/api/users/:id` | 指定したデモデータを1件取得 |
| GET | `/api/todos` | 公開デモToDoを最大50件取得 |
| GET | `/api/todos/:id` | ObjectIdで公開デモToDoを1件取得 |
| GET | `/api/stats` | 累計APIリクエスト数・集計開始日時の取得 |
| GET | `/api/stats/details` | 今日・今月・直近7日・API別アクセス数（JST） |
| GET | `/api/stats/visitors` | 同意済みユニークブラウザの今日・今月の集計値 |

GET APIは `ai_workspace_db.connection_test` と `ai_workspace_db.todos` の `demo: true` のレコードのみを返します。ユーザーの返却フィールドは `id`, `name`, `status`, `purpose`、ToDoは `id`, `title`, `completed` のみです。MongoDBの `_id` は文字列の `id` に変換します。書き込み用APIはありません。

**接続が設定されていない場合やAtlasへ到達できない場合、データAPIはHTTP 503を返します。** `/health` が200でもDB接続済みという意味ではありません。

## 利用できるリソース

トップページの[Resources](https://ai-workspace-api-327r.onrender.com/#resources)に、現在公開されている `/api/users` と `/api/todos` のリンクと公開一覧の表示件数を掲載しています。リソースの表示定義は `ui/resources.js` に一元管理しており、実装済みのGET APIが増えたときに拡張できます。現在は最大50件の表示件数を示します。

## ブラウザでAPIを試す

公開ページの [APIを試す](https://ai-workspace-api-327r.onrender.com/#try-api) から、GET `/health`、ユーザー一覧・ID検索、status検索、ToDo一覧・ID検索をフォーム操作で実行できます。JSON結果は画面内に表示されます。書き込み機能はありません。

## 公開APIの保護

`/api/*` はIPごとに**60秒あたり120リクエスト**に制限します。超過した場合はHTTP 429と `Retry-After`・`RateLimit` ヘッダーを返します。`/health`、ドキュメント、Swagger UIは対象外です。基本的なHTTPセキュリティヘッダーも設定済みです。カウントはアプリのメモリ内で管理するため、再起動でリセットされ、複数インスタンスには共有されません。詳しくは[開発記録](docs/development/2026-11-16-api-security.md)を参照してください。

## テスト

`npm test` でMongoDBの認証情報不要の回帰テスト（76ケース）を実行できます。GitHub Actionsも `main` へのpushとPull Requestで自動実行します。実データベースへの統合テストとは区別してください。

### 本番スモークテスト

GitHub Actionsの `Production API Smoke Test`（Users・Todos・統計の合計9項目）が、`main` へのpush・毎日09:00 JST・手動実行で公開GET APIの応答を検証します。MongoDB認証情報は使用せず、Renderの公開エンドポイントにアクセスします。

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
- `MONGODB_METRICS_URI`：統計用の別MongoDBユーザー接続URI（API用読み取り専用ユーザーとは分離）

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
