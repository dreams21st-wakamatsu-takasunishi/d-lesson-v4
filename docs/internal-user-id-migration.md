# 児童IDの内部ID移行手順

## 目的

旧環境では `test_user_data.id` / `user_data.id` に児童名が入っていました。
アプリ上は動きますが、公開運用ではDBの行IDにも実名が残るため、実名投入前には `student_...` の内部IDへ移す方が安全です。

移行後は、DB行IDは内部ID、画面表示名は `data.displayName` に分かれます。

## 現在のアプリ側の対応

- 新規児童は最初から `student_...` の内部IDで作られます。
- 管理者画面では `displayName` を名前として表示します。
- Auth連携では、表示名ではなく `user_data_id` を使います。

## 1. 事前確認

まず、管理者画面からJSONバックアップを取ります。

次に、Supabase SQL Editorで次のファイルの中身を実行します。

```sql
supabase/sql/verify_internal_user_ids.sql
```

確認すること:

- `id_type = legacy_name_id` の行が残っているか
- `id_type = internal_id` の行は `student_...` になっているか
- `lesson_user_access` に名前IDを指している行があるか

## 2. テストテーブルで移行する

まず `test_user_data` だけを移行します。

Supabase SQL Editorで次のファイルの中身を実行します。

```sql
supabase/sql/migrate_test_user_data_named_ids.sql
```

このSQLは次を行います。

- `test_user_data.id` が児童名になっている行を `student_...` に変更する
- 旧IDを `data.displayName` として残す
- 新IDを `data.userDataId` に入れる
- `lesson_user_access.user_data_id` の参照先も新IDへ更新する

## 3. アプリで確認する

移行後、Dレッスンを再読み込みして確認します。

- 児童名がこれまで通り表示される
- Auth連携の `user_data_id` が `student_...` になっている
- 生徒アカウントでログインできる
- ステージクリア後に進捗とコインが保存される
- 管理者画面で表示名・生年月日・グループを編集できる

## 4. 報告してほしい内容

```text
verify_internal_user_ids:
- legacy_name_id の行数:
- lesson_user_access が名前IDを指している行数:

migrate_test_user_data_named_ids:
- old_id -> new_id の対応が表示された: OK / NG
- migrated が true: OK / NG
- access_row_updated が true: OK / NG / Auth未連携のため対象なし

アプリ確認:
- 児童名表示: OK / NG
- 生徒ログイン: OK / NG
- 進捗保存: OK / NG
- Consoleエラー: なし / あり
```

## 5. 本番テーブルについて

`user_data` の移行は、`test_user_data` で一通り確認してから行います。
本番用SQLは、テスト移行の結果を見てから作成します。
