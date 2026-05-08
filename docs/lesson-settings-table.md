# lesson_settings 移行手順

## 目的

現在の `__GLOBAL_SETTINGS__` は、児童データと同じ `user_data` / `test_user_data` に入っています。
動作はしますが、RLSの条件が複雑になり、児童行と設定行を間違えて扱う余地があります。

`lesson_settings` に分けると、児童データと全体設定を別々に管理できます。

## 事前条件

- `supabase/sql/rls_legacy_user_data_baseline.sql` 実行済み
- 初回管理者が `lesson_user_access` に登録済み
- `supabase/sql/admin_lesson_user_access_policies.sql` 実行済み
- 管理者画面のバックアップでJSONバックアップ取得済み

## 1. SQLを実行する

Supabase SQL Editorで、次のファイルの中身を貼り付けて実行します。

```sql
supabase/sql/lesson_settings_table.sql
```

ファイル名だけではなく、中身をすべて貼り付けます。

このSQLは次を行います。

- `lesson_settings` テーブルを作る
- RLSを有効にする
- lesson_user_access 登録済みユーザーだけが読めるようにする
- 管理者だけが追加・更新・削除できるようにする
- 既存の `__GLOBAL_SETTINGS__` を `test_user_data:global` / `user_data:global` にコピーする

## 2. 環境変数を有効にする

SQL実行後、`.env.local` または公開URLの環境変数に追加します。

```env
VITE_ENABLE_SETTINGS_TABLE=true
```

この設定は、次の2つが有効な環境で使います。

```env
VITE_REQUIRE_SUPABASE_AUTH=true
VITE_ENABLE_RLS_CLOUD_SYNC=true
```

## 3. 動作確認

管理者アカウントでログインし、次を確認します。

- 管理者画面の `運用確認` で `設定テーブル` が `test_user_data:global` または `user_data:global` になる
- 管理者画面の `運用確認` で `設定テーブル確認をコピー` を押し、SQL確認手順を控えられる
- チケット設定を変更して保存できる
- 文章課題を追加・更新できる
- カスタムテーマや演出を追加できる
- 児童の自動ログアウト分数を変更できる
- ページ再読み込み後も設定が残る
- 生徒アカウントでログインして、文章課題やガチャ設定が見える

## 4. 旧行の扱い

しばらくは `__GLOBAL_SETTINGS__` 行を残します。

理由:

- `VITE_ENABLE_SETTINGS_TABLE=false` に戻したときの退避になる
- 既存バックアップとの互換性を保てる
- 現場テスト中に設定が消えたように見える事故を避けられる

`lesson_settings` での運用が安定してから、旧行を削除するかどうかを判断します。

## 5. 診断SQL

設定テーブルが正しく使われているか確認するには、次のファイルを使います。

```sql
supabase/sql/verify_lesson_settings.sql
```

このSQLは読み取り専用です。

確認すること:

- `lesson_settings` に `test_user_data:global` がある
- `ticketConfig` / `textTasks` などの設定項目が入っている
- `lesson_settings` と旧 `__GLOBAL_SETTINGS__` の比較結果が確認できる
- `lesson_settings` のRLSが有効になっている
- 登録済みAuthユーザーでは読める
- 未登録UUIDでは読めない

`same_as_legacy_row` が `false` でも、`VITE_ENABLE_SETTINGS_TABLE=true` で運用中に設定変更をした後なら異常とは限りません。
その場合、アプリは `lesson_settings` 側を正として読んでいます。
