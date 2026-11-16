# Live API Statistics（2026-11-16）

## 目的とレイアウト
JSONPlaceholder風のAPI統計・技術紹介セクションを、既存のネイビー/ブルー/ミントのデザインに統合する。トップページの機能カード直後に設置し、公開リソース数、開始年、APIへの累計GETリクエスト数、コピー可能なAPIベースURL、技術スタックを紹介する。

## 集計方法と対象
- Atlas `ai_workspace_db.api_metrics` のドキュメント `_id: "public-api"` を新規作成し `total: 0` に初期化（集計開始以前の過去件数は含めない）
- GET `/api/users`, `/api/users/:id`, `/api/todos`, `/api/todos/:id`（クエリ付き含む）を1件ずつ計測
- GETの200、400、404等は計測。レート制限で拒否された429は計測しない
- `/health`, `/api/stats`, ドキュメント、CSS/JS、その他不明なパス、POST/PUT等の書き込みリクエストは対象外
- API応答の `finish` 後に `$inc` を呼び出すベストエフォート方式。集計DB障害や突発的シャットダウンによる数件の取りこぼしはあり得る。課金・法的監査の厳密な数値ではない
- `GET /api/stats` は `totalRequests`, `startedAt` を返し、未設定/DB取得不可の際は503。認証情報やMongoDB内部情報を公開しない

## 環境設定
- 既存の `MONGODB_URI`（専用readユーザー）と完全に分離し、`MONGODB_METRICS_URI`（統計用の別ユーザー）で `api_metrics` に接続
- Renderには環境変数を既存値を保持するマージモードで追加し、秘密値をGitHub・ドキュメントに保存しない
- Atlasでは `ai_workspace_metrics_user` に `ai_workspace_db` の `readWrite` を付与している。**現在の権限はDB単位でありcollection単位ではない**。将来的にAtlasのカスタムロール（`api_metrics`だけの読み書き権限）でさらに絞ることを推奨
- インデックスはMongoDBのデフォルト `_id` のみ。複数インスタンスでも `$inc` は原子的
- Render Freeのスリープ/再起動でもAtlasの累計値は維持する

## フロントエンド
- `views/index.ejs`: 3枚のパステルカード、ベースURLのコピー、集計開始日、Express/Atlas/Renderのバッジ
- `public/js/statistics.js`: 15秒ごとに `GET /api/stats` を取得し、ページが非表示になれば停止・復帰時に再取得。取得できないときは実数を捏造せず「—」または取得エラーを表示
- `public/js/animations.js` のMotionでスクロール表示を追加。数字の変更はモーションを減らす設定を尊重
- 公開リソース数は`ui/resources.js`に基づく。開始年は2026年
- 個別APIの取得結果、既存コピー機能、Swagger UI等を壊さない

## 検証手順
1. 新しい集計の開始状態が0であることをAtlasで確認
2. GitHub Actions回帰テストで統計のGET、対象ルートのカウント、除外、429、503、HTML、OpenAPIを検証
3. 保護されたmainにPR経由でマージし、RenderデプロイがLiveになることを確認
4. デプロイ後の本番スモーク8項目（旧7+新統計）を確認
5. スマートフォンの画面表示、カウンター表示・コピー、Motionの実機目視確認は別途

注意: ブラウザによる15秒ごとの統計ポーリング自体はカウント対象外ですが、アクセスが継続する限りRenderのFreeスリープに影響し得ます。
