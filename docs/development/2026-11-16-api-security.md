# 公開APIのセキュリティ強化（2026-11-16）

## 目的

MongoDB Atlasを使用する公開GET APIに、アプリケーション層のレート制限と基本的なHTTPセキュリティヘッダーを追加する。EJS/Swagger UI・既存の読み取り機能・本番スモークテストは継続する。

## 実装

- `middleware/security.js` でレート制限とヘッダーの設定を管理
- `/api/*` のアクセスを**IPごとに60秒あたり120リクエスト**に制限
- 超過時は `429`、JSONの `rate_limited` エラー、`Retry-After` と `RateLimit` を返す
- `/health`、トップページ、Swagger UI、OpenAPI JSON、静的アセットは制限対象外
- レート制限は `express-rate-limit` のメモリストアを使用。無料プランの単一Renderインスタンスを対象とする
- Render環境（`RENDER=true`）では、Renderの公開WebサービスでCloudflareが付与・上書きする `CF-Connecting-IP` のみを有効なIP形式であることを確認して識別に使用する
- それ以外の環境ではソケットIPを使用。`X-Forwarded-For` は不正に指定できることがあるため、直接信頼しない
- `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`、`Permissions-Policy` でカメラ・マイク・位置情報を禁止
- Swagger UIの動作への影響を抑えるため、CSPの導入は**今回の対象外**とする
- `openapi.json` に429レスポンスを追加

## テストと運用上の注意

- `npm test` で429、RateLimit/Retry-Afterヘッダー、パス間でのリクエスト数共有、ヘルスチェック除外、ローカル環境での偽装ヘッダー無視、Render環境のIP区別、既存の400応答を検証
- Render環境では公開側のプロキシを経由する前提。別のホスティング環境へ移す場合、IP識別ルールを再検討する
- メモリストアはプロセス再起動でカウントがリセットされる。水平スケールする場合にはRedis等の共有ストアへ変更する
- レート制限はDDoS対策の一部であり、これ単独で攻撃を完全に防げるものではない
- 本番監視の5件のGETリクエストは120回/分の閾値に達しない
- `package-lock.json` と `npm ci` はユーザーの判断により引き続き導入しない

## 検証手順

1. 保護されたmain宛のPRでGitHub Actionsを通す
2. マージ後にRenderが `live` へ更新されることを確認
3. `Production API Smoke Test` の成功を確認
4. 公開APIのRateLimit・セキュリティヘッダーの実測は別途確認し、結果を区別して記録する

参考:
- https://render.com/articles/how-render-handles-ddos-attacks
- https://express-rate-limit.mintlify.app/reference/configuration
