# 児童番号ログイン

## 目的

公開URLで児童名一覧を出さずに、児童本人だけが自分の練習データへ入れるようにします。

現在のログイン画面では、児童は次の2つをキーボードで入力します。

```text
児童番号
あいことば
```

画面にはメールアドレスやAuth User IDを表示しません。

## 仕組み

児童ごとに Supabase Auth アカウントを作成します。画面で入力された児童番号から、内部メールを組み立ててログインします。

例:

```text
画面で入力する番号: 1
内部メール: dlesson-student-001@example.com
あいことば: 6けた以上の数字
```

ログイン後、`lesson_user_access` とRLSにより、その児童本人の `user_data` だけを読み込みます。本人データが1件だけ見える場合は、名前選択画面を通らず自動で練習メニューに進みます。

## 環境変数

児童番号ログインを有効にするには、`.env.local` または GitHub Actions の Secrets/Variables に次を設定します。

```env
VITE_STUDENT_LOGIN_EMAIL_DOMAIN=example.com
VITE_STUDENT_LOGIN_EMAIL_PREFIX=dlesson-student-
VITE_STUDENT_LOGIN_NUMBER_PAD=3
VITE_STUDENT_LOGIN_MIN=1
VITE_STUDENT_LOGIN_MAX=40
VITE_STUDENT_LOGIN_PASSCODE_MIN_LENGTH=6
VITE_STUDENT_LOGIN_PASSCODE_MAX_LENGTH=12
```

`VITE_STUDENT_LOGIN_EMAIL_DOMAIN` が空の場合は、従来どおりメールアドレスとパスワードのログイン画面になります。

## 児童ログインCSVの作成

旧環境から移行した `migration/legacy-user-map.csv` がある場合、次のコマンドで児童番号、内部メール、あいことばの一覧を作れます。

```powershell
npm.cmd run build:student-login-csv -- --mapping ".\migration\legacy-user-map.csv" --domain "example.com" --output ".\migration\student-login-accounts.csv"
```

作成直後に、番号・メール・あいことば・移行IDのズレがないか確認します。

```powershell
npm.cmd run check:student-login-csv -- --mapping ".\migration\legacy-user-map.csv" --input ".\migration\student-login-accounts.csv" --domain "example.com"
```

`example.com` は、実際に使う内部メール用ドメインに置き換えます。このメールアドレスは児童に配布しません。

出力されるCSVには `password` が含まれるため、Gitに入れないでください。`migration/` は `.gitignore` 済みです。

## Supabase Auth作成後

1. `student_number` と `password` を見ながら、Supabase Auth に児童アカウントを作成する。
2. Supabase Dashboard の Authentication で各児童の Auth User ID を確認する。
3. CSVの `auth_user_id` 列にAuth User IDを入れる。
4. Auth User IDの入れ間違いがないか確認する。

```powershell
npm.cmd run check:student-login-csv -- --mapping ".\migration\legacy-user-map.csv" --input ".\migration\student-login-accounts.csv" --domain "example.com" --require-auth-user-id
```

5. 次のコマンドで `lesson_user_access` 用SQLを作る。

```powershell
npm.cmd run build:student-access-sql -- --mapping ".\migration\legacy-user-map.csv" --auth ".\migration\student-login-accounts.csv" --output ".\migration\student-access.sql"
```

## 確認項目

- ログイン前に児童名一覧が表示されない。
- 児童は児童番号とあいことばでログインできる。
- 児童ログイン後、自分の練習メニューに自動で進む。
- 児童ログインで他児童の名前や進捗が見えない。
- 先生・管理者は従来のメールアドレス/パスワードでログインできる。
