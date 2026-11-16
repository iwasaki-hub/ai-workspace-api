# Font Awesome アイコン導入・一元管理（2026-11-16）

## 目的
既存のEJSドキュメント・Swagger UI・メニューバーに一貫したアイコンを追加し、見つけやすさと視認性を改善する。

## 設計方針
- Font Awesomeの**Free SVGアイコン**（Solid / Brands）と公式SVG Coreをnpm経由で使用する。Proライセンス、Kitキー、外部CDNは不要。
- **唯一のアイコン選択・対応表は `ui/icons.js`**。ここで`iconRegistry`に用途別のキーを追加・変更する。
- EJSでは`<%- icon("overview") %>`のように**意味的なキー**のみを参照。個々の画面にアイコンのインポート・パス・Unicodeを分散させない。
- `app.js`が`app.locals.icon`を通じて共通レンダラーを配布。サーバー側でSVGをレンダリングし、HTMLの初期表示からアイコンが見えるようにする。
- レンダラーは`iconRegistry`の既知のキーだけを許可し、装飾用SVGを`aria-hidden`として出力する。リンク・ボタンの日本語ラベルは保持する。
- 共通スタイルは`public/css/style.css`、Swagger固有の表示調整は`public/css/swagger-page.css`に置く。
- ブランドのGitHubアイコンは無料Brandsパッケージを使用する。

## 対象
メニューバー、ブランドマーク、主要なCTA、機能カード、OpenAPI仕様リンク、API実行ボタン、コピー、ヘルプ、フッター、Swagger戻るリンク。

## アイコン変更方法
1. `ui/icons.js`の`iconRegistry`から用途のキーを探す。
2. 使用するFont Awesome Freeアイコンを同じファイルのimportに追加して、キーの値を更新する。
3. 新しい使用箇所だけEJSに`<%- icon("semantic-key") %>`を追加する。
4. アイコンの表示スタイルは既存の共通クラス`.ui-icon`を利用する。
5. `npm test`を実行して、画面・Swagger・許可リストの回帰テストを確認する。

## 検証と制約
- CIでSVG生成、許可されないキーの拒否、EJS内の出力、Swaggerの表示、静的CSSの提供を確認する。
- CI成功後に保護されたmainへマージし、Renderの再デプロイおよび実APIのスモークテストを確認する。
- **ブラウザでの見た目・モバイルの実画面操作は別途ユーザーによる確認が必要**。
- 既存のGET API、OpenAPI定義、本番MongoDB接続設定は変更しない。
- 以前の決定に従い`package-lock.json`/`npm ci`の導入は行わない。

参考: https://fontawesome.com/ / https://docs.fontawesome.com/apis/javascript
