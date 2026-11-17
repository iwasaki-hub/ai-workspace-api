# SNSリンクプレビュー機能 — 2026-11-17

## 目的と実装範囲
AI Workspace APIのトップ、統計、使い方、SwaggerのURLをSNSに貼り付けると、タイトル・説明・ブランド画像のカードが出るようにする。

- URL：`/`、`/statistics`、`/examples`、`/swagger` （`/swagger/` は正規URL `/swagger` に統一）
- SNS向けの静的なメタ情報をHTTPの最初のHTMLに埋め込む。JavaScript非依存。
- 共通OGP部分テンプレート `views/partials/social-meta.ejs` を再利用。安全なEJSのエスケープを使用。
- canonical / og:url は恒久的な公開URL `https://ai-workspace-api-327r.onrender.com` を使い、Host/X-Forwarded-Hostから生成しない。
- `og:title`、`og:description` はページ別。OGP `website`、`og:locale=ja_JP`、画像URL・サイズ・MIME・alt、Xの `summary_large_image` / title / description / image / alt。
- SVG画像は1200×630を基準に、既存カラー（濃紺とミント）で制作。画像には実在するAPI機能・スタックだけを表現し、未確認の実績数を描かない。
- PNGは `sharp@0.35.5` によりローカルSVGをサーバー側で変換し、メモリキャッシュ。公開 `GET /social-card.png` で `image/png`、`Cache-Control: public, max-age=86400` を返す。
- 変換には外部URLや任意のユーザー入力を渡さない。MongoDBアクセス、APIレート制限、訪問者識別子への影響なし。

## 検証
- Crawlerを模したUser-Agentでも4ページと /swagger/ が200 + server-rendered OGP/Xメタタグを返す
- PNGエンドポイントが200、1200×630、PNGシグネチャ、5MB未満、同一データを返す
- ブラウザ側のJS実行不要、DB未接続でも稼働、既存統計集計を変更しない
- GitHub Actions 回帰テスト成功後に1PRを保護されたmainへsquash merge。Render Live後、PNGとメタタグを本番で検証
- SNS側のキャッシュで反映が遅れる場合があり、実際の共有投稿を最後に手動確認する
