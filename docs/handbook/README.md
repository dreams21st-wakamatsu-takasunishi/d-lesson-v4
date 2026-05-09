# Dレッスン 手引書一覧

更新日: 2026-05-09

このフォルダは、Dレッスンを現場で扱うための入口です。  
日々の使い方、児童・先生・管理者ごとの操作、公開運用、セキュリティ、仕様確認を分けてまとめています。

## まず読むもの

1. [日常運用手引書](daily-operations.md)
   - 教室で毎日使うときの流れ。
   - 起動、ログイン、練習、終了、簡易確認。

2. [児童向け利用手引書](student-usage.md)
   - 児童がDレッスンを開いて練習する流れ。
   - ログイン番号、あいことば、ログアウトの扱い。

3. [先生向け利用手引書](teacher-usage.md)
   - 先生アカウントで確認できること。
   - 先生確認モードで保存されないことの確認。

4. [管理者操作手引書](admin-operations.md)
   - 児童追加、編集、削除、進捗編集、レポート、履歴、バックアップ、復元。

## 本番運用・保守で読むもの

5. [アカウント・セキュリティ手引書](security-and-accounts.md)
   - Supabase Auth、RLS、児童ログインカード、情報漏洩防止。

6. [仕様・保守手引書](technical-specification.md)
   - 画面構成、データ保存、環境変数、公開手順、チェックコマンド。

7. [トラブル対応手引書](troubleshooting.md)
   - ログインできない、保存されない、公開URLが古い、Consoleエラーなど。

## 既存の詳細資料

詳しい設定や移行作業は、次の既存資料を参照してください。

- [本番公開ランブック](../production-release-runbook.md)
- [公開前チェックリスト](../public-release-checklist.md)
- [Supabase Auth / RLS 設定手順](../supabase-rls-setup.md)
- [RLS検証チェックリスト](../rls-verification-checklist.md)
- [旧Dレッスン進捗データ移行手順](../legacy-d-lesson-data-migration.md)
- [児童ログインカード印刷手順](../student-login-card-printing.md)
- [端末切替・同期確認手順](../device-handoff-guide.md)

## 本番運用開始の目安

次のすべてが完了していれば、小規模な本番運用を開始できます。

- 公開URLで児童名一覧がログイン前に表示されない。
- 児童ログインで本人データだけが表示される。
- 先生ログインで担当範囲だけが表示される。
- 先生確認モードでは、練習しても児童データが保存変更されない。
- 管理者ログインで児童追加、編集、削除、バックアップ、復元ができる。
- `npm.cmd run check:release` が通る。
- GitHub Actions のデプロイが成功する。
- `npm.cmd run check:public-latest` が通る。
- 公開URLのConsoleにアプリ本体由来の `ReferenceError`、`is not defined`、`TypeError` が出ない。

