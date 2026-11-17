# 使い方専用ページとAPIコードサンプル（2026-11-17）

## 仕様
- Express/EJSに `GET /examples` を追加。ナビゲーションの「使い方」は `/#examples` のスクロールではなく `/examples` に遷移する。
- トップページのQuick Startは紹介カードと専用ページへのリンクに整理し、現行のヒーローや統計ダッシュボード、Swagger、APIプレイグラウンドは維持する。
- `views/examples.ejs` は既存のヘッダー、フッター、アイコンレジストリ、濃紺＋ミントの配色を共用。iPhone幅でも言語切り替え・コピーが使える。
- JavaScript（fetch）、Python 3（標準ライブラリ `urllib.request` と `json`）、curl（`--fail-with-body`）を選べる。どのサンプルも公開GETエンドポイントへの読み取り専用リクエスト。
- 対象9例：`/api/users`、`/api/users?status=active|inactive`、`/api/users/:id`、`/api/todos`、`/api/todos/:id`、`/health`、`/api/stats`、`/api/stats/details`。
- IDを使う2例では24桁16進数のObjectIdをユーザーに入力させ、未入力・不正値ではコピー不可とする。架空のObjectIdを「動作可能」な例として表示しない。
- クライアント側で選択を更新するのみで、ページ表示・言語切替時にAPIを勝手に呼び出さない。クリップボードには表示中のコードをコピーし、成功・失敗のフィードバックを表示する。
- エンドポイントは厳密なホワイトリストとObjectId形式チェックのみから生成。任意URL、JSコード、HTTP書き込み処理の入力は許可しない。DOMは `textContent` のみを使用。
- 言語切替はARIAのtablist / tab / tabpanelと矢印・Home・Endキーに対応。

## 実行の留意点
- JavaScriptはブラウザの開発者ツール等、PythonはPython 3、curlはターミナルで実行する。
- JS fetchの実行は同一オリジン（提供サイトの開発者ツール）を基本とする。外部サイトからブラウザのfetchを実行する場合には、ブラウザのCORS制限に従う。
- 呼び出し先は https://ai-workspace-api-327r.onrender.com の絶対URL。認証情報・秘密鍵は不要。
- HTTPエラー時はPython urllibがHTTPErrorを、JSが例外を、curlが非0終了コードを返す。
- API自身と統計用MongoDBの設定・書き込み権限に変更を加えない。

## 検証
- GitHub Actionsでページ、ナビゲーション、レスポンシブCSS、言語・ID切替・コピー、失敗条件、未接続DB、既存APIへの影響をテスト
- mainへのPRでCI成功を確認し、Render Live後にページが公開されていることを確認
