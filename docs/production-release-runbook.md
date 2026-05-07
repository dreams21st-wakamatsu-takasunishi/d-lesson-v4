# Dレッスン 本番公開ランブック

## 現在の到達点

- GitHub Pages への自動デプロイ設定は完了。
- 公開URL用の Supabase Auth / RLS 前提の起動設定は整備済み。
- `test_user_data` を使った公開検証は可能。
- `npm.cmd run check:release-test` で、公開テスト用の事前確認を一括実行できる。

## 本番公開までに残っているタスク

### 1. 本番データ投入前のバックアップ

- 管理者画面から JSON バックアップを保存する。
- Supabase 側でも `user_data`, `lesson_user_access`, `lesson_settings` の状態を確認する。
- 本番切替作業中は、児童や先生が操作しない時間帯を決める。

### 2. 本番 `user_data` の内部ID化

実名や児童名を `user_data.id` に使わない状態へ移行する。

Supabase SQL Editor で順に確認する。

```sql
supabase/sql/production_release_gate.sql
supabase/sql/prepare_user_display_names.sql
supabase/sql/verify_internal_user_ids.sql
supabase/sql/migrate_user_data_named_ids.sql
supabase/sql/verify_user_data_id_migration_audit.sql
supabase/sql/preflight_public_release.sql
```

合格条件:

- `user_data_legacy_name_ids` が 0。
- `lesson_user_access_legacy_refs` が 0。
- 画面上では従来どおり児童名が表示される。
- `lesson_user_access.user_data_id` は内部IDを指している。

### 3. Supabase RLS の本番確認

必要なSQLを本番テーブルに適用済みであることを確認する。

```sql
supabase/sql/production_release_gate.sql
supabase/sql/drop_legacy_public_policies.sql
supabase/sql/admin_lesson_user_access_policies.sql
supabase/sql/admin_user_data_delete_policies.sql
supabase/sql/teacher_group_scope_policies.sql
supabase/sql/lesson_settings_table.sql
supabase/sql/preflight_public_release.sql
```

合格条件:

- 未ログインで児童データが読めない。
- 生徒ログインで自分のデータだけ読める。
- 先生ログインで担当範囲だけ読める。
- 管理者ログインで管理画面操作ができる。
- 旧 public read / insert / update / delete policy が残っていない。

### 4. GitHub Actions Variables の本番切替

GitHub の `Settings` > `Secrets and variables` > `Actions` で変更する。

```text
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
```

この変更後に次の commit を push する。GitHub Actions は `npm run check:public-env` を実行するため、`test_user_data` のままではデプロイが止まる。

`VITE_ENABLE_SETTINGS_TABLE` は、`lesson_settings` の本番確認が終わってから `true` にする。

設定してはいけないもの:

```text
VITE_LEGACY_ADMIN_PASS
VITE_ENABLE_LEGACY_SUPABASE_SYNC=true
VITE_ALLOW_LEGACY_ADMIN_PASS=true
```

### 5. 本番公開前のローカル確認

`.env.local` も本番想定に切り替えて実行する。

```powershell
npm.cmd run check:release
npm.cmd run dev:local
```

合格条件:

- `check:release` が成功する。
- ローカルでログイン画面が表示される。
- 児童、先生、管理者でログイン確認できる。
- Console にアプリ本体由来の `ReferenceError`, `is not defined`, `TypeError` が出ない。

### 6. 公開URLでの最終確認

GitHub に push し、Actions の `Deploy GitHub Pages` が成功してから確認する。

想定URL:

```text
https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/
```

確認項目:

- `npm.cmd run check:public-url` が成功する。
- 本番切替後は `npm.cmd run check:public-production-url` が成功する。
- 未ログインでは児童一覧や管理画面に入れない。
- 生徒でログインして、練習後にコイン、進捗、おすすめ、練習履歴が保存される。
- 先生でログインして、担当範囲だけ見える。
- 先生操作では児童データが保存変更されない。
- 管理者で児童追加、編集、削除、バックアップ、復元ができる。
- 過去日付ごとの練習履歴が確認できる。
- Console にアプリ本体由来のエラーがない。

## 公開してよい判定

次のすべてが OK なら、本番公開可能。

- `npm.cmd run check:release` が成功。
- `supabase/sql/production_release_gate.sql` に NG がない。
- `supabase/sql/preflight_public_release.sql` に NG がない。
- GitHub Actions のデプロイが成功。
- `npm.cmd run check:public-url` が成功。
- `npm.cmd run check:public-production-url` が成功。
- 公開URLで、未ログイン、生徒、先生、管理者の4パターン確認が完了。
- 実名が `user_data.id` や公開設定値に残っていない。
- バックアップと復元の運用手順が確認済み。

## 公開を止める条件

次のどれかがある場合は公開しない。

- `test_user_data` のまま本番児童を使おうとしている。
- `VITE_SUPABASE_USE_TEST_TABLE=true` のまま本番公開しようとしている。
- 旧 public policy が残っている。
- `VITE_LEGACY_ADMIN_PASS` が GitHub Actions に登録されている。
- 先生アカウントで担当外の児童が見える。
- 生徒アカウントで他児童が見える。
- 公開URLの Console にアプリ本体由来の未定義エラーが出る。
