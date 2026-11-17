# 専用統計ダッシュボード — 2026-11-17

## 目的
既存のトップページの統計カードは維持し、EJS + Express のルーティング `GET /statistics` を追加。
今日、今月、累計、直近7日、API別4ルートのアクセス状況を表示する。
共通ヘッダー・フッター・モバイルメニュー・既存の配色とMotionは引き継ぐ。

## API設計
- `GET /api/stats` は従来の `{totalRequests,startedAt}` を維持（後方互換性）。
- `GET /api/stats/details` で `totalRequests`, `todayRequests`, `monthRequests`, `date`, `month`, `timezone`, `startedAt`, `last7Days`（7件）, `endpoints`（4件）を返す。
- 日付・月の境界は固定の日本時間 `Asia/Tokyo` (JST) とする。サーバー時間帯には依存しない。
- Users一覧、Users詳細、Todos一覧、Todos詳細の4種類を正規化して集計（クエリ文字列では分離しない）。
- ステータス400/404のGETも従来どおりカウント。レート制限429、health、stats、ページ表示、静的ファイル、書き込みは除外。
- 収集対象のGET終了後、単一ドキュメント `ai_workspace_db.api_metrics` に `$inc` 1回で `total`, `daily.YYYY-MM-DD`, `monthly.YYYY-MM`, `byEndpoint.usersList|usersDetail|todosList|todosDetail` を同時に更新する。
- 既存の累計 `total` と `startedAt` を変更しない。詳細内訳が未作成の場合は0として表示し、過去の内訳を捏造・推測しない。
- 統計用の既存接続 `MONGODB_METRICS_URI` を再利用。追加のDBユーザー・環境変数・コレクションは不要。

## 表示
- ホーム統計セクションに `詳しい統計を見る` の導線を追加
- 共通ヘッダーに `統計` のリンクを追加し、ホームへのアンカーリンクを `/#section` に変更（子ページからも戻れる）
- 3つの大きなパステルカード、直近7日の棒グラフ、API別の横棒グラフ（4ルート）
- `public/js/statistics-dashboard.js` で15秒ごとにAPIから最新データを取得。非表示タブやページ離脱時はポーリング停止。
- DOM要素は `createElement` / `textContent` で構築し、JSONからHTMLを直接挿入しない。
- エラー時は値を偽造せず、表示済みの実数は保持し、エラーステータスを表示。
- CSSでPC・タブレット・iPhone幅までレスポンシブ対応。

## 制約・注記
- 日別・月別・API別カウントはこの機能の**デプロイ後から**収集。以前の累計数とは一致しない可能性がある。
- カウントはGET完了後の非同期でベストエフォート。突然のプロセス終了などでは微少な欠損があり得る。
- 使用中の統計専用MongoDBユーザーの権限はDB全体へのreadWriteのまま。後日コレクション単位に制限するのが望ましい。
- 高頻度で長年運用する場合、単一MongoDBドキュメントのフィールド数とサイズの監視、日別集計の切り出しを将来検討する。
- 実機ブラウザの視覚確認をした場合のみ実機確認済みとする。

## 検証
- GitHub Actionsのユニット・回帰テストでEJS画面、旧API互換、JST境界、原子的なカウント、除外条件、公開エラー応答、OpenAPIを確認
- Renderデプロイ完了後に本番スモーク9項目を実行し、`/api/stats/details` のレスポンスと旧APIを確認
- 実数と既存カウンターの引継ぎはAtlas `api_metrics` を読み取り確認
