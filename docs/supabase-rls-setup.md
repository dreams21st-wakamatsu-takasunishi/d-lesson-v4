# Supabase Auth / RLS 設定手順

## 目的

公開URLで児童名や進捗データが外部に見えないように、Supabase Auth と RLS でアクセス制御する。

## 前提

- 実名の児童データを入れる前に実施する。
- 最初は `test_user_data` で検証する。
- RLS検証が終わるまで `VITE_ENABLE_RLS_CLOUD_SYNC=true` にしない。

## 1. Supabase Auth アカウントを作る

Supabase Dashboard の Authentication で、検証用アカウントを作成する。

最低限、次の3種類を作る。

- 管理者アカウント
- 先生アカウント
- 生徒確認用アカウント

作成後、それぞれの Auth User ID を控える。

## 2. `lesson_user_access` と RLS を作る

Supabase SQL Editor で次を実行する。

```sql
supabase/sql/rls_legacy_user_data_baseline.sql
```

このSQLは、次の内容を行う。

- `lesson_user_access` を作成する
- `user_data` と `test_user_data` の RLS を有効にする
- Authユーザーごとに読める・書ける行を制御する

## 3. アクセス権限を登録する

Auth User ID を使って、`lesson_user_access` に行を追加する。

重要: `lesson_user_access.auth_user_id` は `auth.users.id` に存在するUUIDだけ登録できる。
`00000000-0000-0000-0000-000000000000` は未登録ユーザー検証用のダミーなので、ここには登録しない。

最初の管理者アカウントだけは、必ずSQL Editorで登録する。管理者行が1件入った後は、管理者画面の「Auth連携」から先生・生徒・追加管理者を登録できる。

管理者画面から `lesson_user_access` を登録・一覧表示する場合は、次もSQL Editorで実行する。

```sql
supabase/sql/admin_lesson_user_access_policies.sql
```

管理者画面から児童削除・バックアップ復元を行う場合は、次もSQL Editorで実行する。

```sql
supabase/sql/admin_user_data_delete_policies.sql
```

先生アカウントをグループ単位で制限する場合は、次も実行する。

```sql
supabase/sql/teacher_group_scope_policies.sql
```

SQL Editorにはファイル名だけではなく、ファイルの中身を貼り付けて実行する。

SQL Editorで次のテンプレートを使う。

```sql
supabase/sql/insert_lesson_user_access_template.sql
```

テンプレート内の次を、実際のAuth User IDへ置き換える。

```text
ADMIN_AUTH_USER_ID_HERE
TEACHER_AUTH_USER_ID_HERE
STUDENT_AUTH_USER_ID_HERE
```

生徒の `user_data_id` は、実際の `test_user_data.id` と完全一致させる。新規児童は `student_...` の内部IDになり、画面上の名前は `data.displayName` に入る。

```sql
('STUDENT_AUTH_USER_ID_HERE', 'student_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'student')
```

既存の名前ID行を内部IDへ移す場合は、[児童IDの内部ID移行手順](internal-user-id-migration.md) に沿って確認する。

## 4. 公開URL用の環境変数を設定する

まずはテストテーブルで設定する。

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_REQUIRE_SUPABASE_AUTH=true
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=false
VITE_ALLOW_LEGACY_ADMIN_PASS=false
```

設定後、テストテーブルで公開検証する場合は次を実行する。

```powershell
npm.cmd run check:public-test-env
```

実名データ用の `user_data` へ切り替えた本番公開前は次を実行する。

```powershell
npm.cmd run check:public-env
```

公開URLでは設定しない。

```env
VITE_LEGACY_ADMIN_PASS=
```

## 5. 確認すること

### 未ログイン

- アプリを開くと Supabase Auth ログイン画面が出る。
- 学年一覧や児童名が表示されない。

### 管理者

- 管理者アカウントでログインできる。
- テストデータを読み込める。
- 児童追加や進捗編集ができる。

### 先生

- 先生アカウントでログインできる。
- `全児童` 設定なら全児童、`グループ指定` 設定なら指定グループの児童だけを確認できる。
- ヘッダーとホーム画面に `先生確認モード` が表示される。
- 先生アカウントでは児童データを書き換えない。ステージ確認をしても、操作直後と再読み込み後のコイン・進捗が変わらないことを確認する。
- 想定外の管理操作ができないか確認する。

### 生徒

- 生徒アカウントでログインできる。
- 自分に紐づいた児童データだけ表示される。
- 他の児童名が見えない。
- 練習後の進捗やコインが保存される。

## 6. 問題が起きたときの見方

### ログイン後に誰も表示されない

- `lesson_user_access` に Auth User ID が登録されているか確認する。
- `user_data_id` が `test_user_data.id` と一致しているか確認する。`data.displayName` ではなく、行の `id` を使う。
- `VITE_SUPABASE_TABLE` が検証対象テーブルと一致しているか確認する。

### 保存できない

- Console に Supabase の RLS エラーが出ていないか確認する。
- `lesson_user_access.role` が正しいか確認する。
- 先生が見える範囲がおかしい場合、`lesson_user_access.scope_type` / `scope_value` と児童データの `group` が一致しているか確認する。
- 生徒の場合、自分以外の `user_data_id` に保存しようとしていないか確認する。

### すべての児童名が見えてしまう

- RLS が有効になっているか確認する。
- anon / authenticated に広すぎる policy が残っていないか確認する。
- policy一覧に `Allow public read` / `Allow public update` / `Allow public delete` が残っている場合は、`supabase/sql/drop_legacy_public_policies.sql` を実行する。
- `VITE_ENABLE_LEGACY_SUPABASE_SYNC=true` になっていないか確認する。

## 7. RLS検証

設定後は [RLS検証チェックリスト](rls-verification-checklist.md) に沿って確認する。

SQL Editorでの簡易確認には、次のテンプレートを使う。

```sql
supabase/sql/verify_rls_access.sql
```

全体設定を `lesson_settings` に分ける場合は、RLS検証後に次も実行する。

```sql
supabase/sql/lesson_settings_table.sql
```

その後、`VITE_ENABLE_SETTINGS_TABLE=true` にして [lesson_settings 移行手順](lesson-settings-table.md) に沿って確認する。
診断には次も使える。

```sql
supabase/sql/verify_lesson_settings.sql
```

## 8. 本番データへ移る条件

- `test_user_data` で未ログイン時にデータが見えない。
- 生徒アカウントで他の児童名が見えない。
- 管理者・先生・生徒の操作範囲が想定通り。
- `VITE_LEGACY_ADMIN_PASS` を公開URLに設定していない。
- バックアップ手順が決まっている。
