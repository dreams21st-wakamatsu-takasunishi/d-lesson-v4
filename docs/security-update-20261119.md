# 開発依存の安全更新（2026-11-19）

## 対象

GitHub Dependabotの未解決警告6件（Vite 5件、source-map-js 1件）への対応。

- Vite: 8.0.16 → 8.1.7。更新範囲を `~8.1.6` とし、8.1系の修正パッチを採用。
- source-map-js: 1.2.1 → 1.2.4。間接依存が古い版へ戻らないよう、`overrides` で `^1.2.2` を指定。
- lockfileに取得先・整合性・確定バージョンを記録。
- 公開ワークフローに依存関係検査を追加。High/Criticalの検出時は公開を停止。検査サービスの通信失敗も安全とは扱わず、3回まで再試行し、確認できなければ公開を停止。

主な一次資料:

- https://github.com/advisories/GHSA-587h-7wmj-h5pm
- https://github.com/advisories/GHSA-68fv-2mgg-jv7q

## 範囲と確認

開発・ビルド用の部品と公開時検査だけを変更する。画面仕様、ログイン方式、児童の登録内容、合言葉、学習履歴、Supabaseのデータ・設定・Functionsは変更しない。

検証: `node --test scripts/check-dependency-audit.test.mjs`、`node scripts/audit-dependencies.mjs`、`npm run check:release`、`node scripts/check-web-app-build.mjs`。公開後はActionsの成功、公開版SHA、本番データテーブル設定、Dependabot警告の解消を確認する。

既知の依存脆弱性の検査であり、未知の脆弱性やアプリ全体の安全性を保証するものではない。
