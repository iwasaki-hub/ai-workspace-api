# 開発工程記録 — AI Workspace API

- 記録日: 2026-11-16
- 対象リポジトリ: [iwasaki-hub/ai-workspace-api](https://github.com/iwasaki-hub/ai-workspace-api)
- 公開URL: https://ai-workspace-api-327r.onrender.com/
- 記録範囲: 企画・要件定義から、MongoDB Atlas連携の初期GET API公開・接続確認まで
- 現在の段階: **初期MVPの疎通確認済み**（追加の自動テストは未整備）

> この文書は開発の実施内容と確認結果を残す記録です。**確認済みの事実**と**今後の予定**を分けています。MongoDB認証情報や接続URI全文は記録しません。

## 1. 企画・要件定義

### 1.1 目的

[JSONPlaceholder](https://jsonplaceholder.typicode.com/) のように、一般ユーザーや開発者が公開URLからJSONデータを読み取れる学習用REST APIを構築する。

初期スコープ:

1. MongoDB Atlasに保存したデモデータをExpress経由でJSONとして配信する。
2. EJSでAPI仕様ページを作り、利用できるエンドポイントと使い方を掲載する。
3. GitHubでコードを管理し、RenderのWeb Serviceに自動デプロイする。
4. 一般ユーザーにはMongoDBの接続情報を開示せず、公開APIは読み取り専用にする。

後から拡張する候補: API実行テスト画面、OpenAPI/Swagger UI、APIキー認証、ページネーション、必要性を判断した上での書き込み機能。

### 1.2 技術選定

| 役割 | 採用技術 | 理由 |
| --- | --- | --- |
| APIサーバー | Node.js + Express | GET APIとルーティングをシンプルに構築 |
| API仕様ページ | EJS | 共通ヘッダー・フッターなどを部品化できる |
| CSS / JavaScript | 個別の静的ファイル | 見た目と動作をテンプレートから分離 |
| データベース | MongoDB Atlas (M0) | 既存のデモコレクションを再利用 |
| バージョン管理 | Git / GitHub | 履歴管理と自動デプロイの起点 |
| ホスティング | Render Web Service (Free) | GitHub mainからの自動デプロイ |

Reactは今回のAPI仕様ページには不要と判断し、初期構成には採用しなかった。

## 2. 実施した開発工程（2026-11-16）

### Phase 0 — データベース準備

- MongoDB Atlasの既存プロジェクト `mcp-ai-practice`、クラスター `Cluster0` (M0) を使用。
- データベース `ai_workspace_db`、コレクション `connection_test` を用意。
- `demo: true` のサンプル3件を登録し、MCP経由で取得できることを確認。
  - デモ太郎（active／接続テスト）
  - デモ花子（active／読み取りテスト）
  - デモ次郎（inactive／検索テスト）

### Phase 1 — GitHubリポジトリと最小Expressサーバー

- Publicリポジトリ `iwasaki-hub/ai-workspace-api` を使用。
- `package.json`, `server.js`, `README.md`, `.env.example` を作成。
- 初期ルート `GET /`（案内ページ）、`GET /health`（JSONで稼働確認）を実装。
- ExpressはRenderの `PORT` を使用し、`0.0.0.0` で待ち受けるよう設定。
- `.gitignore` で `.env` や `node_modules` をGit管理対象から除外。

### Phase 2 — Renderへの初回公開

- GitHubリポジトリの `main` ブランチをRender Web Service `ai-workspace-api` に連携。
- Render設定:
  - Runtime: Node
  - Region: Singapore
  - Plan: Free
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Auto Deploy: 有効
- 公開URL: https://ai-workspace-api-327r.onrender.com/
- Renderのデプロイ状態 `live` を確認。後に利用者も公開ページの表示を確認。

### Phase 3 — EJSによるAPI仕様ページ

- テンプレートに `views/index.ejs` を導入。
- 共通部分は `views/partials/head.ejs`, `header.ejs`, `footer.ejs` に分割。
- CSSを `public/css/style.css`、JavaScriptを `public/js/main.js` に分離。
- エンドポイント一覧、JSON例、JavaScriptの利用例、開発ロードマップを掲載。
- スマートフォン用のメニューやサンプルコードのコピー機能を追加。
- 利用者がページ表示とデザインを確認。Renderのデプロイ状態は `live`。

### Phase 4 — MongoDB AtlasのGET API実装

新規ファイル:

- `config/database.js`: MongoDB接続・コレクション取得、接続失敗時の再試行に備えた管理
- `routes/apiRoutes.js`: GET APIのルーティング
- `controllers/userController.js`: クエリ条件の検証、検索、JSON変換、エラー応答

実装したエンドポイント:

| メソッド | パス | 内容 | 確認状況 |
| --- | --- | --- | --- |
| GET | `/` | EJSのAPI仕様ページ | 利用者が表示を確認 |
| GET | `/health` | Expressサーバーの稼働確認 | 利用者が成功を確認 |
| GET | `/api/users` | `demo: true` の一覧取得（最大50件） | 利用者が成功を確認 |
| GET | `/api/users/:id` | ObjectIdによる1件取得 | 実装済み・個別実行テストは未記録 |
| GET | `/api/users?status=active` | statusで絞り込み | 実装済み・個別実行テストは未記録 |

公開するフィールドは `id`、`name`、`status`、`purpose` のみ（MongoDBの `_id` は文字列 `id` に変換）。書き込みルートは実装しない。

主な異常系: 不正な `status` とID形式には `400`、存在しないIDには `404`、DB未設定・接続失敗には `503`。稼働確認 `/health` はDB疎通チェックではない。

### Phase 5 — Render環境変数・Atlasアクセス制御・実データ接続

- Render側に `MONGODB_URI` と `MONGODB_DB` の環境変数を設定（値・パスワードはGitHubに記録しない）。
- 新規のDB接続用ユーザー `ai_workspace_api_user` を作成。
  - 権限は **`read` on `ai_workspace_db`**、対象クラスター `Cluster0`。
  - 今後新しく作るDBユーザー名は必ず `_user` で終わる命名方針とする。
- MongoDB AtlasのNetwork AccessにRenderのOutbound CIDR 2範囲を追加したことを確認。
- Renderの最新デプロイが `live` であることを確認。
- 利用者がブラウザで **`/health` と `/api/users` の両方の接続成功**を報告。
- サービスの実データ読み取りが利用者環境で成功したため、初期MVPの疎通確認を完了とした。

> 補足: 利用者による接続成功を確認したが、ここに記載した範囲以外の全てのエンドポイントや異常系テストまで成功したという意味ではない。

## 3. 現在のシステム構成

```text
開発PC → GitHub (main) → Render Web Service
                               ├─ GET / (EJS仕様ページ)
一般ユーザー → HTTPS ────────────┼─ GET /health
                               └─ GET /api/users[/:id] → MongoDB Atlas
                                                          └─ Cluster0
                                                             └─ ai_workspace_db
                                                                └─ connection_test
```

RenderのサーバーだけがAtlasへ接続する。一般ユーザーはMongoDBのユーザー名・パスワードを持つ必要がない。

## 4. セキュリティに関する決定・注意

- 公開リポジトリにDBパスワード、接続URI全文、`.env`をコミットしない。
- RenderのEnvironmentに接続情報を保管し、ソースコードから参照する。
- API専用ユーザー `ai_workspace_api_user` は読み取り専用にする。
- AtlasのIP Access Listは必要な送信元に限定し、`0.0.0.0/0` の一括許可は避ける。
- 過去に作られた `ai_workspace_api` は `readAnyDatabase` と権限が広いため、公開API用には使用しない。**既存ユーザーの削除や権限変更は今回行っていない**。
- Renderの公開Web Serviceにおける利用者からのHTTPアクセス許可と、AtlasへのDB接続元のIP Access Listは別の設定。
- 本APIはデモデータのGETだけを想定。機密データ・個人情報は公開コレクションへ混在させない。

## 5. ここまでの確認状況

| 項目 | 結果 |
| --- | --- |
| GitHubソース登録・バージョン管理 | 完了 |
| Renderでの初回デプロイ | `live` 確認 |
| EJS API仕様ページの表示 | 利用者が確認 |
| Render側の環境変数設定 | 利用者が実施 |
| Atlasの読み取り専用ユーザー作成 | 確認済み |
| AtlasのRender用IP許可 | 登録確認済み |
| `GET /health` | 利用者が成功を確認 |
| `GET /api/users` | 利用者が成功を確認 |
| ID検索・status検索・エラーレスポンス全件 | 未テスト／結果未記録 |
| 自動テスト・CI | 未導入 |

## 6. 次の開発タスク（未実施）

1. **APIの正常系テスト**：全件取得・active/inactive絞り込み・ID指定を検証する。
2. **APIの異常系テスト**：不正ID (400)、存在しないID (404)、無効status (400) などを検証する。
3. **テスト自動化**：Node.jsのテストランナー等を導入してGitHub Actionsで実行する。
4. **仕様ページの改善**：APIの実行例、エラー例、必要ならOpenAPI/Swagger UIを追加する。
5. **運用の見直し**：レート制限、ログ、ドキュメント更新手順、環境変数・アクセス権限の定期確認。

---

## 7. 関連リンク

- [GitHubリポジトリ](https://github.com/iwasaki-hub/ai-workspace-api)
- [公開API仕様ページ](https://ai-workspace-api-327r.onrender.com/)
- [Health API](https://ai-workspace-api-327r.onrender.com/health)
- [Demo API](https://ai-workspace-api-327r.onrender.com/api/users)

更新時は、実装済み・公開済み・テスト済みの状態を混同せず、確認日と確認方法を明記する。
