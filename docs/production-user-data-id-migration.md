# 本番 user_data の内部ID移行手順

## 目的

公開運用前に、児童名を `user_data.id` として使う状態をやめ、DB上は `student_...` の内部IDで保存します。

画面に出す名前は `data.displayName` に残すため、児童・先生・管理者画面ではこれまで通り名前で確認できます。

## 実行前チェック

1. 管理者画面からJSONバックアップを保存する
2. `test_user_data` の内部ID移行が完了している
3. `supabase/sql/preflight_public_release.sql` を実行し、`user_data_legacy_name_ids` と `lesson_user_access_legacy_refs` を確認する
4. 必要に応じて `supabase/sql/verify_internal_user_ids.sql` を実行し、`user_data` 側に残っている `legacy_name_id` の詳細を確認する
5. `lesson_user_access.user_data_id` に名前IDが残っている場合、その行も移行対象になることを確認する

## 本番移行

Supabase SQL Editorで次を実行します。

```sql
supabase/sql/migrate_user_data_named_ids.sql
```

このSQLは次を行います。

- `user_data.id` が児童名の行を `student_...` に変更する
- 旧IDを `data.displayName` に残す
- 新IDを `data.userDataId` に入れる
- `lesson_user_access.user_data_id` が旧IDを指している場合、新IDへ更新する
- `private.d_lesson_user_data_id_migration_audit` に移行履歴を残す

## 実行後チェック

1. `supabase/sql/verify_internal_user_ids.sql` を再実行する
2. `user_data` の `legacy_name_id` が0件になっていることを確認する
3. `lesson_user_access` の名前ID行が0件になっていることを確認する
4. `supabase/sql/verify_user_data_id_migration_audit.sql` を実行し、`old_id -> new_id` の履歴を確認する
5. `supabase/sql/preflight_public_release.sql` を再実行し、`NG` がないことを確認する
6. Dレッスンを再読み込みし、次を確認する

- 児童名がこれまで通り表示される
- 生徒アカウントでログインできる
- 先生アカウントで担当範囲だけ見える
- 管理者画面で児童編集できる
- ステージクリア後に進捗、コイン、おすすめが保存される
- Consoleにアプリ本体のエラーが出ない

## 注意

このSQLは本番 `user_data` を更新します。実行前のJSONバックアップは必須です。

`private.d_lesson_user_data_id_migration_audit` は実名を含む可能性があるため、SupabaseのAPI公開対象にしないでください。
