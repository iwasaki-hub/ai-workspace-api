# Webサイトのユニークブラウザ計測（2026-11-17）
## 定義
- 対象は `/`、`/statistics`、`/examples` のEJSページ。明示的に同意したブラウザを計測します。
- 人間の実人数ではなく、同意済みブラウザの推定ユニーク数です。別端末・別ブラウザは別カウントで、拒否やJavaScript無効では計測されません。
- 今日と今月をJSTで集計し、過去データは遡及復元しません。既存のAPIアクセス集計とは完全に別系統です。
## プライバシー
- 同意前に識別子を生成・送信しません。GPC/DNTを尊重し、いつでもフッター設定から停止・端末内ID削除が可能です。
- localStorage内にcrypto.randomUUIDで生成した匿名IDのみを保管。サーバーでは日・月別のSHA-256ハッシュで重複排除し、生ID/IP/ユーザーエージェント/閲覧ページをMongoDBに保存しません。
- website_visitorsコレクションの期間別ハッシュはTTLインデックスで期間終了後約40日で削除（実行は非同期）。過去の集計済み数は同意撤回後に遡って減らしません。
## 実装
- POST /visitor/collect: JSON上限1KB、UUID v4検証、Origin・Sec-Fetch-Site確認、レート制限。成功204、不正400、跨サイト403、レート制限429、DB障害503。
- GET /api/stats/visitors: todayVisitors, monthVisitors, date, month, timezone, measurementを返す読み取り専用の集計値。画面表示中のみ15秒更新。
- MONGODB_METRICS_URIの既存接続を使用し、website_visitorsのperiodインデックスとexpiresAt TTLインデックスを初回アクセスで作成。新しいシークレット不要、既存api_metricsは変更なし。
- ランダムな匿名IDは偽造可能であるため訪問者数は参考値。ログイン済みユーザーの実人数として扱わない。
## 検証
- CIで既存API互換、同意関連UI、日/月の重複排除、JST境界、不正入力・CSRF、障害応答、OpenAPIの検証を実施。
- Render Live、公開の読み取りAPIを確認後に完了とする。ブラウザ実機の同意操作は別途確認対象。
