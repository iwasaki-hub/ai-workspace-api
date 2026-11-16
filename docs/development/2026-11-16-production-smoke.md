# 公開APIスモークテストの自動化 — 2026-11-16

## 目的

Render上の実サービスとMongoDB Atlasを経由した**読み取り処理**を、定期的に確認する。既存の13件のモック利用回帰テストとは独立した検証。

## 対象・スコープ

- 対象: `https://ai-workspace-api-327r.onrender.com`
- 実行ファイル: `scripts/smoke-test.mjs`
- GitHub Actions: `.github/workflows/production-smoke.yml`
- 認証: 不要。一般公開されたGET APIのみ呼び出す。MongoDBのURIやパスワードはCIに登録しない
- データ変更: なし

## 確認内容

| チェック | 期待値 |
| --- | --- |
| `GET /health` | HTTP 200、`status: "ok"`、`service: "ai-workspace-api"` |
| `GET /api/users` | HTTP 200、JSON配列、1～50件、公開4フィールドだけ |
| `GET /api/users/:id` | 一覧から選んだIDを指定して同じ公開レコードを取得 |
| `GET /api/users?status=active` | 配列、各レコードが`active` |
| `GET /api/users?status=inactive` | 配列、各レコードが`inactive` |

一覧での件数が0件の場合も失敗とする。初期デモデータの存在を前提にした監視であり、将来空コレクションを正式に許容する場合は見直す。

レスポンスのフィールドは `id`、`name`、`status`、`purpose` のみを許可し、IDは24桁の16進文字列とする。

## 起動条件と再試行

- `main` へのpush後（Renderの自動デプロイと並行して開始されうる）
- **毎日09:00 JST**（GitHub Actionsのスケジュール遅延可能性あり）
- Actions画面の `Run workflow` による手動実行
- Render無料プランのスリープ復帰やデプロイ中の一時エラーに備え、`/health` と `/api/users` の初期取得をそれぞれ最大12回、15秒間隔で再試行する
- リクエストごとのタイムアウトは12秒
- 不正JSONや契約違反、4xxは基本的に即失敗する。HTTP 5xxと429、タイムアウト、通信エラーは再試行する
- `Production API Smoke` は**PRで必須のチェックには指定しない**。mainへのマージ条件は従来の `Node.js API Regression Tests` とし、公開環境の一時的な停止でPRのマージを不必要に妨げない

## 実行方法

GitHub: [Actions](https://github.com/iwasaki-hub/ai-workspace-api/actions) → `Production API Smoke Test` → `Run workflow`。

ローカル:

```sh
API_BASE_URL=https://ai-workspace-api-327r.onrender.com node scripts/smoke-test.mjs
```

終了コード `0` は全チェック成功、`1` は少なくとも1つ失敗。ログの `PASS`、`RETRY`、`SMOKE TEST FAILED` を確認する。失敗時にはGitHub Actionsの通知設定やワークフロー実行履歴を確認する。

## 注意点

- 本検証が成功した場合、**テスト実行時点の公開GET APIが期待どおり応答**したといえる。ただし直近のコミットがすでにRenderへ反映されたことを保証するものではない（ビルド完了待ちの競合が起きうる）。
- すべてのDBクエリの正しさ・性能・安全性や、書き込み不可の保証は別のテストで検証する。
- スケジュールはGitHub側の事情で遅延・停止する場合がある。継続監視が重要なら外部監視も検討する。
- 環境変数 `MONGODB_URI` はRenderにのみ保持し、このテストでは使わない。
