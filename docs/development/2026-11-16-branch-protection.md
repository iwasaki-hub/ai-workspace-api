# GitHub mainブランチ保護 — 設定・動作検証記録

- 検証日: 2026-11-16
- 対象: [iwasaki-hub/ai-workspace-api](https://github.com/iwasaki-hub/ai-workspace-api)
- Ruleset: [main (ID: 27360830)](https://github.com/iwasaki-hub/ai-workspace-api/rules/27360830)
- 判定: **実際に失敗するテストを含むPRで、マージがブロックされることを確認**

## 1. 適用した保護ルール

GitHub Ruleset `main` のAPI設定から次を確認。

| 設定 | 値 |
| --- | --- |
| Enforcement | `active` |
| 対象 | `refs/heads/main` |
| Pull Request必須 | 有効 |
| 必須ステータスチェック | `Node.js API Regression Tests` |
| 必須チェックの最新ベース追従 | `strict_required_status_checks_policy: true` |
| PR承認人数 | 0（個人開発） |
| ブランチ削除禁止 | `deletion` |
| 強制push禁止 | `non_fast_forward` |
| バイパス許可 | なし |
| `current_user_can_bypass` | `never` |

GitHub APIのブランチ情報でも `main.protected: true` を確認。従来型Branch Protectionの `protection.enabled: false` は別の仕組みであり、今回有効なのはRulesetの保護。

## 2. 実地テスト：失敗するPRで検証

1. `main` から専用ブランチ `test/verify-main-protection` を作成。
2. `tests/branch-protection-verification.test.js` を追加。このテストは `assert.fail("INTENTIONAL_FAILURE_BRANCH_PROTECTION_CHECK")` を実行して必ず失敗する。
3. 検証専用 [Pull Request #2](https://github.com/iwasaki-hub/ai-workspace-api/pull/2) を `main` 宛てに作成。
4. [GitHub Actionsの検証実行 #43839578431](https://github.com/iwasaki-hub/ai-workspace-api/actions/runs/43839578431) が `conclusion: failure` と判定され、`Run API tests` ステップが失敗。
5. GitHub Pull Request APIで `mergeable_state: blocked`、`merged: false` を確認。
6. **Pull Request #2をクローズし、mainにはマージしていない。**

この実地確認は「失敗したチェックによるPRのマージ阻止」が機能することを示す。強制push禁止や削除禁止そのものを破壊的に試したわけではない。

## 3. 今後の開発ルール

- `main` に直接変更をコミットせず、機能ごとに作業用ブランチを作成する。
- PRを作り、`Node.js API Regression Tests` が成功したことを確認してからマージする。
- `main` の更新でRenderが自動デプロイされるため、リリース前にはテスト成功状態を確認する。
- 新しいテストジョブを追加する場合、必要に応じてRulesetの必須チェックも更新する。
- GitHub Actionsの `API Tests` は模擬DBによる13ケース。MongoDB Atlasとの実接続統合テストまでは保証しない。

## 4. 検証ログ

| 対象 | 結果 |
| --- | --- |
| Rulesetの有効化とmain指定 | 確認済み |
| 必須チェック名の設定 | 確認済み |
| 故意に失敗するテスト | GitHub ActionsでFailure |
| マージの抑止 | `mergeable_state: blocked` |
| 検証PRの後片付け | PR #2をClose、未マージ |

次の改善候補は、`package-lock.json` の管理とCIでの `npm ci`、カバレッジ、公開APIの読み取り専用スモークテスト。
