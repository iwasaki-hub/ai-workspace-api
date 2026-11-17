# APIアクセスログ（2026-11-17）

## 目的
公開GET APIへのアクセス状況を調査・監視できるよう、リクエスト日時、エンドポイント、HTTPステータス、処理時間（ms）をログに記録する。

## 実装
- `middleware/accessLogger.js` の共通Expressミドルウェアで、HTTPレスポンスの `finish` イベント時に1行のJSON（structured logging）を標準出力へ出力する。クライアントが途中で切断した場合は `close` イベントで `statusCode:null`・`aborted:true` を記録する。
- `app.use('/api', accessLogger)` はIP別レート制限ミドルウェアより**前**に配置し、429応答も記録する。 `/health` も記録対象。
- 出力フィールド：`event:'api_access'`、`timestamp`（UTC ISO8601、リクエスト開始時刻）、`method`、`endpoint`、`statusCode`、`durationMs`（サーバー処理時間、単調時計）、`aborted`。
- 例（説明用・実データではない）：
```json
{"event":"api_access","timestamp":"2026-11-17T05:30:00.000Z","method":"GET","endpoint":"/api/users","statusCode":200,"durationMs":34.18,"aborted":false}
```
- `GET /api/users/:id` および `GET /api/todos/:id` はIDを `:id` に置換して保存。
- ステータス確認 `/api/stats`, `/api/stats/details` を含めた全 `/api` へのHTTPメソッドを記録。未知ルートは `/api/*` として記録。
- HTTPステータス400/404/429/503の原因把握が可能。既存の運用カウンターはUsers・TodosのGETのみ記録し、この機能によって集計条件やデータ構造は変わらない。

## プライバシーとセキュリティ
- **新しく導入するアプリログには** IP、X-Forwarded-For、Cookie、Authorization、User-Agent、クエリ文字列、ID実値、リクエスト本文、レスポンス本文、MongoDB接続URIを含めない。
- 許可済みルートを正規化して出力するため、不審なリクエストパスの機密文字列も記録しない。
- ログの保存先はRenderのアプリケーションログ。誰でも閲覧できる `/api/logs` のような公開HTTP APIは追加しない。**Render側が標準で収集するHTTPリクエストログは別機能であり、このミドルウェアの匿名化方針の対象外。**
- 既存MongoDBへのアクセス権限拡大や追加コレクションは不要。
- ログ出力失敗はHTTPレスポンスに影響しない。

## 確認方法
Renderダッシュボードの対象サービス `ai-workspace-api` の「Logs」でアプリケーションログ（`api_access`）を検索する。
可能な場合は、RenderのMCP `list_logs` から `event":"api_access` を検索して確認する。

## 制約
- Render側のログ保持期間・保存件数はプランやポリシーに従う。長期保存・永続的なアクセス履歴を保証するものではない。
- `durationMs` はExpressサーバーの応答処理時間。インターネット経路上の通信遅延は含まない。
- プロセス異常終了時には未出力ログが欠ける可能性がある。
- 管理者用のアクセスログ閲覧画面や集計・検索APIは今回追加しない（認証／権限制御なしで公開するべきではない）。

## 検証内容
リクエスト区分別HTTPステータス、429の記録、未知パスやクエリなどの秘匿、close/finishによる二重記録防止、ロギング失敗時の応答継続、MongoDBの集計カウンターへの非干渉を自動テストする。
