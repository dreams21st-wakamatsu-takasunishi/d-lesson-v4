# RLS検証チェックリスト

## 目的

Supabase Auth / RLS 設定後に、公開URLで児童名や進捗データが権限外へ見えないことを確認する。

## 事前確認

- Authアカウント3つが作成済み
  - 管理者
  - 先生
  - 生徒確認用
- 各 Auth User ID を控えている
- `test_user_data` に仮名のテスト児童データがある
- `supabase/sql/rls_legacy_user_data_baseline.sql` 実行済み
- `lesson_user_access` 登録済み

## Supabase SQL Editorで確認する

`supabase/sql/verify_rls_access.sql` を使う。

重要: `00000000-0000-0000-0000-000000000000` は未登録ユーザー検証用のダミーUUID。`lesson_user_access` には登録しない。

実行前に、次のプレースホルダーを実際のAuth User IDへ置き換える。

```text
ADMIN_AUTH_USER_ID_HERE
TEACHER_AUTH_USER_ID_HERE
STUDENT_AUTH_USER_ID_HERE
```

確認すること:

- 生徒アカウントでは、自分のテスト児童データだけ見える
- 先生アカウントでは、想定した範囲のデータだけ見える
- 管理者アカウントでは、管理対象のテストデータが見える
- 権限登録していないUUIDでは、何も見えない

SQL Editorは管理者権限で動くため、最終確認は必ずブラウザログインでも行う。

もし未登録UUIDのブロックでも行が見える場合、SQL Editorの管理者権限がRLSを迂回している可能性が高い。その場合、SQL Editorの結果は参考扱いにして、ブラウザログインで判定する。

## ローカル `.env.local` の設定

RLS検証時は、次の設定にする。

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_REQUIRE_SUPABASE_AUTH=true
VITE_ENABLE_RLS_CLOUD_SYNC=true
```

公開URL・RLS検証時は、次を設定しない。

```env
VITE_LEGACY_ADMIN_PASS=
```

## ブラウザで確認する

1. 開発サーバーを再起動する。

```powershell
npm.cmd run dev -- --host 127.0.0.1
```

2. ブラウザで開く。

```text
http://127.0.0.1:5174/
```

3. 未ログイン状態を確認する。

- Supabase Authログイン画面が出る
- 学年一覧が見えない
- 児童名が見えない

4. 生徒アカウントでログインする。

- 自分に紐づいたテスト児童だけ見える
- 他の児童名が見えない
- 練習後にコインや進捗が保存される
- ログアウト後、再ログインしても保存結果が残る

5. 先生アカウントでログインする。

- 想定したテスト児童データが見える
- 管理者だけに許可したい操作ができてしまわないか確認する

6. 管理者アカウントでログインする。

- 管理対象のテストデータが見える
- 児童追加、コイン付与、進捗編集ができる
- 保存後、再読み込みしても結果が残る

## Consoleで確認する

公開前にConsoleへ次が出ている場合は止める。

- `ReferenceError`
- `is not defined`
- `Cannot access ... before initialization`
- SupabaseのRLSエラー
- `permission denied`
- `new row violates row-level security policy`

単独の `content.js: The message port closed before a response was received` は、ブラウザ拡張由来の可能性が高いため、アプリ本体の停止理由にはしない。

## こちらへ報告してほしい内容

パスワードは送らない。

```text
SQL検証:
- 生徒UUIDで見えた行:
- 先生UUIDで見えた行:
- 管理者UUIDで見えた行:
- 未登録UUIDで見えた行:

ブラウザ検証:
- 未ログインで名簿が見えない: OK / NG
- 生徒ログインで自分だけ見える: OK / NG
- 生徒の進捗保存: OK / NG
- 先生ログイン: OK / NG
- 管理者ログイン: OK / NG
- Consoleエラー: なし / あり
```
