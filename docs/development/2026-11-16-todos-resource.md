# Todosリソースの追加（2026-11-16）

## 目的
JSONPlaceholderに近い学習用公開APIとして、既存のUsersに続く2つ目のリソース `todos` を追加する。既存デザイン、読み取り専用の安全性、MongoDB Atlasの既存ユーザー権限を維持する。

## Atlas変更
- プロジェクト: `mcp-ai-practice` / Cluster0
- データベース: `ai_workspace_db`
- コレクション: **`todos`**（新規）
- デモデータ: 5件（いずれも`demo: true`）
- フィールド: `title` (string), `completed` (boolean), `demo` (boolean), MongoDB内部の`_id`
- サンプル: 仕様書を確認する、Swagger UIで試す、Resources確認、新しいtodos APIの動作確認、テストケース追加
- 既存の`connection_test`は変更なし。新規DBユーザーは作成せず、既存のDB読み取り専用ユーザーを利用する。

## API
- `GET /api/todos`: `demo:true`を`_id`昇順で最大50件取得
- `GET /api/todos/:id`: 有効な24桁ObjectIdによる1件検索
- HTTPステータス: 200, 400（ID不正）, 404（存在しない・非公開）, 429（既存レート制限）, 503（DB取得失敗）
- 公開フィールドは `id`, `title`, `completed` のみ。内部フィールド`demo`や接続情報などは公開しない。
- POST/PUT/PATCH/DELETEは公開しない。既存の`/api/users`の挙動は維持する。
- MongoDB接続管理は`config/database.js`で共通化する。

## UIとドキュメント
- `ui/resources.js`にToDoを追加し、Resourcesセクションに2つ目のリソースを表示。実際の公開一覧の表示件数は`public/js/resources.js`で取得。
- `ui/icons.js`にFont Awesomeの`todo`を一元登録。
- `views/index.ejs`と`public/js/explorer.js`でToDo一覧とID検索を試せるようにする。
- OpenAPI 3.1に新しい2つのGETルートと`DemoTodo`スキーマを追加。
- `scripts/smoke-test.mjs`に、公開ToDo 5件とID検索の2項目を追加して計7項目とする。

## 検証
- Atlas側でコレクション存在と5件の保存を確認。
- DBの認証情報を使用しない回帰テストでフィールド制限、demo限定、ID検索、異常系、書き込み禁止、最大50件、UI、OpenAPIを検証。
- GitHub Actions必須テスト成功後に保護されたmainへマージ、Render Liveとデプロイ後の本番スモークテスト（7項目）を確認。
- ユーザーによるスマートフォン表示・クリックの実機確認は別途。

## 重要
今回の`5`は、5件のサンプルToDoを作るという意味で解釈した。実データや個人のToDoは含めない。
既存のパッケージ管理方針に従い`package-lock.json`と`npm ci`は導入しない。
