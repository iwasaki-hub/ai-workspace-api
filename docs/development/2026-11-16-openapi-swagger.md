# OpenAPI / Swagger UI 導入記録（2026-11-16）

## 目的
既存のExpress APIをOpenAPI 3.1の機械可読な契約として文書化し、Swagger UIからブラウザで閲覧・GET実行できるようにする。従来のEJS仕様ページと「APIを試す」画面は維持する。

## ファイルと公開URL

| 内容 | リポジトリ | 公開パス |
| --- | --- | --- |
| OpenAPI定義 | `openapi.json` | `/openapi.json` |
| Swagger UI | `views/swagger.ejs` | `/swagger` |
| 初期化JS | `public/js/swagger-init.js` | `/js/swagger-init.js` |
| ページCSS | `public/css/swagger-page.css` | `/css/swagger-page.css` |
| Swagger UI 配信 | `swagger-ui-dist`（npmパッケージ） | `/swagger-assets/*` |

## 仕様書の内容

- `GET /health` : 200、`status` と `service` を返却。MongoDB接続確認ではない。
- `GET /api/users`: 200配列（最大50件）、statusクエリ（`active` / `inactive`）、400、503を記載。
- `GET /api/users/{id}`: 24桁16進数ID、200、400、404、503を記載。
- 公開DTO `DemoUser` は `id`、`name`、`status`、`purpose` の4フィールドのみ。
- エラーDTO `ApiError` は `error` と `message`。
- 認証不要（読み取り専用公開API）。書き込み操作の定義は含めない。
- スキーマ例や失敗時のHTTP応答を記載。
- `servers.url: /` の相対パスを使い、ローカルとRenderの両方で同じ契約を使う。

## 実装・運用のルール

- **公開するAPIの仕様の変更時には `openapi.json` を同じPRで更新する。**
- Swagger UIは同一サーバーの `swagger-ui-dist` 配布物を使用し、外部CDNに依存しない。
- Swagger UIの `Try it out` はGETだけに制限。これはUIでの誤操作を防ぐ設定であり、権限制御はAPI側が行う。
- `MONGODB_URI` 等の認証情報は仕様書に含めない。Swagger UIにも認証情報を入力する必要はない。
- `npm test` は `@apidevtools/swagger-parser` によるOpenAPI契約検証、既存のHTTP回帰テスト、Swagger UI配信テストを実行。
- GitHub Actionsでテスト成功後、保護されたmainにマージ。Renderのデプロイと本番スモークテストを別途確認。
- `package-lock.json` とCIの `npm ci` は以前の指示に従って追加しない。

## 検証範囲・注意

OpenAPI形式の妥当性とExpressルーティングの契約一致はCIで確認する。Swagger UIでの実際のクリック操作とモバイル画面表示は手動確認する。実DBへの疎通は既存の本番スモークテストで確認する。
