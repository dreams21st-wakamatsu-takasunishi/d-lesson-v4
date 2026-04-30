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

生徒の `user_data_id` は、実際の `test_user_data.id` と完全一致させる。

```sql
('STUDENT_AUTH_USER_ID_HERE', 'テスト太郎', 'student')
```

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
- 必要な児童データを確認できる。
- 想定外の管理操作ができないか確認する。

### 生徒

- 生徒アカウントでログインできる。
- 自分に紐づいた児童データだけ表示される。
- 他の児童名が見えない。
- 練習後の進捗やコインが保存される。

## 6. 問題が起きたときの見方

### ログイン後に誰も表示されない

- `lesson_user_access` に Auth User ID が登録されているか確認する。
- `user_data_id` が `test_user_data.id` と一致しているか確認する。
- `VITE_SUPABASE_TABLE` が検証対象テーブルと一致しているか確認する。

### 保存できない

- Console に Supabase の RLS エラーが出ていないか確認する。
- `lesson_user_access.role` が正しいか確認する。
- 生徒の場合、自分以外の `user_data_id` に保存しようとしていないか確認する。

### すべての児童名が見えてしまう

- RLS が有効になっているか確認する。
- anon / authenticated に広すぎる policy が残っていないか確認する。
- `VITE_ENABLE_LEGACY_SUPABASE_SYNC=true` になっていないか確認する。

## 7. RLS検証

設定後は [RLS検証チェックリスト](rls-verification-checklist.md) に沿って確認する。

SQL Editorでの簡易確認には、次のテンプレートを使う。

```sql
supabase/sql/verify_rls_access.sql
```

## 8. 本番データへ移る条件

- `test_user_data` で未ログイン時にデータが見えない。
- 生徒アカウントで他の児童名が見えない。
- 管理者・先生・生徒の操作範囲が想定通り。
- `VITE_LEGACY_ADMIN_PASS` を公開URLに設定していない。
- バックアップ手順が決まっている。
