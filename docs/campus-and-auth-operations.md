# 校舎管理と児童Auth登録 手順

## 目的

Dレッスン内で児童データを作成し、校舎・グループ単位で閲覧範囲を分けられるようにします。
公開URLは1つのまま、先生アカウントごとに見える児童を制限します。

## 1. Supabase SQLを実行

Supabase SQL Editorで次を実行します。

```sql
-- ファイルの中身を貼り付けて実行
supabase/sql/campus_scope_policies.sql
```

実行後、先生の担当範囲として次が使えます。

- `all`: 全児童
- `campus`: 校舎単位
- `group`: グループ単位
- `campus_group`: 将来用。`campusId:group` の形式

## 2. 管理者画面で校舎を作成

1. 管理者でDレッスンにログイン
2. `管理者用` → `生徒管理`
3. `校舎の管理` で校舎名とコードを追加

コードはURLやログインメールで使いやすい英数字を推奨します。

例:

- 校舎名: `若松校`
- コード: `wakamatsu`

## 3. 児童を校舎に割り当て

児童追加時に校舎を選択します。
既存児童は児童一覧の `校舎` プルダウンから変更できます。

## 4. 先生の担当範囲を設定

`Auth連携` の先生登録で、担当範囲を選びます。

- 全児童を見る先生: `全児童`
- 校舎だけを見る先生: `校舎指定` + `wakamatsu`
- グループだけを見る先生: `グループ指定` + `月曜A`

複数指定する場合はカンマ区切りです。

例:

```text
wakamatsu,takasunishi
```

## 5. Dレッスン内でAuth児童アカウントを作る準備

Edge Functionを使う場合、Supabaseに次の環境変数を設定します。

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STUDENT_LOGIN_EMAIL_DOMAIN
STUDENT_LOGIN_EMAIL_PREFIX
STUDENT_LOGIN_NUMBER_PAD
LESSON_USER_DATA_TABLE
```

例:

```text
STUDENT_LOGIN_EMAIL_DOMAIN=dlesson.example.com
STUDENT_LOGIN_EMAIL_PREFIX=dlesson-student-
STUDENT_LOGIN_NUMBER_PAD=3
LESSON_USER_DATA_TABLE=user_data
```

Supabase CLIをこのリポジトリのdevDependencyから使う場合:

```powershell
npx.cmd supabase functions deploy admin-create-student --use-api
npx.cmd supabase functions deploy admin-delete-auth-user --use-api
npx.cmd supabase secrets set STUDENT_LOGIN_EMAIL_DOMAIN=dlesson.example.com
npx.cmd supabase secrets set STUDENT_LOGIN_EMAIL_PREFIX=dlesson-student-
npx.cmd supabase secrets set STUDENT_LOGIN_NUMBER_PAD=3
npx.cmd supabase secrets set LESSON_USER_DATA_TABLE=user_data
```

`SUPABASE_SERVICE_ROLE_KEY` は公開してはいけません。GitHub Pagesや`.env.local`には入れず、Supabase Edge FunctionのSecretにだけ保存します。

### 公開版のユーザー登録を有効にする場合

DレッスンURLから利用者自身が登録できるようにする場合は、管理者・先生用の `admin-create-student` とは別に、公開登録専用Functionを使います。

```powershell
deno check supabase/functions/public-register-student/index.ts
npx.cmd supabase functions deploy public-register-student --use-api
npx.cmd supabase secrets set PUBLIC_STUDENT_REGISTRATION_ENABLED=true
npx.cmd supabase secrets set PUBLIC_STUDENT_CAMPUS_ID=public
npx.cmd supabase secrets set PUBLIC_STUDENT_GROUP=public
npx.cmd supabase secrets set LESSON_USER_DATA_TABLE=user_data
```

SupabaseプロジェクトにリンクしていないPCでは、各 `npx.cmd supabase` コマンドに `--project-ref lmonjfdxtefsvgtdixid` を付けます。

メール確認URLを必須にする場合は、Supabase Authentication側でメール確認とメール送信設定を有効にしたうえで、次も設定します。

```powershell
npx.cmd supabase secrets set PUBLIC_REGISTER_REQUIRE_EMAIL_CONFIRMATION=true
npx.cmd supabase secrets set PUBLIC_REGISTER_EMAIL_REDIRECT_TO=https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/
```

注意:

- `PUBLIC_STUDENT_REGISTRATION_ENABLED=true` を設定しない限り、登録フォームから送信しても登録は拒否されます。
- `PUBLIC_REGISTER_REQUIRE_EMAIL_CONFIRMATION=true` の場合、登録直後の自動ログインは行いません。利用者は確認メール内のURLを開いてから通常ログインします。
- 公開登録ユーザーは `lesson_user_access` に `student` として登録され、自分の `user_data` 行だけを読み書きします。
- ゲストプレイはクラウドに保存しません。ブラウザを閉じるとゲストの記録は消えます。

## 6. Auth児童アカウント作成

1. 管理者でDレッスンにログイン
2. `管理者用` → `生徒管理`
3. 新規追加欄で、名前・生年月日・児童番号・あいことばを入力
4. `追加/Auth作成` を押す

通常運用では、児童のAuth作成は新規追加時に完了します。先生・管理者ロールの登録や、既存データの保守が必要な場合だけ `先生・管理者権限` を確認します。

作成後、次が自動で行われます。

- Supabase Authユーザー作成
- `lesson_user_access` に student 権限を登録
- 児童データに `loginNumber` と `authUserId` を記録

Edge Function未デプロイの場合は、従来どおりAuth User IDを手入力して登録できます。

## 7. 不正ユーザー・退会ユーザー削除

管理者画面の児童削除では、`admin-delete-auth-user` が利用可能な場合、次をまとめて削除します。

- 対象児童の Supabase Auth ユーザー
- `lesson_user_access` の対象児童行
- `user_data` の対象児童行

Auth未連携の古い児童データは、`user_data` の削除のみ行います。

## 8. 校舎別URL

校舎別のログインメールに分けたい場合、公開URLに `campus` を付けます。

```text
https://example.github.io/d-lesson-v4/?campus=wakamatsu
```

この場合、児童番号1番のログインメールは次の形式になります。

```text
dlesson-student-wakamatsu-001@dlesson.example.com
```

`campus` を付けない場合は従来通りです。

```text
dlesson-student-001@dlesson.example.com
```
